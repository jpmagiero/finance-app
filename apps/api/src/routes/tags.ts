import { createTagSchema, tagSchema, updateTagSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  householdQuerySchema,
  idParamsSchema,
  noContentResponseSchema,
} from "../lib/route-schemas";
import { createTag, deleteTag, getTag, listTags, updateTag } from "../services/tags-service";

export const tagRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/",
    {
      schema: {
        tags: ["Tags"],
        summary: "Lista tags de uma casa",
        querystring: householdQuerySchema,
        response: { 200: z.array(tagSchema) },
      },
    },
    async (request) => listTags(request.query.householdId),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Tags"],
        summary: "Busca uma tag",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        response: { 200: tagSchema },
      },
    },
    async (request) => getTag(request.query.householdId, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Tags"],
        summary: "Cria uma tag",
        body: createTagSchema,
        response: { 201: tagSchema },
      },
    },
    async (request, reply) => reply.status(201).send(createTag(request.body)),
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Tags"],
        summary: "Atualiza uma tag",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        body: updateTagSchema,
        response: { 200: tagSchema },
      },
    },
    async (request) => updateTag(request.query.householdId, request.params.id, request.body),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Tags"],
        summary: "Exclui uma tag se nao estiver em uso",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        response: { 204: noContentResponseSchema },
      },
    },
    async (request, reply) => {
      deleteTag(request.query.householdId, request.params.id);

      return reply.status(204).send(null);
    },
  );
};
