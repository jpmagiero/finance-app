import { monthStringSchema } from "@finance/shared";
import { and, eq, gte, isNull, lte, not } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { categories, settings, transactionSplits, transactions } from "../db/schema";
import { genericObjectResponseSchema, monthStringProperty } from "../lib/docs";
import { handleRouteError } from "../lib/http";

const monthlyDashboardQuerySchema = z.object({
  householdId: z.string().min(1),
  month: monthStringSchema,
});

function monthRange(month: string) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  const start = `${month}-01`;
  const endDate = new Date(Date.UTC(year, monthIndex, 0));
  const end = endDate.toISOString().slice(0, 10);

  return { start, end };
}

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/monthly",
    {
      schema: {
        tags: ["Dashboard"],
        summary: "Retorna resumo mensal de receitas, despesas e categorias",
        querystring: {
          type: "object",
          required: ["householdId", "month"],
          properties: {
            householdId: { type: "string" },
            month: monthStringProperty,
          },
        },
        response: {
          200: genericObjectResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const query = monthlyDashboardQuerySchema.parse(request.query);
        const { start, end } = monthRange(query.month);
        const householdSettings = db
          .select()
          .from(settings)
          .where(eq(settings.householdId, query.householdId))
          .get();

        const statusConditions = householdSettings?.includePendingInReports
          ? not(eq(transactions.status, "canceled"))
          : eq(transactions.status, "confirmed");

        const rows = db
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.householdId, query.householdId),
              isNull(transactions.deletedAt),
              statusConditions,
              gte(transactions.transactionDate, start),
              lte(transactions.transactionDate, end),
            ),
          )
          .all();

        const transactionIds = new Set(rows.map((transaction) => transaction.id));
        const splitRows = db.select().from(transactionSplits).all();
        const categoryRows = db
          .select()
          .from(categories)
          .where(eq(categories.householdId, query.householdId))
          .all();
        const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
        const categoryTotals = new Map<string, number>();

        for (const split of splitRows) {
          if (!transactionIds.has(split.transactionId) || !split.categoryId) {
            continue;
          }

          categoryTotals.set(
            split.categoryId,
            (categoryTotals.get(split.categoryId) ?? 0) + split.amountCents,
          );
        }

        const incomeCents = rows
          .filter((transaction) => transaction.type === "income")
          .reduce((total, transaction) => total + transaction.amountCents, 0);
        const expenseCents = rows
          .filter((transaction) => transaction.type === "expense")
          .reduce((total, transaction) => total + transaction.amountCents, 0);

        return {
          month: query.month,
          incomeCents,
          expenseCents,
          balanceCents: incomeCents - expenseCents,
          transactionCount: rows.length,
          categories: [...categoryTotals.entries()].map(([categoryId, amountCents]) => ({
            category: categoryById.get(categoryId),
            amountCents,
          })),
        };
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
