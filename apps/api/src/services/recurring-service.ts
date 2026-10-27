import { type RecurringInput, recurrenceRangeSchema, recurringInputSchema } from "@finance/shared";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { recurringSplits, recurringTags, recurringTransactions, transactions } from "../db/schema";
import { badRequest, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";
import { occurrenceDates } from "../lib/recurrence-dates";
import { createTransaction, validateNewTransaction } from "./transactions-service";

export function getRecurring(id: string) {
  const row = db.select().from(recurringTransactions).where(eq(recurringTransactions.id, id)).get();
  if (!row) notFound("Recorrencia nao encontrada.");
  const splits = db
    .select()
    .from(recurringSplits)
    .where(eq(recurringSplits.recurringTransactionId, id))
    .all();
  const tagIds = db
    .select()
    .from(recurringTags)
    .where(eq(recurringTags.recurringTransactionId, id))
    .all()
    .map((row) => row.tagId);
  return {
    ...row,
    splits: (splits.length
      ? splits
      : [{ categoryId: row.categoryId, amountCents: row.amountCents, description: null }]
    ).map(({ categoryId, amountCents, description }) => ({ categoryId, amountCents, description })),
    tagIds,
  };
}
export function listRecurring(householdId: string) {
  return db
    .select({ id: recurringTransactions.id })
    .from(recurringTransactions)
    .where(eq(recurringTransactions.householdId, householdId))
    .orderBy(desc(recurringTransactions.createdAt), recurringTransactions.id)
    .all()
    .map((row) => getRecurring(row.id));
}
function persist(input: RecurringInput, id: string, existing: boolean) {
  const value = recurringInputSchema.parse(input);
  const transaction = validateNewTransaction({
    ...value,
    transactionDate: value.startsAt,
    status: "pending",
  });
  const record = {
    householdId: value.householdId,
    personId: transaction.personId,
    accountId: transaction.accountId,
    categoryId: null,
    payeeId: transaction.payeeId,
    type: value.type,
    amountCents: value.amountCents,
    description: transaction.description,
    notes: transaction.notes,
    frequency: value.frequency,
    interval: value.interval,
    startsAt: value.startsAt,
    endsAt: value.endsAt ?? null,
    isActive: value.isActive,
    dayOfMonth: null,
    dayOfWeek: null,
    nextRunAt: null,
    autoCreate: false,
    updatedAt: now(),
  };
  if (existing)
    db.update(recurringTransactions).set(record).where(eq(recurringTransactions.id, id)).run();
  else
    db.insert(recurringTransactions)
      .values({ id, ...record })
      .run();
  db.delete(recurringSplits).where(eq(recurringSplits.recurringTransactionId, id)).run();
  db.delete(recurringTags).where(eq(recurringTags.recurringTransactionId, id)).run();
  for (const split of transaction.splits)
    db.insert(recurringSplits)
      .values({
        id: createId(),
        recurringTransactionId: id,
        categoryId: split.categoryId ?? null,
        amountCents: split.amountCents,
        description: split.description ?? null,
      })
      .run();
  for (const tagId of transaction.tagIds)
    db.insert(recurringTags).values({ recurringTransactionId: id, tagId }).run();
}
export function createRecurring(input: RecurringInput) {
  const id = createId();
  db.transaction(() => persist(input, id, false), { behavior: "immediate" });
  return getRecurring(id);
}
export function updateRecurring(id: string, input: RecurringInput) {
  db.transaction(
    () => {
      const existing = getRecurring(id);
      if (existing.householdId !== input.householdId)
        badRequest("A casa da recorrencia nao pode ser alterada.");
      persist(input, id, true);
    },
    { behavior: "immediate" },
  );
  return getRecurring(id);
}
export function setRecurringActive(id: string, isActive: boolean) {
  getRecurring(id);
  db.update(recurringTransactions)
    .set({ isActive, updatedAt: now() })
    .where(eq(recurringTransactions.id, id))
    .run();
  return getRecurring(id);
}
export function previewRecurring(id: string, input: { from: string; to: string }) {
  const range = recurrenceRangeSchema.parse(input),
    rule = getRecurring(id);
  if (rule.type !== "income" && rule.type !== "expense")
    badRequest("Recorrencia legada de tipo nao suportado. Edite a regra.");
  const dates = occurrenceDates(rule, range.from, range.to);
  const existing = db
    .select({
      date: transactions.occurrenceDate,
      id: transactions.id,
      deletedAt: transactions.deletedAt,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.recurringTransactionId, id),
        gte(transactions.occurrenceDate, range.from),
        lte(transactions.occurrenceDate, range.to),
      ),
    )
    .all();
  return dates.map((date) => {
    const transaction = existing.find((row) => row.date === date);
    return { date, transactionId: transaction?.id ?? null, deleted: !!transaction?.deletedAt };
  });
}
export function generateRecurring(id: string, range: { from: string; to: string }, userId: string) {
  return db.transaction(
    () => {
      const rule = getRecurring(id);
      if (!rule.isActive) badRequest("Recorrencia pausada. Retome antes de gerar.");
      const dates = previewRecurring(id, range);
      const createdIds: string[] = [];
      for (const occurrence of dates) {
        if (occurrence.transactionId) continue;
        // The existing financial service owns reference checks, splits, tags and balances.
        const entry = createTransaction(
          { ...rule, transactionDate: occurrence.date, status: "pending" },
          userId,
          { recurringTransactionId: id, occurrenceDate: occurrence.date },
        );
        createdIds.push(entry.id);
      }
      return {
        created: createdIds.length,
        skipped: dates.length - createdIds.length,
        transactionIds: createdIds,
      };
    },
    { behavior: "immediate" },
  );
}
