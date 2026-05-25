import { createPayeeSchema, updatePayeeSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  genericArrayResponseSchema,
  genericObjectResponseSchema,
  householdIdQuerySchema,
  idParamSchema,
} from "../lib/docs";
import { handleRouteError } from "../lib/http";
import {
  createPayee,
  deletePayee,
  getPayee,
  listPayees,
  updatePayee,
} from "../services/payees-service";

const listPayeesQuerySchema = z.object({
  householdId: z.string().min(1),
});

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const payeeBodySchema = {
  type: "object",
  required: ["householdId", "name"],
  properties: {
    householdId: { type: "string" },
    name: { type: "string", minLength: 1, maxLength: 160 },
  },
} as const;

const updatePayeeBodySchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 160 },
  },
} as const;

export const payeeRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Payees"],
        summary: "Lista favorecidos e pagadores",
        querystring: householdIdQuerySchema,
        response: { 200: genericArrayResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const query = listPayeesQuerySchema.parse(request.query);

        return listPayees(query.householdId);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Payees"],
        summary: "Busca um favorecido ou pagador",
        params: idParamSchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);

        return getPayee(params.id);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Payees"],
        summary: "Cria um favorecido ou pagador",
        body: payeeBodySchema,
        response: { 201: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const input = createPayeeSchema.parse(request.body);

        return reply.status(201).send(createPayee(input));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Payees"],
        summary: "Atualiza um favorecido ou pagador",
        params: idParamSchema,
        body: updatePayeeBodySchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);
        const input = updatePayeeSchema.parse(request.body);

        return updatePayee(params.id, input);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Payees"],
        summary: "Exclui um favorecido ou pagador se nao estiver em uso",
        params: idParamSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);
        deletePayee(params.id);

        return reply.status(204).send();
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
