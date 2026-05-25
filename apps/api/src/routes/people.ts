import { createPersonSchema } from "@finance/shared";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { householdPeople, households, users } from "../db/schema";
import { handleRouteError, notFound } from "../lib/http";
import { createId } from "../lib/ids";

const listPeopleQuerySchema = z.object({
  householdId: z.string().min(1),
});

export const peopleRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    try {
      const query = listPeopleQuerySchema.parse(request.query);

      return db
        .select()
        .from(householdPeople)
        .where(eq(householdPeople.householdId, query.householdId))
        .all();
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.post("/", async (request, reply) => {
    try {
      const input = createPersonSchema.parse(request.body);
      const household = db
        .select()
        .from(households)
        .where(eq(households.id, input.householdId))
        .get();

      if (!household) {
        notFound("Casa nao encontrada.");
      }

      if (input.userId) {
        const user = db.select().from(users).where(eq(users.id, input.userId)).get();

        if (!user) {
          notFound("Usuario nao encontrado.");
        }
      }

      const id = createId();

      db.insert(householdPeople)
        .values({
          id,
          householdId: input.householdId,
          userId: input.userId ?? null,
          name: input.name,
          color: input.color ?? null,
          avatarUrl: input.avatarUrl ?? null,
        })
        .run();

      const person = db.select().from(householdPeople).where(eq(householdPeople.id, id)).get();

      return reply.status(201).send(person);
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });
};
