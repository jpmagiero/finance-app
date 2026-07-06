import { settingsSchema, updateSettingsSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { householdParamsSchema } from "../lib/route-schemas";
import { getSettings, upsertSettings } from "../services/settings-service";

export const settingsRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/:householdId",
    {
      schema: {
        tags: ["Settings"],
        summary: "Retorna configuracoes de uma casa",
        params: householdParamsSchema,
        response: { 200: settingsSchema },
      },
    },
    async (request) => getSettings(request.params.householdId),
  );

  app.put(
    "/:householdId",
    {
      schema: {
        tags: ["Settings"],
        summary: "Atualiza configuracoes de uma casa",
        params: householdParamsSchema,
        body: updateSettingsSchema,
        response: { 200: settingsSchema },
      },
    },
    async (request) => upsertSettings(request.params.householdId, request.body),
  );
};
