import { createTagSchema } from "@finance/shared";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { households, tags } from "../db/schema";
import {
  genericArrayResponseSchema,
  genericObjectResponseSchema,
  householdIdQuerySchema,
  nullableStringProperty,
} from "../lib/docs";
import { handleRouteError, notFound } from "../lib/http";
import { createId } from "../lib/ids";

const listTagsQuerySchema = z.object({
  householdId: z.string().min(1),
});

export const tagRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Tags"],
        summary: "Lista tags de uma casa",
        querystring: householdIdQuerySchema,
        response: {
          200: genericArrayResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const query = listTagsQuerySchema.parse(request.query);

        return db.select().from(tags).where(eq(tags.householdId, query.householdId)).all();
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
        body: {
          type: "object",
          required: ["householdId", "name"],
          properties: {
            householdId: { type: "string" },
            name: { type: "string", minLength: 1, maxLength: 80 },
            color: nullableStringProperty,
          },
        },
        response: {
          201: genericObjectResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const input = createTagSchema.parse(request.body);
        const household = db
          .select()
          .from(households)
          .where(eq(households.id, input.householdId))
          .get();

        if (!household) {
          notFound("Casa nao encontrada.");
        }

        const id = createId();

        db.insert(tags)
          .values({
            id,
            householdId: input.householdId,
            name: input.name,
            color: input.color ?? null,
          })
          .run();

        const tag = db.select().from(tags).where(eq(tags.id, id)).get();

        return reply.status(201).send(tag);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
