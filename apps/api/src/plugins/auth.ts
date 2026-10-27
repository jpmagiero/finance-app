import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db";
import { accounts, categories, householdPeople, payees, tags, transactions } from "../db/schema";
import { env } from "../env";
import { errorResponseSchema } from "../lib/docs";
import { badRequest, forbidden, notFound } from "../lib/http";
import { getIdentity, type Identity } from "../services/auth-service";

declare module "fastify" {
  interface FastifyRequest {
    identity: Identity;
  }
  interface FastifyContextConfig {
    public?: boolean;
  }
}

export async function registerAuth(app: FastifyInstance) {
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  app.decorateRequest("identity");
  app.addHook("onRoute", (route) => {
    const path = route.url;
    if (path === "/docs" || path.startsWith("/docs/")) return;
    const schema = route.schema ?? {};
    const publicRoute = route.config?.public;
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(String(route.method));
    schema.response = {
      ...(schema.response as Record<string, unknown> | undefined),
      400: errorResponseSchema,
      401: errorResponseSchema,
      403: errorResponseSchema,
      404: errorResponseSchema,
      409: errorResponseSchema,
      429: errorResponseSchema,
    };
    if (!publicRoute)
      schema.security = [mutation ? { sessionCookie: [], csrfToken: [] } : { sessionCookie: [] }];
    route.schema = schema;
  });

  app.addHook("preHandler", async (request, reply) => {
    const path = request.routeOptions.url ?? "";
    if (path === "/docs" || path.startsWith("/docs/") || request.method === "OPTIONS") return;
    const writes = !["GET", "HEAD"].includes(request.method);
    if (writes && request.headers.origin) {
      const origin = request.headers.origin;
      let sameHost = false;
      try {
        sameHost = new URL(origin).origin === `${request.protocol}://${request.headers.host}`;
      } catch {
        /* reject malformed origins */
      }
      if (!sameHost && origin !== env.WEB_ORIGIN) forbidden("Origem nao permitida.");
    }
    if (request.routeOptions.config.public) return;
    request.identity = getIdentity(request.cookies.finance_session);
    reply.header("cache-control", "no-store");
    if (writes && request.headers["x-csrf-token"] !== request.identity.csrfToken)
      forbidden("Sessao expirada ou token CSRF invalido.");
    const body = request.body as Record<string, unknown> | null;
    const query = request.query as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    for (const value of [
      body?.householdId,
      query?.householdId,
      path.startsWith("/settings") ? params.householdId : undefined,
    ]) {
      if (value !== undefined && value !== request.identity.householdId) {
        // Keep an immutable-household edit a validation error; never query the other house.
        if (writes && path === "/transactions/:id")
          badRequest("A casa da transacao nao pode ser alterada.");
        notFound("Recurso nao encontrado nesta casa.");
      }
    }
    if (params.id) {
      const resource = path.split("/")[1];
      const tables = { people: householdPeople, accounts, categories, payees, tags, transactions };
      const table = tables[resource as keyof typeof tables];
      if (table) {
        const row = db
          .select({ householdId: table.householdId })
          .from(table)
          .where(eq(table.id, params.id))
          .get();
        if (!row || row.householdId !== request.identity.householdId)
          notFound("Recurso nao encontrado nesta casa.");
      }
    }
    if (
      writes &&
      !path.startsWith("/transactions") &&
      !path.startsWith("/auth/") &&
      request.identity.role === "member"
    )
      forbidden("Somente administradores podem alterar cadastros e configuracoes.");
  });
}
