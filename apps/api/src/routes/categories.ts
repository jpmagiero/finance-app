import { createCategorySchema } from "@finance/shared";
import { and, eq, type SQL } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { categories, households } from "../db/schema";
import {
  genericArrayResponseSchema,
  genericObjectResponseSchema,
  nullableStringProperty,
} from "../lib/docs";
import { handleRouteError, notFound } from "../lib/http";
import { createId } from "../lib/ids";

const listCategoriesQuerySchema = z.object({
  householdId: z.string().min(1),
  type: z.enum(["income", "expense", "transfer"]).optional(),
});

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
          },
        },
        response: {
          200: genericArrayResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const query = listCategoriesQuerySchema.parse(request.query);
        const conditions: SQL[] = [eq(categories.householdId, query.householdId)];

        if (query.type) {
          conditions.push(eq(categories.type, query.type));
        }

        return db
          .select()
          .from(categories)
          .where(and(...conditions))
          .all();
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
        body: {
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
        },
        response: {
          201: genericObjectResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const input = createCategorySchema.parse(request.body);
        const household = db
          .select()
          .from(households)
          .where(eq(households.id, input.householdId))
          .get();

        if (!household) {
          notFound("Casa nao encontrada.");
        }

        if (input.parentId) {
          const parent = db
            .select()
            .from(categories)
            .where(eq(categories.id, input.parentId))
            .get();

          if (!parent || parent.householdId !== input.householdId) {
            notFound("Categoria pai nao encontrada nesta casa.");
          }
        }

        const id = createId();

        db.insert(categories)
          .values({
            id,
            householdId: input.householdId,
            parentId: input.parentId ?? null,
            name: input.name,
            type: input.type,
            color: input.color ?? null,
            icon: input.icon ?? null,
          })
          .run();

        const category = db.select().from(categories).where(eq(categories.id, id)).get();

        return reply.status(201).send(category);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
