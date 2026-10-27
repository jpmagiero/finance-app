import type { CreateTagInput, UpdateTagInput } from "@finance/shared";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { recurringTags, tags, transactionTags } from "../db/schema";
import { badRequest, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";
import { ensureHouseholdExists } from "./common-service";

export function listTags(householdId: string) {
  ensureHouseholdExists(householdId);

  return db.select().from(tags).where(eq(tags.householdId, householdId)).all();
}

export function getTag(id: string) {
  const tag = db.select().from(tags).where(eq(tags.id, id)).get();

  if (!tag) {
    notFound("Tag nao encontrada.");
  }

  return tag;
}

export function createTag(input: CreateTagInput) {
  ensureHouseholdExists(input.householdId);

  const id = createId();

  db.insert(tags)
    .values({
      id,
      householdId: input.householdId,
      name: input.name,
      color: input.color ?? null,
    })
    .run();

  return getTag(id);
}

export function updateTag(id: string, input: UpdateTagInput) {
  const tag = getTag(id);

  db.update(tags)
    .set({
      name: input.name ?? tag.name,
      color: input.color === undefined ? tag.color : input.color,
      updatedAt: now(),
    })
    .where(eq(tags.id, id))
    .run();

  return getTag(id);
}

export function deleteTag(id: string) {
  getTag(id);

  const usage = db
    .select({ transactionId: transactionTags.transactionId })
    .from(transactionTags)
    .where(eq(transactionTags.tagId, id))
    .get();

  if (usage || db.select().from(recurringTags).where(eq(recurringTags.tagId, id)).get()) {
    badRequest("Tag em uso nao pode ser excluida.");
  }

  db.delete(tags).where(eq(tags.id, id)).run();
}
