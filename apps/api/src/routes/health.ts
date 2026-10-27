import type { FastifyPluginAsync } from "fastify";
import { db } from "../db";
import { sessions } from "../db/schema";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      config: { public: true },
      schema: { tags: ["Health"], summary: "Verifica se a API esta online" },
    },
    async () => ({ status: "ok", uptime: process.uptime() }),
  );
  app.get(
    "/ready",
    {
      config: { public: true },
      schema: { tags: ["Health"], summary: "Verifica acesso ao banco e migration de sessoes" },
    },
    async (_request, reply) => {
      try {
        db.select({ id: sessions.id }).from(sessions).limit(1).all();
        return { status: "ready" };
      } catch {
        return reply.code(503).send({ status: "unavailable" });
      }
    },
  );
};
