import { householdOverviewSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { getCurrentHousehold } from "../services/households-service";

export const householdRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/current",
    {
      schema: {
        tags: ["Households"],
        summary: "Retorna a primeira casa cadastrada e seus dados basicos",
        response: { 200: householdOverviewSchema },
      },
    },
    async () => getCurrentHousehold(),
  );
};
