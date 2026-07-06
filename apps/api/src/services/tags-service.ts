import type { CreateTagInput, UpdateTagInput } from "@finance/shared";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { tags, transactions, transactionTags } from "../db/schema";
import { badRequest, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";
import { ensureHouseholdExists } from "./common-service";

export function listTags(householdId: string) {
  ensureHouseholdExists(householdId);

  return db.select().from(tags).where(eq(tags.householdId, householdId)).all();
}

export function getTag(householdId: string, id: string) {
  const tag = db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.householdId, householdId)))
    .get();

  if (!tag) {
    notFound("Tag nao encontrada nesta casa.");
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

  return getTag(input.householdId, id);
}

export function updateTag(householdId: string, id: string, input: UpdateTagInput) {
  const tag = getTag(householdId, id);

  db.update(tags)
    .set({
      name: input.name ?? tag.name,
      color: input.color === undefined ? tag.color : input.color,
      updatedAt: now(),
    })
    .where(eq(tags.id, id))
    .run();

  return getTag(householdId, id);
}

export function deleteTag(householdId: string, id: string) {
  getTag(householdId, id);

  const usage = db
    .select({ transactionId: transactionTags.transactionId })
    .from(transactionTags)
    .innerJoin(transactions, eq(transactionTags.transactionId, transactions.id))
    .where(and(eq(transactionTags.tagId, id), isNull(transactions.deletedAt)))
    .get();

  if (usage) {
    badRequest("Tag em uso nao pode ser excluida.");
  }

  db.delete(tags).where(eq(tags.id, id)).run();
}
