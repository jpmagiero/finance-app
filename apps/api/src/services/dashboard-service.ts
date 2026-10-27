import { and, eq, gte, isNull, lt, ne, type SQL } from "drizzle-orm";
import { db } from "../db";
import { accounts, categories, settings, transactionSplits, transactions } from "../db/schema";
import { badRequest } from "../lib/http";
import { moneyAsBigInt, safeMoneyCents, sumMoneyCents } from "../lib/money";
import { ensureHouseholdExists } from "./common-service";

export function financialPeriod(month: string, startDay: number) {
  const year = Number(month.slice(0, 4)),
    index = Number(month.slice(5, 7)) - 1;
  const date = new Date(0);
  date.setUTCFullYear(year, index, startDay);
  const from = date.toISOString().slice(0, 10);
  date.setUTCMonth(date.getUTCMonth() + 1);
  if (date.getUTCFullYear() > 9999) badRequest("Periodo fora do calendario suportado.");
  const until = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() - 1);
  return { from, to: date.toISOString().slice(0, 10), until };
}

export function monthlyDashboard(input: { householdId: string; month: string; personId?: string }) {
  ensureHouseholdExists(input.householdId);
  const config = db
    .select()
    .from(settings)
    .where(eq(settings.householdId, input.householdId))
    .get();
  const period = financialPeriod(input.month, config?.monthlyPeriodStartDay ?? 1);
  const conditions: SQL[] = [
    eq(transactions.householdId, input.householdId),
    isNull(transactions.deletedAt),
    ne(transactions.status, "canceled"),
    gte(transactions.transactionDate, period.from),
    lt(transactions.transactionDate, period.until),
  ];
  if (input.personId)
    conditions.push(
      input.personId === "unassigned"
        ? isNull(transactions.personId)
        : eq(transactions.personId, input.personId),
    );
  const rows = db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .all();
  const income = (status?: string) =>
    sumMoneyCents(
      rows
        .filter((t) => t.type === "income" && (!status || t.status === status))
        .map((t) => t.amountCents),
    );
  const expense = (status?: string) =>
    sumMoneyCents(
      rows
        .filter((t) => t.type === "expense" && (!status || t.status === status))
        .map((t) => t.amountCents),
    );
  const selected =
    config?.includePendingInReports === false ? rows.filter((t) => t.status === "confirmed") : rows;
  const selectedConditions = [...conditions, eq(transactions.type, "expense")];
  if (config?.includePendingInReports === false)
    selectedConditions.push(eq(transactions.status, "confirmed"));
  const splits = db
    .select({ category: categories, amountCents: transactionSplits.amountCents })
    .from(transactionSplits)
    .innerJoin(transactions, eq(transactionSplits.transactionId, transactions.id))
    .leftJoin(categories, eq(transactionSplits.categoryId, categories.id))
    .where(and(...selectedConditions))
    .all();
  const totals = new Map<
    string,
    { category: typeof categories.$inferSelect | null; amount: bigint }
  >();
  for (const split of splits) {
    const key = split.category?.id ?? "unassigned";
    const total = totals.get(key) ?? { category: split.category, amount: 0n };
    total.amount += moneyAsBigInt(split.amountCents);
    totals.set(key, total);
  }
  const days = new Map<string, { income: bigint; expense: bigint }>();
  for (const t of selected) {
    const day = days.get(t.transactionDate) ?? { income: 0n, expense: 0n };
    if (t.type === "income") day.income += moneyAsBigInt(t.amountCents);
    if (t.type === "expense") day.expense += moneyAsBigInt(t.amountCents);
    days.set(t.transactionDate, day);
  }
  const incomeCents = config?.includePendingInReports === false ? income("confirmed") : income();
  const expenseCents = config?.includePendingInReports === false ? expense("confirmed") : expense();
  const currencies = db
    .select({ currency: accounts.currency })
    .from(accounts)
    .where(eq(accounts.householdId, input.householdId))
    .all();
  return {
    month: input.month,
    from: period.from,
    to: period.to,
    currency: config?.currency ?? "BRL",
    incomeCents,
    expenseCents,
    balanceCents: safeMoneyCents(moneyAsBigInt(incomeCents) - moneyAsBigInt(expenseCents)),
    confirmedIncomeCents: income("confirmed"),
    confirmedExpenseCents: expense("confirmed"),
    pendingIncomeCents: income("pending"),
    pendingExpenseCents: expense("pending"),
    transactionCount: selected.length,
    hasMixedCurrencies: currencies.some((a) => a.currency !== (config?.currency ?? "BRL")),
    categories: [...totals.values()]
      .map((t) => ({ category: t.category, amountCents: safeMoneyCents(t.amount) }))
      .sort((a, b) => b.amountCents - a.amountCents),
    flow: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date,
        incomeCents: safeMoneyCents(value.income),
        expenseCents: safeMoneyCents(value.expense),
      })),
  };
}
