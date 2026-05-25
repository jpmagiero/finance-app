import { createCategorySchema, updateCategorySchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  genericArrayResponseSchema,
  genericObjectResponseSchema,
  idParamSchema,
  nullableStringProperty,
} from "../lib/docs";
import { handleRouteError } from "../lib/http";
import {
  archiveCategory,
  createCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "../services/categories-service";

const listCategoriesQuerySchema = z.object({
  householdId: z.string().min(1),
  type: z.enum(["income", "expense", "transfer"]).optional(),
  includeArchived: z.enum(["true", "false"]).optional(),
});

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const categoryBodySchema = {
  type: "object",
  required: ["householdId", "name", "type"],
  properties: {
    householdId: { type: "string" },
    parentId: nullableStringProperty,
    name: { type: "string", minLength: 1, maxLength: 120 },
    type: { type: "string", enum: ["income", "expense", "transfer"] },
    color: nullableStringProperty,
    icon: nullableStringProperty,
  },
} as const;

const updateCategoryBodySchema = {
  type: "object",
  properties: {
    parentId: nullableStringProperty,
    name: { type: "string", minLength: 1, maxLength: 120 },
    type: { type: "string", enum: ["income", "expense", "transfer"] },
    color: nullableStringProperty,
    icon: nullableStringProperty,
  },
} as const;

export const categoryRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Categories"],
        summary: "Lista categorias de uma casa",
        querystring: {
          type: "object",
          required: ["householdId"],
          properties: {
            householdId: { type: "string" },
            type: { type: "string", enum: ["income", "expense", "transfer"] },
            includeArchived: { type: "string", enum: ["true", "false"] },
          },
        },
        response: { 200: genericArrayResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const query = listCategoriesQuerySchema.parse(request.query);

        return listCategories({
          householdId: query.householdId,
          type: query.type,
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
        tags: ["Categories"],
        summary: "Busca uma categoria",
        params: idParamSchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);

        return getCategory(params.id);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Categories"],
        summary: "Cria uma categoria",
        body: categoryBodySchema,
        response: { 201: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const input = createCategorySchema.parse(request.body);

        return reply.status(201).send(createCategory(input));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Categories"],
        summary: "Atualiza uma categoria",
        params: idParamSchema,
        body: updateCategoryBodySchema,
        response: { 200: genericObjectResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);
        const input = updateCategorySchema.parse(request.body);

        return updateCategory(params.id, input);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Categories"],
        summary: "Arquiva uma categoria",
        params: idParamSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = idParamsSchema.parse(request.params);
        archiveCategory(params.id);

        return reply.status(204).send();
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
