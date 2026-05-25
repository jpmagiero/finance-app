import { createAccountSchema } from "@finance/shared";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { accounts, householdPeople, households } from "../db/schema";
import { handleRouteError, notFound } from "../lib/http";
import { createId } from "../lib/ids";

const listAccountsQuerySchema = z.object({
  householdId: z.string().min(1),
});

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    try {
      const query = listAccountsQuerySchema.parse(request.query);

      return db.select().from(accounts).where(eq(accounts.householdId, query.householdId)).all();
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.post("/", async (request, reply) => {
    try {
      const input = createAccountSchema.parse(request.body);
      const household = db
        .select()
        .from(households)
        .where(eq(households.id, input.householdId))
        .get();

      if (!household) {
        notFound("Casa nao encontrada.");
      }

      if (input.personId) {
        const person = db
          .select()
          .from(householdPeople)
          .where(eq(householdPeople.id, input.personId))
          .get();

        if (!person || person.householdId !== input.householdId) {
          notFound("Pessoa nao encontrada nesta casa.");
        }
      }

      const id = createId();
      const initialBalanceCents = input.initialBalanceCents;

      db.insert(accounts)
        .values({
          id,
          householdId: input.householdId,
          personId: input.personId ?? null,
          name: input.name,
          type: input.type,
          institution: input.institution ?? null,
          currency: input.currency,
          initialBalanceCents,
          currentBalanceCents: input.currentBalanceCents ?? initialBalanceCents,
          creditLimitCents: input.creditLimitCents ?? null,
          statementClosingDay: input.statementClosingDay ?? null,
          statementDueDay: input.statementDueDay ?? null,
          isShared: input.isShared,
        })
        .run();

      const account = db.select().from(accounts).where(eq(accounts.id, id)).get();

      return reply.status(201).send(account);
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });
};
