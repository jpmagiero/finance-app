import type { CreateAccountInput, UpdateAccountInput } from "@finance/shared";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "../db";
import { accounts, transactions } from "../db/schema";
import { balanceDeltas } from "../lib/balance";
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

export function getAccount(householdId: string, id: string) {
  const account = db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.householdId, householdId)))
    .get();

  if (!account) {
    notFound("Conta nao encontrada nesta casa.");
  }

  return account;
}

export function createAccount(input: CreateAccountInput) {
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
      // Conta nova nao tem transacoes: o saldo atual e o proprio saldo inicial.
      currentBalanceCents: input.initialBalanceCents,
      creditLimitCents: input.creditLimitCents ?? null,
      statementClosingDay: input.statementClosingDay ?? null,
      statementDueDay: input.statementDueDay ?? null,
      isShared: input.isShared,
    })
    .run();

  return getAccount(input.householdId, id);
}

export function updateAccount(householdId: string, id: string, input: UpdateAccountInput) {
  const account = getAccount(householdId, id);

  if (input.personId) {
    ensurePersonBelongsToHousehold(input.personId, householdId);
  }

  const initialBalanceCents = input.initialBalanceCents ?? account.initialBalanceCents;
  // Saldo e derivado: mover o saldo inicial desloca o saldo atual pela mesma
  // diferenca, mantendo a consistencia sem recalculo completo.
  const balanceShiftCents = initialBalanceCents - account.initialBalanceCents;

  db.transaction(() => {
    db.update(accounts)
      .set({
        personId: input.personId === undefined ? account.personId : input.personId,
        name: input.name ?? account.name,
        type: input.type ?? account.type,
        institution: input.institution === undefined ? account.institution : input.institution,
        currency: input.currency ?? account.currency,
        initialBalanceCents,
        currentBalanceCents: account.currentBalanceCents + balanceShiftCents,
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
  });

  return getAccount(householdId, id);
}

export function archiveAccount(householdId: string, id: string) {
  getAccount(householdId, id);

  db.update(accounts)
    .set({
      isArchived: true,
      updatedAt: now(),
    })
    .where(eq(accounts.id, id))
    .run();
}

export function recalculateAccountBalance(householdId: string, id: string) {
  // Leitura do snapshot e escrita do saldo na mesma transacao (com lock de
  // escrita imediato): sem isso, uma transacao confirmada entre o SELECT e o
  // UPDATE por outro processo seria sobrescrita pelo valor absoluto calculado
  // com o snapshot antigo.
  db.transaction(
    () => {
      const account = getAccount(householdId, id);

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
        const accountDeltaCents = balanceDeltas(transaction)
          .filter((delta) => delta.accountId === id)
          .reduce((total, delta) => total + delta.deltaCents, 0);

        return balance + accountDeltaCents;
      }, account.initialBalanceCents);

      db.update(accounts)
        .set({
          currentBalanceCents,
          updatedAt: now(),
        })
        .where(eq(accounts.id, id))
        .run();
    },
    { behavior: "immediate" },
  );

  return getAccount(householdId, id);
}
