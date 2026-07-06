import type { CreatePersonInput, UpdatePersonInput } from "@finance/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { householdPeople } from "../db/schema";
import { notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";
import { ensureHouseholdExists, ensureUserBelongsToHousehold } from "./common-service";

export function listPeople(householdId: string) {
  ensureHouseholdExists(householdId);

  return db
    .select()
    .from(householdPeople)
    .where(eq(householdPeople.householdId, householdId))
    .all();
}

export function getPerson(householdId: string, id: string) {
  const person = db
    .select()
    .from(householdPeople)
    .where(and(eq(householdPeople.id, id), eq(householdPeople.householdId, householdId)))
    .get();

  if (!person) {
    notFound("Pessoa nao encontrada nesta casa.");
  }

  return person;
}

export function createPerson(input: CreatePersonInput) {
  ensureHouseholdExists(input.householdId);

  if (input.userId) {
    ensureUserBelongsToHousehold(input.userId, input.householdId);
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

  return getPerson(input.householdId, id);
}

export function updatePerson(householdId: string, id: string, input: UpdatePersonInput) {
  const person = getPerson(householdId, id);

  if (input.userId) {
    ensureUserBelongsToHousehold(input.userId, householdId);
  }

  db.update(householdPeople)
    .set({
      userId: input.userId === undefined ? person.userId : input.userId,
      name: input.name ?? person.name,
      color: input.color === undefined ? person.color : input.color,
      avatarUrl: input.avatarUrl === undefined ? person.avatarUrl : input.avatarUrl,
      updatedAt: now(),
    })
    .where(eq(householdPeople.id, id))
    .run();

  return getPerson(householdId, id);
}

export function archivePerson(householdId: string, id: string) {
  getPerson(householdId, id);

  db.update(householdPeople)
    .set({
      isActive: false,
      updatedAt: now(),
    })
    .where(eq(householdPeople.id, id))
    .run();
}
