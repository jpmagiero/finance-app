import { idSchema, monthlyDashboardSchema, monthStringSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getMonthlyDashboard } from "../services/dashboard-service";

const monthlyDashboardQuerySchema = z.object({
  householdId: idSchema,
  month: monthStringSchema,
});

export const dashboardRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/monthly",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Retorna resumo mensal de receitas, despesas e categorias",
        querystring: monthlyDashboardQuerySchema,
        response: { 200: monthlyDashboardSchema },
      },
    },
    async (request) => getMonthlyDashboard(request.query.householdId, request.query.month),
  );
};
