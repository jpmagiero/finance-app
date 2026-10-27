import type { FastifyPluginAsync } from "fastify";
import { genericObjectResponseSchema } from "../lib/docs";
import { currentHousehold } from "../services/households-service";
export const householdRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/current",
    {
      schema: {
        tags: ["Households"],
        summary: "Retorna a casa autorizada da sessao",
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request) => currentHousehold(request.identity.householdId, request.identity.userId),
  );
};
