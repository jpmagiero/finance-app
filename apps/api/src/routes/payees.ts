import { createPayeeSchema, payeeSchema, updatePayeeSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  householdQuerySchema,
  idParamsSchema,
  noContentResponseSchema,
} from "../lib/route-schemas";
import {
  createPayee,
  deletePayee,
  getPayee,
  listPayees,
  updatePayee,
} from "../services/payees-service";

export const payeeRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/",
    {
      schema: {
        tags: ["Payees"],
        summary: "Lista favorecidos e pagadores",
        querystring: householdQuerySchema,
        response: { 200: z.array(payeeSchema) },
      },
    },
    async (request) => listPayees(request.query.householdId),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Payees"],
        summary: "Busca um favorecido ou pagador",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        response: { 200: payeeSchema },
      },
    },
    async (request) => getPayee(request.query.householdId, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Payees"],
        summary: "Cria um favorecido ou pagador",
        body: createPayeeSchema,
        response: { 201: payeeSchema },
      },
    },
    async (request, reply) => reply.status(201).send(createPayee(request.body)),
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Payees"],
        summary: "Atualiza um favorecido ou pagador",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        body: updatePayeeSchema,
        response: { 200: payeeSchema },
      },
    },
    async (request) => updatePayee(request.query.householdId, request.params.id, request.body),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Payees"],
        summary: "Exclui um favorecido ou pagador se nao estiver em uso",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        response: { 204: noContentResponseSchema },
      },
    },
    async (request, reply) => {
      deletePayee(request.query.householdId, request.params.id);

      return reply.status(204).send(null);
    },
  );
};
