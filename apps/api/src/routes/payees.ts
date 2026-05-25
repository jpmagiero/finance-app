import { createPayeeSchema } from "@finance/shared";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { households, payees } from "../db/schema";
import {
  genericArrayResponseSchema,
  genericObjectResponseSchema,
  householdIdQuerySchema,
} from "../lib/docs";
import { handleRouteError, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { normalizeName } from "../lib/normalize";

const listPayeesQuerySchema = z.object({
  householdId: z.string().min(1),
});

export const payeeRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Payees"],
        summary: "Lista favorecidos e pagadores",
        querystring: householdIdQuerySchema,
        response: {
          200: genericArrayResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const query = listPayeesQuerySchema.parse(request.query);

        return db.select().from(payees).where(eq(payees.householdId, query.householdId)).all();
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Payees"],
        summary: "Cria um favorecido ou pagador",
        body: {
          type: "object",
          required: ["householdId", "name"],
          properties: {
            householdId: { type: "string" },
            name: { type: "string", minLength: 1, maxLength: 160 },
          },
        },
        response: {
          201: genericObjectResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const input = createPayeeSchema.parse(request.body);
        const household = db
          .select()
          .from(households)
          .where(eq(households.id, input.householdId))
          .get();

        if (!household) {
          notFound("Casa nao encontrada.");
        }

        const id = createId();

        db.insert(payees)
          .values({
            id,
            householdId: input.householdId,
            name: input.name,
            normalizedName: normalizeName(input.name),
          })
          .run();

        const payee = db.select().from(payees).where(eq(payees.id, id)).get();

        return reply.status(201).send(payee);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
