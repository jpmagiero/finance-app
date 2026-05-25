import { updateSettingsSchema } from "@finance/shared";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { households, settings } from "../db/schema";
import { handleRouteError, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";

const settingsParamsSchema = z.object({
  householdId: z.string().min(1),
});

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/:householdId", async (request, reply) => {
    try {
      const params = settingsParamsSchema.parse(request.params);
      const householdSettings = db
        .select()
        .from(settings)
        .where(eq(settings.householdId, params.householdId))
        .get();

      if (!householdSettings) {
        notFound("Configuracoes nao encontradas.");
      }

      return householdSettings;
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.put("/:householdId", async (request, reply) => {
    try {
      const params = settingsParamsSchema.parse(request.params);
      const input = updateSettingsSchema.parse(request.body);
      const household = db
        .select()
        .from(households)
        .where(eq(households.id, params.householdId))
        .get();

      if (!household) {
        notFound("Casa nao encontrada.");
      }

      const existingSettings = db
        .select()
        .from(settings)
        .where(eq(settings.householdId, params.householdId))
        .get();

      if (!existingSettings) {
        db.insert(settings)
          .values({
            id: createId(),
            householdId: params.householdId,
            ...input,
          })
          .run();
      } else {
        db.update(settings)
          .set({
            ...input,
            updatedAt: now(),
          })
          .where(eq(settings.householdId, params.householdId))
          .run();
      }

      return db.select().from(settings).where(eq(settings.householdId, params.householdId)).get();
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });
};
