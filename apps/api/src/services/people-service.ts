import type { CreatePersonInput, UpdatePersonInput } from "@finance/shared";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../db";
import { householdMembers, householdPeople } from "../db/schema";
import { badRequest, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";
import { ensureHouseholdExists, ensureUserExists } from "./common-service";

export function listPeople(householdId: string, includeInactive = false) {
  ensureHouseholdExists(householdId);

  return db
    .select()
    .from(householdPeople)
    .where(
      and(
        eq(householdPeople.householdId, householdId),
        includeInactive ? undefined : eq(householdPeople.isActive, true),
      ),
    )
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
    ensurePersonUserLink(input.userId, input.householdId);
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
    ensurePersonUserLink(input.userId, person.householdId, id);
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

function ensurePersonUserLink(userId: string, householdId: string, personId?: string) {
  ensureUserExists(userId);
  if (
    !db
      .select()
      .from(householdMembers)
      .where(
        and(eq(householdMembers.userId, userId), eq(householdMembers.householdId, householdId)),
      )
      .get()
  )
    notFound("Usuario nao pertence a esta casa.");
  if (
    db
      .select()
      .from(householdPeople)
      .where(
        and(
          eq(householdPeople.householdId, householdId),
          eq(householdPeople.userId, userId),
          personId ? ne(householdPeople.id, personId) : undefined,
        ),
      )
      .get()
  )
    badRequest("Usuario ja vinculado a outra pessoa da casa.");
}
