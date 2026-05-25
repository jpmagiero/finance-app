import { createTagSchema, updateTagSchema } from "@finance/shared";
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
import { createTag, deleteTag, getTag, listTags, updateTag } from "../services/tags-service";

const listTagsQuerySchema = z.object({
  householdId: z.string().min(1),
});

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const tagBodySchema = {
  type: "object",
  required: ["householdId", "name"],
  properties: {
    householdId: { type: "string" },
    name: { type: "string", minLength: 1, maxLength: 80 },
    color: nullableStringProperty,
  },
} as const;

const updateTagBodySchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 80 },
    color: nullableStringProperty,
  },
} as const;

export const tagRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Tags"],
        summary: "Lista tags de uma casa",
        querystring: householdIdQuerySchema,
        response: { 200: genericArrayResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const query = listTagsQuerySchema.parse(request.query);

        return listTags(query.householdId);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Tags"],
        summary: "Busca uma tag",
        params: idParamSchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);

        return getTag(params.id);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Tags"],
        summary: "Cria uma tag",
        body: tagBodySchema,
        response: { 201: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const input = createTagSchema.parse(request.body);

        return reply.status(201).send(createTag(input));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Tags"],
        summary: "Atualiza uma tag",
        params: idParamSchema,
        body: updateTagBodySchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);
        const input = updateTagSchema.parse(request.body);

        return updateTag(params.id, input);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Tags"],
        summary: "Exclui uma tag se nao estiver em uso",
        params: idParamSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);
        deleteTag(params.id);

        return reply.status(204).send();
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
