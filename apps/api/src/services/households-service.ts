import { eq } from "drizzle-orm";
import { db } from "../db";
import { householdMembers, householdPeople, households, settings } from "../db/schema";
import { notFound } from "../lib/http";

// Limitacao conhecida: enquanto nao ha auth/onboarding, a "casa atual" e a
// primeira casa cadastrada no banco.
export function getCurrentHousehold() {
  const household = db.select().from(households).limit(1).get();

  if (!household) {
    notFound("Nenhuma casa cadastrada.");
  }

  const householdSettings = db
    .select()
    .from(settings)
    .where(eq(settings.householdId, household.id))
    .get();

  const people = db
    .select()
    .from(householdPeople)
    .where(eq(householdPeople.householdId, household.id))
    .all();

  const members = db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.householdId, household.id))
    .all();

  return {
    household,
    settings: householdSettings ?? null,
    people,
    members,
  };
}
