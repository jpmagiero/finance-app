import {
  type CreateAccountInput,
  createAccountSchema,
  type UpdateAccountInput,
  updateAccountSchema,
} from "@finance/shared";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "../db";
import { accounts, recurringTransactions, transactions } from "../db/schema";
import { badRequest, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { moneyAsBigInt, safeMoneyCents } from "../lib/money";
import { now } from "../lib/normalize";
import { ensureHouseholdExists, ensurePersonBelongsToHousehold } from "./common-service";

type ListAccountsInput = {
  householdId: string;
  includeArchived?: boolean;
};

export function listAccounts(input: ListAccountsInput) {
  ensureHouseholdExists(input.householdId);
  const conditions = [eq(accounts.householdId, input.householdId)];
  if (!input.includeArchived) {
    conditions.push(eq(accounts.isArchived, false));
  }
  return db
    .select()
    .from(accounts)
    .where(and(...conditions))
    .all();
}

export function getAccount(id: string) {
  const account = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!account) {
    notFound("Conta nao encontrada.");
  }
  return account;
}

export function createAccount(input: CreateAccountInput) {
  input = createAccountSchema.parse(input);
  ensureHouseholdExists(input.householdId);
  if (input.personId) {
    ensurePersonBelongsToHousehold(input.personId, input.householdId);
  }
  const id = createId();
  db.insert(accounts)
    .values({
      id,
      householdId: input.householdId,
      personId: input.personId ?? null,
      name: input.name,
      type: input.type,
      institution: input.institution ?? null,
      currency: input.currency,
      initialBalanceCents: input.initialBalanceCents,
      currentBalanceCents: input.initialBalanceCents,
      creditLimitCents: input.creditLimitCents ?? null,
      statementClosingDay: input.statementClosingDay ?? null,
      statementDueDay: input.statementDueDay ?? null,
      isShared: input.isShared,
    })
    .run();
  return getAccount(id);
}

function calculateAccountBalance(id: string, initialBalanceCents: number) {
  const rows = db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "confirmed"),
        isNull(transactions.deletedAt),
        or(eq(transactions.accountId, id), eq(transactions.transferAccountId, id)),
      ),
    )
    .all();
  // Accumulate exactly, even if intermediate sums exceed the number range.
  const balance = rows.reduce((sum, transaction) => {
    const amount = moneyAsBigInt(transaction.amountCents);
    if (transaction.type === "income" && transaction.accountId === id) return sum + amount;
    if (transaction.type === "expense" && transaction.accountId === id) return sum - amount;
    if (transaction.type === "transfer") {
      if (transaction.accountId === id) return sum - amount;
      if (transaction.transferAccountId === id) return sum + amount;
    }
    return sum;
  }, moneyAsBigInt(initialBalanceCents));
  return safeMoneyCents(balance);
}

export function updateAccount(id: string, input: UpdateAccountInput) {
  input = updateAccountSchema.parse(input);
  return db.transaction(() => {
    const account = getAccount(id);
    if (input.personId) {
      ensurePersonBelongsToHousehold(input.personId, account.householdId);
    }
    if (input.currency !== undefined && input.currency !== account.currency) {
      const usage = db
        .select({ id: transactions.id })
        .from(transactions)
        .where(or(eq(transactions.accountId, id), eq(transactions.transferAccountId, id)))
        .get();
      if (
        usage ||
        db.select().from(recurringTransactions).where(eq(recurringTransactions.accountId, id)).get()
      ) {
        badRequest("A moeda de uma conta com historico ou recorrencia nao pode ser alterada.");
      }
    }
    const initialBalanceCents = input.initialBalanceCents ?? account.initialBalanceCents;
    const currentBalanceCents =
      input.initialBalanceCents === undefined
        ? account.currentBalanceCents
        : calculateAccountBalance(id, initialBalanceCents);
    db.update(accounts)
      .set({
        personId: input.personId === undefined ? account.personId : input.personId,
        name: input.name ?? account.name,
        type: input.type ?? account.type,
        institution: input.institution === undefined ? account.institution : input.institution,
        currency: input.currency ?? account.currency,
        initialBalanceCents,
        currentBalanceCents,
        creditLimitCents:
          input.creditLimitCents === undefined ? account.creditLimitCents : input.creditLimitCents,
        statementClosingDay:
          input.statementClosingDay === undefined
            ? account.statementClosingDay
            : input.statementClosingDay,
        statementDueDay:
          input.statementDueDay === undefined ? account.statementDueDay : input.statementDueDay,
        isShared: input.isShared ?? account.isShared,
        updatedAt: now(),
      })
      .where(eq(accounts.id, id))
      .run();
    return getAccount(id);
  });
}

export function archiveAccount(id: string) {
  getAccount(id);
  db.update(accounts).set({ isArchived: true, updatedAt: now() }).where(eq(accounts.id, id)).run();
}

export function recalculateAccountBalance(id: string) {
  return db.transaction(() => {
    const account = getAccount(id);
    const currentBalanceCents = calculateAccountBalance(id, account.initialBalanceCents);
    db.update(accounts)
      .set({ currentBalanceCents, updatedAt: now() })
      .where(eq(accounts.id, id))
      .run();
    return getAccount(id);
  });
}
