import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { householdMembers, householdPeople, households, settings } from "../db/schema";
import { notFound } from "../lib/http";

export function currentHousehold(householdId: string, userId: string) {
  const membership = db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
    .get();
  const household = db.select().from(households).where(eq(households.id, householdId)).get();
  if (!membership || !household) notFound();
  return {
    household,
    settings: db.select().from(settings).where(eq(settings.householdId, householdId)).get(),
    people: db
      .select()
      .from(householdPeople)
      .where(eq(householdPeople.householdId, householdId))
      .all(),
    // Do not expose unrelated users or password hashes.
    members: db
      .select({
        id: householdMembers.id,
        userId: householdMembers.userId,
        role: householdMembers.role,
      })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, householdId))
      .all(),
  };
}
