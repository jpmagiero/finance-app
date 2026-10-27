import {
  type BudgetInput,
  type BudgetSummary,
  budgetInputSchema,
  budgetPeriodRange,
} from "@finance/shared";
import { and, desc, eq, gte, isNull, lte, ne, type SQL, sql } from "drizzle-orm";
import { db } from "../db";
import {
  accounts,
  budgetItems,
  budgets,
  categories,
  householdPeople,
  settings,
  transactionSplits,
  transactions,
} from "../db/schema";
import { badRequest, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { moneyAsBigInt, safeMoneyCents, sumMoneyCents } from "../lib/money";
import { now } from "../lib/normalize";
import { ensureHouseholdExists } from "./common-service";

export function getBudget(id: string) {
  const row = db.select().from(budgets).where(eq(budgets.id, id)).get();
  if (!row) notFound("Orcamento nao encontrado.");
  const items = db
    .select({ categoryId: budgetItems.categoryId, limitCents: budgetItems.limitCents })
    .from(budgetItems)
    .where(eq(budgetItems.budgetId, id))
    .all();
  return { ...row, endsAt: row.endsAt ?? row.startsAt, items };
}
export function listBudgets(householdId: string, includeArchived = false) {
  const conditions = [eq(budgets.householdId, householdId)];
  if (!includeArchived) conditions.push(eq(budgets.isArchived, false));
  return db
    .select({ id: budgets.id })
    .from(budgets)
    .where(and(...conditions))
    .orderBy(desc(budgets.startsAt), budgets.name, budgets.id)
    .all()
    .map((row) => getBudget(row.id));
}
function validateReferences(value: BudgetInput, existing?: ReturnType<typeof getBudget>) {
  ensureHouseholdExists(value.householdId);
  if (value.personId) {
    const person = db
      .select()
      .from(householdPeople)
      .where(eq(householdPeople.id, value.personId))
      .get();
    if (!person || person.householdId !== value.householdId)
      notFound("Pessoa nao encontrada nesta casa.");
    if (!person.isActive && existing?.personId !== person.id) badRequest("Pessoa esta inativa.");
  }
  for (const item of value.items) {
    const category = db.select().from(categories).where(eq(categories.id, item.categoryId)).get();
    if (!category || category.householdId !== value.householdId)
      notFound("Categoria nao encontrada nesta casa.");
    if (category.type !== "expense") badRequest("Orcamentos usam somente categorias de despesas.");
    if (category.isArchived && !existing?.items.some((old) => old.categoryId === item.categoryId))
      badRequest("Categoria esta arquivada.");
  }
  const unchanged =
    existing?.period === value.period &&
    existing.startsAt === value.startsAt &&
    existing.endsAt === value.endsAt;
  if (!unchanged && value.period !== "custom") {
    const config = db
      .select()
      .from(settings)
      .where(eq(settings.householdId, value.householdId))
      .get();
    const range = budgetPeriodRange(
      value.period,
      value.startsAt.slice(0, value.period === "monthly" ? 7 : 4),
      config?.monthlyPeriodStartDay ?? 1,
    );
    if (range.startsAt !== value.startsAt || range.endsAt !== value.endsAt)
      badRequest(
        "Datas incompativeis com o periodo. Mensal segue o inicio financeiro da casa; anual usa janeiro a dezembro.",
      );
  }
}
function ensureNoOverlap(value: BudgetInput, excludedId?: string) {
  const rows = db
    .select({ id: budgets.id, categoryId: budgetItems.categoryId })
    .from(budgetItems)
    .innerJoin(budgets, eq(budgetItems.budgetId, budgets.id))
    .where(
      and(
        eq(budgets.householdId, value.householdId),
        eq(budgets.currency, value.currency),
        value.personId ? eq(budgets.personId, value.personId) : isNull(budgets.personId),
        eq(budgets.isArchived, false),
        lte(budgets.startsAt, value.endsAt),
        sql`coalesce(${budgets.endsAt}, ${budgets.startsAt}) >= ${value.startsAt}`,
      ),
    )
    .all();
  const ids = new Set(value.items.map((item) => item.categoryId));
  if (rows.some((row) => row.id !== excludedId && ids.has(row.categoryId)))
    badRequest(
      "Ja existe limite ativo para esta categoria, pessoa/casa, moeda e periodo. Edite o orcamento existente ou escolha outro intervalo.",
    );
}
function saveBudget(input: BudgetInput, id: string, existing?: ReturnType<typeof getBudget>) {
  const value = budgetInputSchema.parse(input);
  if (existing && existing.householdId !== value.householdId)
    badRequest("A casa do orcamento nao pode ser alterada.");
  validateReferences(value, existing);
  if (!existing?.isArchived) ensureNoOverlap(value, id);
  const record = {
    householdId: value.householdId,
    personId: value.personId ?? null,
    name: value.name,
    period: value.period,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    currency: value.currency,
    updatedAt: now(),
  };
  if (existing) db.update(budgets).set(record).where(eq(budgets.id, id)).run();
  else
    db.insert(budgets)
      .values({ id, ...record })
      .run();
  db.delete(budgetItems).where(eq(budgetItems.budgetId, id)).run();
  for (const item of value.items)
    db.insert(budgetItems)
      .values({ id: createId(), budgetId: id, ...item })
      .run();
}
export function createBudget(input: BudgetInput) {
  const id = createId();
  db.transaction(() => saveBudget(input, id), { behavior: "immediate" });
  return getBudget(id);
}
export function updateBudget(id: string, input: BudgetInput) {
  db.transaction(() => saveBudget(input, id, getBudget(id)), { behavior: "immediate" });
  return getBudget(id);
}
export function archiveBudget(id: string) {
  getBudget(id);
  db.update(budgets).set({ isArchived: true, updatedAt: now() }).where(eq(budgets.id, id)).run();
}
export function restoreBudget(id: string) {
  return db.transaction(
    () => {
      const budget = getBudget(id);
      const {
        id: _id,
        isArchived: _archived,
        createdAt: _created,
        updatedAt: _updated,
        ...input
      } = budget;
      const value = budgetInputSchema.parse(input);
      validateReferences(value, budget);
      ensureNoOverlap(value, id);
      db.update(budgets)
        .set({ isArchived: false, updatedAt: now() })
        .where(eq(budgets.id, id))
        .run();
      return getBudget(id);
    },
    { behavior: "immediate" },
  );
}

function amounts(confirmed: bigint, pending: bigint) {
  return {
    confirmedCents: safeMoneyCents(confirmed),
    pendingCents: safeMoneyCents(pending),
    committedCents: safeMoneyCents(confirmed + pending),
  };
}
export function budgetSummary(id: string): BudgetSummary {
  return db.transaction(() => calculateBudgetSummary(id));
}
function calculateBudgetSummary(id: string): BudgetSummary {
  const budget = getBudget(id);
  const config = db
    .select()
    .from(settings)
    .where(eq(settings.householdId, budget.householdId))
    .get();
  const conditions: SQL[] = [
    eq(transactions.householdId, budget.householdId),
    eq(transactions.type, "expense"),
    isNull(transactions.deletedAt),
    ne(transactions.status, "canceled"),
    gte(transactions.transactionDate, budget.startsAt),
    lte(transactions.transactionDate, budget.endsAt),
  ];
  if (budget.personId) conditions.push(eq(transactions.personId, budget.personId));
  const splits = db
    .select({
      transactionId: transactions.id,
      categoryId: transactionSplits.categoryId,
      categoryName: categories.name,
      status: transactions.status,
      amountCents: transactionSplits.amountCents,
      currency: accounts.currency,
    })
    .from(transactionSplits)
    .innerJoin(transactions, eq(transactionSplits.transactionId, transactions.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactionSplits.categoryId, categories.id))
    .where(and(...conditions))
    .all();
  const consumed = new Map<
    string | null,
    { categoryId: string | null; categoryName: string; confirmed: bigint; pending: bigint }
  >();
  const excluded = new Set<string>();
  for (const row of splits) {
    if ((row.currency ?? config?.currency ?? "BRL") !== budget.currency) {
      excluded.add(row.transactionId);
      continue;
    }
    const group = consumed.get(row.categoryId) ?? {
      categoryId: row.categoryId,
      categoryName: row.categoryName ?? "Sem categoria",
      confirmed: 0n,
      pending: 0n,
    };
    if (row.status === "confirmed") group.confirmed += moneyAsBigInt(row.amountCents);
    else if (row.status === "pending") group.pending += moneyAsBigInt(row.amountCents);
    consumed.set(row.categoryId, group);
  }
  const items = budget.items.map((item) => {
    const category = db.select().from(categories).where(eq(categories.id, item.categoryId)).get();
    const used = consumed.get(item.categoryId);
    const consumption = amounts(used?.confirmed ?? 0n, used?.pending ?? 0n);
    const remainingCents = safeMoneyCents(
      moneyAsBigInt(item.limitCents) - moneyAsBigInt(consumption.committedCents),
    );
    return {
      ...item,
      categoryName: category?.name ?? "Categoria indisponivel",
      ...consumption,
      remainingCents,
      exceededCents: Math.max(0, -remainingCents),
    };
  });
  const limited = new Set(items.map((item) => item.categoryId));
  const unbudgeted = [...consumed.values()]
    .filter((row) => !row.categoryId || !limited.has(row.categoryId))
    .map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      ...amounts(row.confirmed, row.pending),
    }));
  const limitCents = sumMoneyCents(items.map((item) => item.limitCents));
  const totals = amounts(
    items.reduce((sum, item) => sum + moneyAsBigInt(item.confirmedCents), 0n),
    items.reduce((sum, item) => sum + moneyAsBigInt(item.pendingCents), 0n),
  );
  const remainingCents = safeMoneyCents(
    moneyAsBigInt(limitCents) - moneyAsBigInt(totals.committedCents),
  );
  return {
    budget,
    items,
    unbudgeted,
    totals: { limitCents, ...totals, remainingCents, exceededCents: Math.max(0, -remainingCents) },
    unbudgetedCents: sumMoneyCents(unbudgeted.map((item) => item.committedCents)),
    excludedCurrencyCount: excluded.size,
  };
}
