import { healthSchema } from "@finance/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

export const healthRoutes: FastifyPluginAsync = async (rawApp) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/",
    {
      schema: {
        tags: ["Health"],
        summary: "Verifica se a API esta online",
        response: { 200: healthSchema },
      },
    },
    async () => ({
      status: "ok",
      uptime: process.uptime(),
    }),
  );
};
