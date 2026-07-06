import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { householdMembers, householdPeople, households, users } from "../db/schema";
import { notFound } from "../lib/http";

export function ensureHouseholdExists(householdId: string) {
  const household = db.select().from(households).where(eq(households.id, householdId)).get();

  if (!household) {
    notFound("Casa nao encontrada.");
  }

  return household;
}

export function ensureUserExists(userId: string) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();

  if (!user) {
    notFound("Usuario nao encontrado.");
  }

  return user;
}

// Vinculo pessoa-usuario exige adesao previa do usuario a casa: referencia a
// usuario de outra casa (ou sem casa) e cross-tenant e nao pode ser persistida.
export function ensureUserBelongsToHousehold(userId: string, householdId: string) {
  ensureUserExists(userId);

  const member = db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.userId, userId), eq(householdMembers.householdId, householdId)))
    .get();

  if (!member) {
    notFound("Usuario nao e membro desta casa.");
  }

  return member;
}

export function ensurePersonBelongsToHousehold(personId: string, householdId: string) {
  const person = db.select().from(householdPeople).where(eq(householdPeople.id, personId)).get();

  if (!person || person.householdId !== householdId) {
    notFound("Pessoa nao encontrada nesta casa.");
  }

  return person;
}
