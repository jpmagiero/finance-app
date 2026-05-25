import type { CreateAccountInput, UpdateAccountInput } from "@finance/shared";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "../db";
import { accounts, transactions } from "../db/schema";
import { notFound } from "../lib/http";
import { createId } from "../lib/ids";
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
  ensureHouseholdExists(input.householdId);

  if (input.personId) {
    ensurePersonBelongsToHousehold(input.personId, input.householdId);
  }

  const id = createId();
  const initialBalanceCents = input.initialBalanceCents;

  db.insert(accounts)
    .values({
      id,
      householdId: input.householdId,
      personId: input.personId ?? null,
      name: input.name,
      type: input.type,
      institution: input.institution ?? null,
      currency: input.currency,
      initialBalanceCents,
      currentBalanceCents: input.currentBalanceCents ?? initialBalanceCents,
      creditLimitCents: input.creditLimitCents ?? null,
      statementClosingDay: input.statementClosingDay ?? null,
      statementDueDay: input.statementDueDay ?? null,
      isShared: input.isShared,
    })
    .run();

  return getAccount(id);
}

export function updateAccount(id: string, input: UpdateAccountInput) {
  const account = getAccount(id);

  if (input.personId) {
    ensurePersonBelongsToHousehold(input.personId, account.householdId);
  }

  db.update(accounts)
    .set({
      personId: input.personId === undefined ? account.personId : input.personId,
      name: input.name ?? account.name,
      type: input.type ?? account.type,
      institution: input.institution === undefined ? account.institution : input.institution,
      currency: input.currency ?? account.currency,
      initialBalanceCents: input.initialBalanceCents ?? account.initialBalanceCents,
      currentBalanceCents: input.currentBalanceCents ?? account.currentBalanceCents,
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
}

export function archiveAccount(id: string) {
  getAccount(id);

  db.update(accounts)
    .set({
      isArchived: true,
      updatedAt: now(),
    })
    .where(eq(accounts.id, id))
    .run();
}

export function recalculateAccountBalance(id: string) {
  const account = getAccount(id);
  const accountTransactions = db
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

  const currentBalanceCents = accountTransactions.reduce((balance, transaction) => {
    if (transaction.type === "income" && transaction.accountId === id) {
      return balance + transaction.amountCents;
    }

    if (transaction.type === "expense" && transaction.accountId === id) {
      return balance - transaction.amountCents;
    }

    if (transaction.type === "transfer" && transaction.accountId === id) {
      return balance - transaction.amountCents;
    }

    if (transaction.type === "transfer" && transaction.transferAccountId === id) {
      return balance + transaction.amountCents;
    }

    return balance;
  }, account.initialBalanceCents);

  db.update(accounts)
    .set({
      currentBalanceCents,
      updatedAt: now(),
    })
    .where(eq(accounts.id, id))
    .run();

  return getAccount(id);
}
