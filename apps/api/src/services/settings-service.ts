import type { UpdateSettingsInput } from "@finance/shared";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { settings } from "../db/schema";
import { notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";
import { ensureHouseholdExists } from "./common-service";

export function getSettings(householdId: string) {
  ensureHouseholdExists(householdId);

  const householdSettings = db
    .select()
    .from(settings)
    .where(eq(settings.householdId, householdId))
    .get();

  if (!householdSettings) {
    notFound("Configuracoes nao encontradas.");
  }

  return householdSettings;
}

export function upsertSettings(householdId: string, input: UpdateSettingsInput) {
  ensureHouseholdExists(householdId);

  const existingSettings = db
    .select()
    .from(settings)
    .where(eq(settings.householdId, householdId))
    .get();

  if (!existingSettings) {
    db.insert(settings)
      .values({
        id: createId(),
        householdId,
        ...input,
      })
      .run();
  } else {
    db.update(settings)
      .set({
        ...input,
        updatedAt: now(),
      })
      .where(eq(settings.householdId, householdId))
      .run();
  }

  return getSettings(householdId);
}
