import { eq } from "drizzle-orm";
import { db } from "../db";
import { accounts, categories, householdPeople } from "../db/schema";
import { notFound } from "../lib/http";
import { now } from "../lib/normalize";

export function restoreResource(resource: "people" | "accounts" | "categories", id: string) {
  if (resource === "people") {
    if (!db.select().from(householdPeople).where(eq(householdPeople.id, id)).get()) notFound();
    db.update(householdPeople)
      .set({ isActive: true, updatedAt: now() })
      .where(eq(householdPeople.id, id))
      .run();
    return;
  }
  const table = resource === "accounts" ? accounts : categories;
  if (!db.select().from(table).where(eq(table.id, id)).get()) notFound();
  db.update(table).set({ isArchived: false, updatedAt: now() }).where(eq(table.id, id)).run();
}
