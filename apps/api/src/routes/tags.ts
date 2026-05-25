import { createTagSchema } from "@finance/shared";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { households, tags } from "../db/schema";
import { handleRouteError, notFound } from "../lib/http";
import { createId } from "../lib/ids";

const listTagsQuerySchema = z.object({
  householdId: z.string().min(1),
});

export const tagRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    try {
      const query = listTagsQuerySchema.parse(request.query);

      return db.select().from(tags).where(eq(tags.householdId, query.householdId)).all();
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.post("/", async (request, reply) => {
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
  });
};
