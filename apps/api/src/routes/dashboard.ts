import { monthStringSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { genericObjectResponseSchema, monthStringProperty } from "../lib/docs";
import { monthlyDashboard } from "../services/dashboard-service";

const querySchema = z.object({
  householdId: z.string().min(1),
  month: monthStringSchema,
  personId: z.string().min(1).optional(),
});
export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/monthly",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Resumo do periodo financeiro por casa/pessoa",
        description:
          "Usa transactionDate e monthlyPeriodStartDay. Categorias incluem apenas despesas; sem categoria tem category=null. Totais confirmados e pendentes separados. personId=unassigned filtra lancamentos da casa.",
        querystring: {
          type: "object",
          required: ["householdId", "month"],
          properties: {
            householdId: { type: "string" },
            month: monthStringProperty,
            personId: { type: "string" },
          },
        },
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request) => monthlyDashboard(querySchema.parse(request.query)),
  );
};
