import cors from "@fastify/cors";
import { appName } from "@finance/shared";
import Fastify, { type FastifyServerOptions } from "fastify";
import { env } from "./env";
import { handleRouteError } from "./lib/http";
import { registerAuth } from "./plugins/auth";
import { registerSwagger } from "./plugins/swagger";
import { accountRoutes } from "./routes/accounts";
import { authRoutes } from "./routes/auth";
import { budgetRoutes } from "./routes/budgets";
import { categoryRoutes } from "./routes/categories";
import { dashboardRoutes } from "./routes/dashboard";
import { healthRoutes } from "./routes/health";
import { householdRoutes } from "./routes/households";
import { payeeRoutes } from "./routes/payees";
import { peopleRoutes } from "./routes/people";
import { recurringRoutes } from "./routes/recurring";
import { settingsRoutes } from "./routes/settings";
import { tagRoutes } from "./routes/tags";
import { transactionRoutes } from "./routes/transactions";

export async function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: {
      redact: [
        "req.headers.cookie",
        "req.headers.authorization",
        "req.body.password",
        "req.body.currentPassword",
        "req.body.newPassword",
      ],
    },
    ...options,
  });

  await app.register(cors, {
    origin: env.WEB_ORIGIN ?? false,
    credentials: true,
  });
  app.setErrorHandler((error, request, reply) => {
    if (!(error instanceof Error)) {
      request.log.error(error);
      return reply.status(500).send({ error: "internal_error", message: "Erro interno." });
    }
    return handleRouteError(reply, error);
  });
  await registerAuth(app);
  await registerSwagger(app);
  app.register(authRoutes, { prefix: "/auth" });

  app.register(healthRoutes, {
    prefix: "/health",
  });
  app.register(householdRoutes, {
    prefix: "/households",
  });
  app.register(peopleRoutes, {
    prefix: "/people",
  });
  app.register(categoryRoutes, {
    prefix: "/categories",
  });
  app.register(accountRoutes, {
    prefix: "/accounts",
  });
  app.register(payeeRoutes, {
    prefix: "/payees",
  });
  app.register(tagRoutes, {
    prefix: "/tags",
  });
  app.register(settingsRoutes, {
    prefix: "/settings",
  });
  app.register(budgetRoutes, { prefix: "/budgets" });
  app.register(recurringRoutes, { prefix: "/recurring" });
  app.register(transactionRoutes, {
    prefix: "/transactions",
  });
  app.register(dashboardRoutes, {
    prefix: "/dashboard",
  });

  app.get(
    "/",
    {
      config: { public: true },
      schema: {
        tags: ["Health"],
        summary: "Informacoes basicas da API",
      },
    },
    async () => ({
      name: appName,
      status: "ok",
    }),
  );

  return app;
}
