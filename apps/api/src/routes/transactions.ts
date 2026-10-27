import { createTransactionSchema, dateStringSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  dateStringProperty,
  genericArrayResponseSchema,
  genericObjectResponseSchema,
  idParamSchema,
  nullableStringProperty,
} from "../lib/docs";
import { handleRouteError } from "../lib/http";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactionPage,
  listTransactions,
  updateTransaction,
} from "../services/transactions-service";

const listTransactionsQuerySchema = z
  .object({
    householdId: z.string().min(1),
    personId: z.string().min(1).optional(),
    accountId: z.string().min(1).optional(),
    type: z.enum(["income", "expense", "transfer", "adjustment"]).optional(),
    status: z.enum(["pending", "confirmed", "canceled"]).optional(),
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
    page: z.coerce.number().int().min(1).max(1000000).optional(),
    search: z.string().trim().max(180).optional(),
    categoryId: z.string().min(1).optional(),
    tagId: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "A data inicial deve ser menor ou igual a final.",
    path: ["to"],
  });

const idParamsSchema = z.object({
  id: z.string().min(1),
});

export const transactionBodySchema = {
  type: "object",
  required: ["householdId", "type", "amountCents", "transactionDate", "splits"],
  properties: {
    householdId: { type: "string" },
    personId: nullableStringProperty,
    accountId: nullableStringProperty,
    payeeId: nullableStringProperty,
    type: { type: "string", enum: ["income", "expense", "transfer"] },
    status: {
      type: "string",
      enum: ["pending", "confirmed", "canceled"],
      default: "confirmed",
    },
    amountCents: { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
    description: nullableStringProperty,
    notes: nullableStringProperty,
    transactionDate: dateStringProperty,
    competenceDate: { ...dateStringProperty, nullable: true },
    transferAccountId: nullableStringProperty,
    splits: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["amountCents"],
        properties: {
          categoryId: nullableStringProperty,
          amountCents: { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
          description: nullableStringProperty,
        },
      },
    },
    tagIds: {
      type: "array",
      items: { type: "string" },
      default: [],
    },
  },
} as const;

export const transactionRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Lista transacoes de uma casa",
        description:
          "Datas validas; from <= to. page ativa resposta {items,total,page,pageSize}; sem page retorna array. Conta inclui transferencias recebidas. personId=unassigned filtra casa.",
        querystring: {
          type: "object",
          required: ["householdId"],
          properties: {
            householdId: { type: "string" },
            personId: { type: "string" },
            accountId: { type: "string" },
            type: { type: "string", enum: ["income", "expense", "transfer", "adjustment"] },
            status: { type: "string", enum: ["pending", "confirmed", "canceled"] },
            from: dateStringProperty,
            to: dateStringProperty,
            page: { type: "integer", minimum: 1, maximum: 1000000 },
            search: { type: "string", maxLength: 180 },
            categoryId: { type: "string" },
            tagId: { type: "string" },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          },
        },
        response: { 200: { anyOf: [genericArrayResponseSchema, genericObjectResponseSchema] } },
      },
    },
    async (request, reply) => {
      try {
        const query = listTransactionsQuerySchema.parse(request.query);

        return query.page === undefined ? listTransactions(query) : listTransactionPage(query);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Busca uma transacao com splits e tags",
        params: idParamSchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);

        return getTransaction(params.id);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Cria uma transacao",
        body: transactionBodySchema,
        response: { 201: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const input = createTransactionSchema.parse(request.body);

        return reply.status(201).send(createTransaction(input, request.identity.userId));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Atualiza uma transacao e recalcula impacto no saldo",
        params: idParamSchema,
        body: transactionBodySchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);
        const input = createTransactionSchema.parse(request.body);

        return updateTransaction(params.id, input);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Remove uma transacao com soft delete",
        params: idParamSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);
        deleteTransaction(params.id);

        return reply.status(204).send();
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
