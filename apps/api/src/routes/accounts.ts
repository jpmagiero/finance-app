import { accountSchema, createAccountSchema, updateAccountSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  householdQuerySchema,
  idParamsSchema,
  noContentResponseSchema,
} from "../lib/route-schemas";
import {
  archiveAccount,
  createAccount,
  getAccount,
  listAccounts,
  recalculateAccountBalance,
  updateAccount,
} from "../services/accounts-service";

const listAccountsQuerySchema = householdQuerySchema.extend({
  includeArchived: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const accountRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Lista contas de uma casa",
        querystring: listAccountsQuerySchema,
        response: { 200: z.array(accountSchema) },
      },
    },
    async (request) => listAccounts(request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Busca uma conta",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        response: { 200: accountSchema },
      },
    },
    async (request) => getAccount(request.query.householdId, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Cria uma conta, cartao ou carteira",
        body: createAccountSchema,
        response: { 201: accountSchema },
      },
    },
    async (request, reply) => reply.status(201).send(createAccount(request.body)),
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Atualiza uma conta",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        body: updateAccountSchema,
        response: { 200: accountSchema },
      },
    },
    async (request) => updateAccount(request.query.householdId, request.params.id, request.body),
  );

  app.post(
    "/:id/recalculate-balance",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Recalcula saldo da conta a partir das transacoes confirmadas",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        response: { 200: accountSchema },
      },
    },
    async (request) => recalculateAccountBalance(request.query.householdId, request.params.id),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Arquiva uma conta",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        response: { 204: noContentResponseSchema },
      },
    },
    async (request, reply) => {
      archiveAccount(request.query.householdId, request.params.id);

      return reply.status(204).send(null);
    },
  );
};
