import { createPersonSchema, householdPersonSchema, updatePersonSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  householdQuerySchema,
  idParamsSchema,
  noContentResponseSchema,
} from "../lib/route-schemas";
import {
  archivePerson,
  createPerson,
  getPerson,
  listPeople,
  updatePerson,
} from "../services/people-service";

export const peopleRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/",
    {
      schema: {
        tags: ["People"],
        summary: "Lista pessoas financeiras de uma casa",
        querystring: householdQuerySchema,
        response: { 200: z.array(householdPersonSchema) },
      },
    },
    async (request) => listPeople(request.query.householdId),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["People"],
        summary: "Busca uma pessoa financeira",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        response: { 200: householdPersonSchema },
      },
    },
    async (request) => getPerson(request.query.householdId, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["People"],
        summary: "Cria uma pessoa financeira na casa",
        body: createPersonSchema,
        response: { 201: householdPersonSchema },
      },
    },
    async (request, reply) => reply.status(201).send(createPerson(request.body)),
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["People"],
        summary: "Atualiza uma pessoa financeira",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        body: updatePersonSchema,
        response: { 200: householdPersonSchema },
      },
    },
    async (request) => updatePerson(request.query.householdId, request.params.id, request.body),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["People"],
        summary: "Arquiva uma pessoa financeira",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        response: { 204: noContentResponseSchema },
      },
    },
    async (request, reply) => {
      archivePerson(request.query.householdId, request.params.id);

      return reply.status(204).send(null);
    },
  );
};
