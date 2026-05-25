import type { CreatePayeeInput, UpdatePayeeInput } from "@finance/shared";
import { eq, or } from "drizzle-orm";
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

export function getPayee(id: string) {
  const payee = db.select().from(payees).where(eq(payees.id, id)).get();

  if (!payee) {
    notFound("Favorecido nao encontrado.");
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

  return getPayee(id);
}

export function updatePayee(id: string, input: UpdatePayeeInput) {
  const payee = getPayee(id);
  const name = input.name ?? payee.name;

  db.update(payees)
    .set({
      name,
      normalizedName: normalizeName(name),
      updatedAt: now(),
    })
    .where(eq(payees.id, id))
    .run();

  return getPayee(id);
}

export function deletePayee(id: string) {
  getPayee(id);

  const usage = db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.payeeId, id))
    .get();
  const recurringUsage = db
    .select({ id: recurringTransactions.id })
    .from(recurringTransactions)
    .where(eq(recurringTransactions.payeeId, id))
    .get();

  if (usage || recurringUsage) {
    badRequest("Favorecido em uso nao pode ser excluido.");
  }

  db.delete(payees)
    .where(or(eq(payees.id, id)))
    .run();
}
