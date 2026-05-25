import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Health"],
        summary: "Verifica se a API esta online",
      },
    },
    async () => ({
      status: "ok",
      uptime: process.uptime(),
    }),
  );
};
