import {
  createTransactionSchema,
  dateStringSchema,
  idSchema,
  transactionSchema,
  transactionStatuses,
  transactionTypes,
  transactionWithDetailsSchema,
  updateTransactionSchema,
} from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  householdQuerySchema,
  idParamsSchema,
  noContentResponseSchema,
} from "../lib/route-schemas";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "../services/transactions-service";

const listTransactionsQuerySchema = z.object({
  householdId: idSchema,
  personId: idSchema.optional(),
  accountId: idSchema.optional(),
  type: z.enum(transactionTypes).optional(),
  status: z.enum(transactionStatuses).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const transactionRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Lista transacoes de uma casa",
        querystring: listTransactionsQuerySchema,
        response: { 200: z.array(transactionSchema) },
      },
    },
    async (request) => listTransactions(request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Busca uma transacao com splits e tags",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        response: { 200: transactionWithDetailsSchema },
      },
    },
    async (request) => getTransaction(request.query.householdId, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Cria uma transacao",
        body: createTransactionSchema,
        response: { 201: transactionWithDetailsSchema },
      },
    },
    async (request, reply) => reply.status(201).send(createTransaction(request.body)),
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Atualiza uma transacao e recalcula impacto no saldo",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        body: updateTransactionSchema,
        response: { 200: transactionWithDetailsSchema },
      },
    },
    async (request) =>
      updateTransaction(request.query.householdId, request.params.id, request.body),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Remove uma transacao com soft delete",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        response: { 204: noContentResponseSchema },
      },
    },
    async (request, reply) => {
      deleteTransaction(request.query.householdId, request.params.id);

      return reply.status(204).send(null);
    },
  );
};
