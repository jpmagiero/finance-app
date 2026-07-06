import {
  categorySchema,
  categoryTypes,
  createCategorySchema,
  updateCategorySchema,
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
  archiveCategory,
  createCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "../services/categories-service";

const listCategoriesQuerySchema = householdQuerySchema.extend({
  type: z.enum(categoryTypes).optional(),
  includeArchived: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const categoryRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/",
    {
      schema: {
        tags: ["Categories"],
        summary: "Lista categorias de uma casa",
        querystring: listCategoriesQuerySchema,
        response: { 200: z.array(categorySchema) },
      },
    },
    async (request) => listCategories(request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Categories"],
        summary: "Busca uma categoria",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        response: { 200: categorySchema },
      },
    },
    async (request) => getCategory(request.query.householdId, request.params.id),
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Categories"],
        summary: "Cria uma categoria",
        body: createCategorySchema,
        response: { 201: categorySchema },
      },
    },
    async (request, reply) => reply.status(201).send(createCategory(request.body)),
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Categories"],
        summary: "Atualiza uma categoria",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        body: updateCategorySchema,
        response: { 200: categorySchema },
      },
    },
    async (request) => updateCategory(request.query.householdId, request.params.id, request.body),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Categories"],
        summary: "Arquiva uma categoria",
        params: idParamsSchema,
        querystring: householdQuerySchema,
        response: { 204: noContentResponseSchema },
      },
    },
    async (request, reply) => {
      archiveCategory(request.query.householdId, request.params.id);

      return reply.status(204).send(null);
    },
  );
};
