import { createAccountSchema, updateAccountSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  genericArrayResponseSchema,
  genericObjectResponseSchema,
  householdIdQuerySchema,
  idParamSchema,
  nullableIntegerProperty,
  nullableStringProperty,
} from "../lib/docs";
import { handleRouteError } from "../lib/http";
import {
  archiveAccount,
  createAccount,
  getAccount,
  listAccounts,
  recalculateAccountBalance,
  updateAccount,
} from "../services/accounts-service";

const listAccountsQuerySchema = z.object({
  householdId: z.string().min(1),
  includeArchived: z.enum(["true", "false"]).optional(),
});

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const accountBodySchema = {
  type: "object",
  required: ["householdId", "name", "type"],
  properties: {
    householdId: { type: "string" },
    personId: nullableStringProperty,
    name: { type: "string", minLength: 1, maxLength: 120 },
    type: {
      type: "string",
      enum: ["checking", "savings", "cash", "credit_card", "investment", "loan", "other"],
    },
    institution: nullableStringProperty,
    currency: { type: "string", minLength: 3, maxLength: 3, default: "BRL" },
    initialBalanceCents: { type: "integer", default: 0 },
    currentBalanceCents: { type: "integer" },
    creditLimitCents: nullableIntegerProperty,
    statementClosingDay: nullableIntegerProperty,
    statementDueDay: nullableIntegerProperty,
    isShared: { type: "boolean", default: false },
  },
} as const;

const updateAccountBodySchema = {
  type: "object",
  properties: {
    personId: nullableStringProperty,
    name: { type: "string", minLength: 1, maxLength: 120 },
    type: {
      type: "string",
      enum: ["checking", "savings", "cash", "credit_card", "investment", "loan", "other"],
    },
    institution: nullableStringProperty,
    currency: { type: "string", minLength: 3, maxLength: 3 },
    initialBalanceCents: { type: "integer" },
    currentBalanceCents: { type: "integer" },
    creditLimitCents: nullableIntegerProperty,
    statementClosingDay: nullableIntegerProperty,
    statementDueDay: nullableIntegerProperty,
    isShared: { type: "boolean" },
  },
} as const;

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Lista contas de uma casa",
        querystring: {
          ...householdIdQuerySchema,
          properties: {
            ...householdIdQuerySchema.properties,
            includeArchived: { type: "string", enum: ["true", "false"] },
          },
        },
        response: { 200: genericArrayResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const query = listAccountsQuerySchema.parse(request.query);

        return listAccounts({
          householdId: query.householdId,
          includeArchived: query.includeArchived === "true",
        });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Busca uma conta",
        params: idParamSchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);

        return getAccount(params.id);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Cria uma conta, cartao ou carteira",
        body: accountBodySchema,
        response: { 201: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const input = createAccountSchema.parse(request.body);

        return reply.status(201).send(createAccount(input));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Atualiza uma conta",
        params: idParamSchema,
        body: updateAccountBodySchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);
        const input = updateAccountSchema.parse(request.body);

        return updateAccount(params.id, input);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/:id/recalculate-balance",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Recalcula saldo da conta a partir das transacoes confirmadas",
        params: idParamSchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);

        return recalculateAccountBalance(params.id);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Arquiva uma conta",
        params: idParamSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);
        archiveAccount(params.id);

        return reply.status(204).send();
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
