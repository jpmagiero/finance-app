import { changePasswordSchema, loginSchema, newLoginSchema } from "@finance/shared";
import { and, eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db";
import { householdMembers, users } from "../db/schema";
import { env } from "../env";
import { genericArrayResponseSchema, genericObjectResponseSchema } from "../lib/docs";
import {
  changePassword,
  createHouseholdLogin,
  login,
  logout,
  publicIdentity,
  sessionLifetime,
} from "../services/auth-service";

const loginBody = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: { type: "string", minLength: 3, maxLength: 254 },
    password: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const;
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/password",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        tags: ["Auth"],
        summary: "Altera senha e revoga todas as sessoes",
        body: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string", minLength: 1, maxLength: 128 },
            newPassword: { type: "string", minLength: 12, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => {
      const input = changePasswordSchema.parse(request.body);
      await changePassword(request.identity, input.currentPassword, input.newPassword);
      return reply
        .clearCookie("finance_session", {
          path: "/",
          httpOnly: true,
          sameSite: "strict",
          secure: env.COOKIE_SECURE,
        })
        .status(204)
        .send();
    },
  );

  app.post(
    "/login",
    {
      config: { public: true, rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: { tags: ["Auth"], body: loginBody, response: { 200: genericObjectResponseSchema } },
    },
    async (request, reply) => {
      const input = loginSchema.parse(request.body);
      const result = await login(input.email, input.password);
      reply.header("cache-control", "no-store").setCookie("finance_session", result.token, {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: env.COOKIE_SECURE,
        maxAge: sessionLifetime,
      });
      return publicIdentity(result.identity);
    },
  );
  app.get(
    "/me",
    { schema: { tags: ["Auth"], response: { 200: genericObjectResponseSchema } } },
    async (request) => publicIdentity(request.identity),
  );
  app.post("/logout", { schema: { tags: ["Auth"] } }, async (request, reply) => {
    logout(request.identity);
    return reply
      .clearCookie("finance_session", {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: env.COOKIE_SECURE,
      })
      .status(204)
      .send();
  });
  app.get(
    "/users",
    { schema: { tags: ["Auth"], response: { 200: genericArrayResponseSchema } } },
    async (request) => {
      if (request.identity.role === "member") return [];
      return db
        .select({ id: users.id, name: users.name, email: users.email, role: householdMembers.role })
        .from(users)
        .innerJoin(householdMembers, eq(householdMembers.userId, users.id))
        .where(
          and(
            eq(householdMembers.householdId, request.identity.householdId),
            eq(users.isActive, true),
          ),
        )
        .all();
    },
  );
  app.post(
    "/users",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["email", "name", "password"],
          properties: {
            ...loginBody.properties,
            password: { type: "string", minLength: 12, maxLength: 128 },
            name: { type: "string", minLength: 1, maxLength: 120 },
            personId: { type: "string" },
          },
        },
        response: { 201: genericObjectResponseSchema },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(await createHouseholdLogin(request.identity, newLoginSchema.parse(request.body))),
  );
};
