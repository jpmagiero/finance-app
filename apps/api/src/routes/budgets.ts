import { budgetInputSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { dateStringProperty, idParamSchema, nullableStringProperty } from "../lib/docs";
import {
  archiveBudget,
  budgetSummary,
  createBudget,
  getBudget,
  listBudgets,
  restoreBudget,
  updateBudget,
} from "../services/budgets-service";

const money = {
  type: "integer",
  minimum: Number.MIN_SAFE_INTEGER,
  maximum: Number.MAX_SAFE_INTEGER,
} as const;
const limit = { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER } as const;
const itemProperties = { categoryId: { type: "string", minLength: 1 }, limitCents: limit } as const;
const properties = {
  householdId: { type: "string", minLength: 1 },
  personId: nullableStringProperty,
  name: { type: "string", minLength: 1, maxLength: 120 },
  period: { type: "string", enum: ["monthly", "yearly", "custom"] },
  startsAt: dateStringProperty,
  endsAt: dateStringProperty,
  currency: { type: "string", pattern: "^[A-Z]{3}$" },
  items: {
    type: "array",
    minItems: 1,
    maxItems: 100,
    items: { type: "object", required: ["categoryId", "limitCents"], properties: itemProperties },
  },
} as const;
const bodySchema = {
  type: "object",
  required: ["householdId", "name", "period", "startsAt", "endsAt", "currency", "items"],
  properties,
} as const;
const responseSchema = {
  type: "object",
  properties: {
    ...properties,
    id: { type: "string" },
    isArchived: { type: "boolean" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;
const amountProperties = {
  confirmedCents: money,
  pendingCents: money,
  committedCents: money,
} as const;
const remainingProperties = { remainingCents: money, exceededCents: money } as const;
const summarySchema = {
  type: "object",
  properties: {
    budget: responseSchema,
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ...itemProperties,
          categoryName: { type: "string" },
          ...amountProperties,
          ...remainingProperties,
        },
      },
    },
    unbudgeted: {
      type: "array",
      items: {
        type: "object",
        properties: {
          categoryId: nullableStringProperty,
          categoryName: { type: "string" },
          ...amountProperties,
        },
      },
    },
    totals: {
      type: "object",
      properties: { limitCents: money, ...amountProperties, ...remainingProperties },
    },
    unbudgetedCents: money,
    excludedCurrencyCount: { type: "integer", minimum: 0 },
  },
} as const;
const listQuery = z.object({ includeArchived: z.enum(["true", "false"]).optional() });
export const budgetRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Budgets"],
        summary: "Lista orcamentos da casa autenticada",
        querystring: {
          type: "object",
          properties: { includeArchived: { type: "string", enum: ["true", "false"] } },
        },
        response: { 200: { type: "array", items: responseSchema } },
      },
    },
    async (request) =>
      listBudgets(
        request.identity.householdId,
        listQuery.parse(request.query).includeArchived === "true",
      ),
  );
  app.get(
    "/:id",
    { schema: { tags: ["Budgets"], params: idParamSchema, response: { 200: responseSchema } } },
    async (request) => getBudget((request.params as { id: string }).id),
  );
  app.get(
    "/:id/summary",
    {
      schema: {
        tags: ["Budgets"],
        params: idParamSchema,
        summary: "Consumo por splits: confirmado, pendente, disponivel e sem limite",
        response: { 200: summarySchema },
      },
    },
    async (request) => budgetSummary((request.params as { id: string }).id),
  );
  app.post(
    "/",
    { schema: { tags: ["Budgets"], body: bodySchema, response: { 201: responseSchema } } },
    async (request, reply) =>
      reply.code(201).send(createBudget(budgetInputSchema.parse(request.body))),
  );
  app.put(
    "/:id",
    {
      schema: {
        tags: ["Budgets"],
        params: idParamSchema,
        body: bodySchema,
        response: { 200: responseSchema },
      },
    },
    async (request) =>
      updateBudget((request.params as { id: string }).id, budgetInputSchema.parse(request.body)),
  );
  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Budgets"],
        params: idParamSchema,
        summary: "Arquiva sem alterar lancamentos",
        response: { 204: { type: "null" } },
      },
    },
    async (request, reply) => {
      archiveBudget((request.params as { id: string }).id);
      return reply.code(204).send();
    },
  );
  app.post(
    "/:id/restore",
    { schema: { tags: ["Budgets"], params: idParamSchema, response: { 200: responseSchema } } },
    async (request) => restoreBudget((request.params as { id: string }).id),
  );
};
