import { createPersonSchema, updatePersonSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  genericArrayResponseSchema,
  genericObjectResponseSchema,
  householdIdQuerySchema,
  idParamSchema,
  nullableStringProperty,
} from "../lib/docs";
import { handleRouteError } from "../lib/http";
import {
  archivePerson,
  createPerson,
  getPerson,
  listPeople,
  updatePerson,
} from "../services/people-service";

const listPeopleQuerySchema = z.object({
  householdId: z.string().min(1),
});

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const personBodySchema = {
  type: "object",
  required: ["householdId", "name"],
  properties: {
    householdId: { type: "string" },
    userId: nullableStringProperty,
    name: { type: "string", minLength: 1, maxLength: 120 },
    color: nullableStringProperty,
    avatarUrl: nullableStringProperty,
  },
} as const;

const updatePersonBodySchema = {
  type: "object",
  properties: {
    userId: nullableStringProperty,
    name: { type: "string", minLength: 1, maxLength: 120 },
    color: nullableStringProperty,
    avatarUrl: nullableStringProperty,
  },
} as const;

export const peopleRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["People"],
        summary: "Lista pessoas financeiras de uma casa",
        querystring: householdIdQuerySchema,
        response: { 200: genericArrayResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const query = listPeopleQuerySchema.parse(request.query);

        return listPeople(query.householdId);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["People"],
        summary: "Busca uma pessoa financeira",
        params: idParamSchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);

        return getPerson(params.id);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["People"],
        summary: "Cria uma pessoa financeira na casa",
        body: personBodySchema,
        response: { 201: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const input = createPersonSchema.parse(request.body);

        return reply.status(201).send(createPerson(input));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["People"],
        summary: "Atualiza uma pessoa financeira",
        params: idParamSchema,
        body: updatePersonBodySchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);
        const input = updatePersonSchema.parse(request.body);

        return updatePerson(params.id, input);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["People"],
        summary: "Arquiva uma pessoa financeira",
        params: idParamSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);
        archivePerson(params.id);

        return reply.status(204).send();
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
