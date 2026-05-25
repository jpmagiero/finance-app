import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db";
import { householdMembers, householdPeople, households, settings } from "../db/schema";
import { handleRouteError, notFound } from "../lib/http";

export const householdRoutes: FastifyPluginAsync = async (app) => {
  app.get("/current", async (_request, reply) => {
    try {
      const household = db.select().from(households).limit(1).get();

      if (!household) {
        notFound("Nenhuma casa cadastrada.");
      }

      const householdSettings = db
        .select()
        .from(settings)
        .where(eq(settings.householdId, household.id))
        .get();

      const people = db
        .select()
        .from(householdPeople)
        .where(eq(householdPeople.householdId, household.id))
        .all();

      const members = db
        .select()
        .from(householdMembers)
        .where(eq(householdMembers.householdId, household.id))
        .all();

      return {
        household,
        settings: householdSettings,
        people,
        members,
      };
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });
};
