import { and, eq, gte, isNull, lte, not } from "drizzle-orm";
import { db } from "../db";
import { categories, settings, transactionSplits, transactions } from "../db/schema";
import { ensureHouseholdExists } from "./common-service";

// Periodo do mes respeitando o dia de inicio configurado nas settings da casa.
// Com startDay <= 1 o periodo e o mes-calendario; senao vai do dia startDay ate
// o dia (startDay - 1) do mes seguinte. Date.UTC recebe monthIndex 1-12 e ja
// cai no mes seguinte porque JS conta meses de 0-11 (startDay maximo e 28,
// entao nao ha overflow de dia).
function monthPeriod(month: string, startDay: number) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));

  if (startDay <= 1) {
    const periodEnd = new Date(Date.UTC(year, monthIndex, 0)).toISOString().slice(0, 10);

    return { periodStart: `${month}-01`, periodEnd };
  }

  const periodStart = `${month}-${String(startDay).padStart(2, "0")}`;
  const periodEnd = new Date(Date.UTC(year, monthIndex, startDay - 1)).toISOString().slice(0, 10);

  return { periodStart, periodEnd };
}

export function getMonthlyDashboard(householdId: string, month: string) {
  ensureHouseholdExists(householdId);

  const householdSettings = db
    .select()
    .from(settings)
    .where(eq(settings.householdId, householdId))
    .get();

  const startDay = householdSettings?.monthlyPeriodStartDay ?? 1;
  const includePending = householdSettings?.includePendingInReports ?? true;
  const { periodStart, periodEnd } = monthPeriod(month, startDay);

  const statusCondition = includePending
    ? not(eq(transactions.status, "canceled"))
    : eq(transactions.status, "confirmed");

  const periodCondition = and(
    eq(transactions.householdId, householdId),
    isNull(transactions.deletedAt),
    statusCondition,
    gte(transactions.transactionDate, periodStart),
    lte(transactions.transactionDate, periodEnd),
  );

  const rows = db.select().from(transactions).where(periodCondition).all();

  let incomeCents = 0;
  let expenseCents = 0;

  for (const transaction of rows) {
    if (transaction.type === "income") {
      incomeCents += transaction.amountCents;
    } else if (transaction.type === "expense") {
      expenseCents += transaction.amountCents;
    }
  }

  // Splits filtrados no banco pelo mesmo escopo das transacoes do periodo —
  // nunca carregar transaction_splits sem WHERE (cruzaria households).
  const splitRows = db
    .select({
      categoryId: transactionSplits.categoryId,
      amountCents: transactionSplits.amountCents,
    })
    .from(transactionSplits)
    .innerJoin(transactions, eq(transactionSplits.transactionId, transactions.id))
    .where(periodCondition)
    .all();

  const categoryTotals = new Map<string, number>();

  for (const split of splitRows) {
    if (!split.categoryId) {
      continue;
    }

    categoryTotals.set(
      split.categoryId,
      (categoryTotals.get(split.categoryId) ?? 0) + split.amountCents,
    );
  }

  const categoryRows = db
    .select()
    .from(categories)
    .where(eq(categories.householdId, householdId))
    .all();
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));

  return {
    month,
    periodStart,
    periodEnd,
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    transactionCount: rows.length,
    categories: [...categoryTotals.entries()].map(([categoryId, amountCents]) => ({
      category: categoryById.get(categoryId) ?? null,
      amountCents,
    })),
  };
}
