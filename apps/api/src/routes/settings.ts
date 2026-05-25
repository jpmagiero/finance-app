import { updateSettingsSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { genericObjectResponseSchema, householdIdParamSchema } from "../lib/docs";
import { handleRouteError } from "../lib/http";
import { getSettings, upsertSettings } from "../services/settings-service";

const settingsParamsSchema = z.object({
  householdId: z.string().min(1),
});

const settingsBodySchema = {
  type: "object",
  properties: {
    currency: { type: "string", minLength: 3, maxLength: 3 },
    timezone: { type: "string", minLength: 1, maxLength: 80 },
    locale: { type: "string", minLength: 2, maxLength: 20 },
    monthlyPeriodStartDay: { type: "integer", minimum: 1, maximum: 28 },
    includePendingInReports: { type: "boolean" },
  },
} as const;

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/:householdId",
    {
      schema: {
        tags: ["Settings"],
        summary: "Retorna configuracoes de uma casa",
        params: householdIdParamSchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = settingsParamsSchema.parse(request.params);

        return getSettings(params.householdId);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.put(
    "/:householdId",
    {
      schema: {
        tags: ["Settings"],
        summary: "Atualiza configuracoes de uma casa",
        params: householdIdParamSchema,
        body: settingsBodySchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = settingsParamsSchema.parse(request.params);
        const input = updateSettingsSchema.parse(request.body);

        return upsertSettings(params.householdId, input);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
