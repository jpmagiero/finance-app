import { recurrenceRangeSchema, recurringInputSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import { dateStringProperty, idParamSchema, nullableStringProperty } from "../lib/docs";
import {
  createRecurring,
  generateRecurring,
  getRecurring,
  listRecurring,
  previewRecurring,
  setRecurringActive,
  updateRecurring,
} from "../services/recurring-service";
import { transactionBodySchema } from "./transactions";

const {
  transactionDate: _date,
  competenceDate: _competence,
  status: _status,
  transferAccountId: _destination,
  ...templateProperties
} = transactionBodySchema.properties;
const properties = {
  ...templateProperties,
  type: { type: "string", enum: ["income", "expense"] },
  frequency: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"] },
  interval: { type: "integer", minimum: 1, maximum: 120, default: 1 },
  startsAt: dateStringProperty,
  endsAt: { ...dateStringProperty, nullable: true },
  isActive: { type: "boolean", default: true },
} as const;
const bodySchema = {
  type: "object",
  required: ["householdId", "type", "amountCents", "splits", "frequency", "startsAt"],
  properties,
} as const;
const responseSchema = {
  type: "object",
  properties: {
    ...properties,
    id: { type: "string" },
    description: nullableStringProperty,
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;
const rangeSchema = {
  type: "object",
  required: ["from", "to"],
  properties: { from: dateStringProperty, to: dateStringProperty },
} as const;
const previewSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      date: dateStringProperty,
      transactionId: nullableStringProperty,
      deleted: { type: "boolean" },
    },
  },
} as const;
export const recurringRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Recurring"],
        summary: "Lista recorrencias da casa autenticada",
        response: { 200: { type: "array", items: responseSchema } },
      },
    },
    async (request) => listRecurring(request.identity.householdId),
  );
  app.get(
    "/:id",
    { schema: { tags: ["Recurring"], params: idParamSchema, response: { 200: responseSchema } } },
    async (request) => getRecurring((request.params as { id: string }).id),
  );
  app.post(
    "/",
    { schema: { tags: ["Recurring"], body: bodySchema, response: { 201: responseSchema } } },
    async (request, reply) =>
      reply.code(201).send(createRecurring(recurringInputSchema.parse(request.body))),
  );
  app.put(
    "/:id",
    {
      schema: {
        tags: ["Recurring"],
        params: idParamSchema,
        body: bodySchema,
        response: { 200: responseSchema },
      },
    },
    async (request) =>
      updateRecurring(
        (request.params as { id: string }).id,
        recurringInputSchema.parse(request.body),
      ),
  );
  app.patch(
    "/:id/active",
    {
      schema: {
        tags: ["Recurring"],
        params: idParamSchema,
        body: {
          type: "object",
          required: ["isActive"],
          additionalProperties: false,
          properties: { isActive: { type: "boolean" } },
        },
        response: { 200: responseSchema },
      },
    },
    async (request) =>
      setRecurringActive(
        (request.params as { id: string }).id,
        (request.body as { isActive: boolean }).isActive,
      ),
  );
  app.post(
    "/:id/preview",
    {
      schema: {
        tags: ["Recurring"],
        params: idParamSchema,
        body: rangeSchema,
        response: { 200: previewSchema },
      },
    },
    async (request) =>
      previewRecurring(
        (request.params as { id: string }).id,
        recurrenceRangeSchema.parse(request.body),
      ),
  );
  app.post(
    "/:id/generate",
    {
      schema: {
        tags: ["Recurring"],
        params: idParamSchema,
        body: rangeSchema,
        summary: "Gera pendentes sem duplicar; inclui exclusoes no controle de ocorrencias",
        response: {
          200: {
            type: "object",
            properties: {
              created: { type: "integer" },
              skipped: { type: "integer" },
              transactionIds: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    async (request) =>
      generateRecurring(
        (request.params as { id: string }).id,
        recurrenceRangeSchema.parse(request.body),
        request.identity.userId,
      ),
  );
};
