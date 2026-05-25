import type { CreatePersonInput, UpdatePersonInput } from "@finance/shared";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { householdPeople } from "../db/schema";
import { notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";
import { ensureHouseholdExists, ensureUserExists } from "./common-service";

export function listPeople(householdId: string) {
  ensureHouseholdExists(householdId);

  return db
    .select()
    .from(householdPeople)
    .where(eq(householdPeople.householdId, householdId))
    .all();
}

export function getPerson(id: string) {
  const person = db.select().from(householdPeople).where(eq(householdPeople.id, id)).get();

  if (!person) {
    notFound("Pessoa nao encontrada.");
  }

  return person;
}

export function createPerson(input: CreatePersonInput) {
  ensureHouseholdExists(input.householdId);

  if (input.userId) {
    ensureUserExists(input.userId);
  }

  const id = createId();

  db.insert(householdPeople)
    .values({
      id,
      householdId: input.householdId,
      userId: input.userId ?? null,
      name: input.name,
      color: input.color ?? null,
      avatarUrl: input.avatarUrl ?? null,
    })
    .run();

  return getPerson(id);
}

export function updatePerson(id: string, input: UpdatePersonInput) {
  const person = getPerson(id);

  if (input.userId) {
    ensureUserExists(input.userId);
  }

  db.update(householdPeople)
    .set({
      userId: input.userId ?? person.userId,
      name: input.name ?? person.name,
      color: input.color === undefined ? person.color : input.color,
      avatarUrl: input.avatarUrl === undefined ? person.avatarUrl : input.avatarUrl,
      updatedAt: now(),
    })
    .where(eq(householdPeople.id, id))
    .run();

  return getPerson(id);
}

export function archivePerson(id: string) {
  getPerson(id);

  db.update(householdPeople)
    .set({
      isActive: false,
      updatedAt: now(),
    })
    .where(eq(householdPeople.id, id))
    .run();
}
