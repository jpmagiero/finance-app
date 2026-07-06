import type { CreatePayeeInput, UpdatePayeeInput } from "@finance/shared";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { payees, recurringTransactions, transactions } from "../db/schema";
import { badRequest, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { normalizeName, now } from "../lib/normalize";
import { ensureHouseholdExists } from "./common-service";

export function listPayees(householdId: string) {
  ensureHouseholdExists(householdId);

  return db.select().from(payees).where(eq(payees.householdId, householdId)).all();
}

export function getPayee(householdId: string, id: string) {
  const payee = db
    .select()
    .from(payees)
    .where(and(eq(payees.id, id), eq(payees.householdId, householdId)))
    .get();

  if (!payee) {
    notFound("Favorecido nao encontrado nesta casa.");
  }

  return payee;
}

export function createPayee(input: CreatePayeeInput) {
  ensureHouseholdExists(input.householdId);

  const id = createId();

  db.insert(payees)
    .values({
      id,
      householdId: input.householdId,
      name: input.name,
      normalizedName: normalizeName(input.name),
    })
    .run();

  return getPayee(input.householdId, id);
}

export function updatePayee(householdId: string, id: string, input: UpdatePayeeInput) {
  const payee = getPayee(householdId, id);
  const name = input.name ?? payee.name;

  db.update(payees)
    .set({
      name,
      normalizedName: normalizeName(name),
      updatedAt: now(),
    })
    .where(eq(payees.id, id))
    .run();

  return getPayee(householdId, id);
}

export function deletePayee(householdId: string, id: string) {
  getPayee(householdId, id);

  const usage = db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.payeeId, id), isNull(transactions.deletedAt)))
    .get();
  const recurringUsage = db
    .select({ id: recurringTransactions.id })
    .from(recurringTransactions)
    .where(eq(recurringTransactions.payeeId, id))
    .get();

  if (usage || recurringUsage) {
    badRequest("Favorecido em uso nao pode ser excluido.");
  }

  db.delete(payees).where(eq(payees.id, id)).run();
}
