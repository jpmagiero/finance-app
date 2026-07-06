import { randomUUID } from "node:crypto";
import { type CreateTransactionInput, createTransactionSchema } from "@finance/shared";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../db";
import {
  accounts,
  categories,
  householdPeople,
  households,
  payees,
  settings,
  tags,
  users,
} from "../db/schema";
import { normalizeName } from "../lib/normalize";

// Fixtures inserem direto via db (nao ha service de criacao de household) e
// usam ids/nomes unicos por teste para isolar sem truncar tabelas.

export function createTestHousehold(name = "Casa Teste") {
  const householdId = randomUUID();

  db.insert(households)
    .values({ id: householdId, name: `${name} ${householdId.slice(0, 8)}` })
    .run();
  db.insert(settings).values({ id: randomUUID(), householdId }).run();

  return householdId;
}

export function createTestAccount(
  householdId: string,
  overrides: Partial<typeof accounts.$inferInsert> = {},
) {
  const id = randomUUID();
  const initialBalanceCents = overrides.initialBalanceCents ?? 0;

  db.insert(accounts)
    .values({
      id,
      householdId,
      name: `Conta ${id.slice(0, 8)}`,
      type: "checking",
      currency: "BRL",
      ...overrides,
      initialBalanceCents,
      currentBalanceCents: overrides.currentBalanceCents ?? initialBalanceCents,
    })
    .run();

  const account = db.select().from(accounts).where(eq(accounts.id, id)).get();

  if (!account) {
    throw new Error("Fixture de conta falhou.");
  }

  return account;
}

export function createTestPerson(
  householdId: string,
  overrides: Partial<typeof householdPeople.$inferInsert> = {},
) {
  const id = randomUUID();

  db.insert(householdPeople)
    .values({
      id,
      householdId,
      name: `Pessoa ${id.slice(0, 8)}`,
      ...overrides,
    })
    .run();

  const person = db.select().from(householdPeople).where(eq(householdPeople.id, id)).get();

  if (!person) {
    throw new Error("Fixture de pessoa falhou.");
  }

  return person;
}

export function createTestCategory(
  householdId: string,
  overrides: Partial<typeof categories.$inferInsert> = {},
) {
  const id = randomUUID();

  db.insert(categories)
    .values({
      id,
      householdId,
      name: `Categoria ${id.slice(0, 8)}`,
      type: "expense",
      ...overrides,
    })
    .run();

  const category = db.select().from(categories).where(eq(categories.id, id)).get();

  if (!category) {
    throw new Error("Fixture de categoria falhou.");
  }

  return category;
}

export function createTestTag(
  householdId: string,
  overrides: Partial<typeof tags.$inferInsert> = {},
) {
  const id = randomUUID();

  db.insert(tags)
    .values({
      id,
      householdId,
      name: `Tag ${id.slice(0, 8)}`,
      ...overrides,
    })
    .run();

  const tag = db.select().from(tags).where(eq(tags.id, id)).get();

  if (!tag) {
    throw new Error("Fixture de tag falhou.");
  }

  return tag;
}

export function createTestPayee(householdId: string, name?: string) {
  const id = randomUUID();
  const payeeName = name ?? `Favorecido ${id.slice(0, 8)}`;

  db.insert(payees)
    .values({
      id,
      householdId,
      name: payeeName,
      normalizedName: normalizeName(payeeName),
    })
    .run();

  const payee = db.select().from(payees).where(eq(payees.id, id)).get();

  if (!payee) {
    throw new Error("Fixture de favorecido falhou.");
  }

  return payee;
}

export function createTestUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const id = randomUUID();

  db.insert(users)
    .values({
      id,
      name: `Usuario ${id.slice(0, 8)}`,
      email: `user-${id}@teste.dev`,
      ...overrides,
    })
    .run();

  const user = db.select().from(users).where(eq(users.id, id)).get();

  if (!user) {
    throw new Error("Fixture de usuario falhou.");
  }

  return user;
}

export function accountBalance(accountId: string) {
  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();

  if (!account) {
    throw new Error(`Conta ${accountId} nao encontrada no teste.`);
  }

  return account.currentBalanceCents;
}

type CreateTransactionRaw = z.input<typeof createTransactionSchema>;

// Monta o input passando pelo schema do shared: aplica defaults (status,
// tagIds) e garante que o proprio teste nao envia payload invalido sem querer.
export function buildTransactionInput(
  overrides: Partial<CreateTransactionRaw> & Pick<CreateTransactionRaw, "householdId">,
): CreateTransactionInput {
  const amountCents = overrides.amountCents ?? 1000;

  return createTransactionSchema.parse({
    type: "expense",
    status: "confirmed",
    transactionDate: "2026-01-15",
    amountCents,
    splits: [{ amountCents }],
    tagIds: [],
    ...overrides,
  });
}
