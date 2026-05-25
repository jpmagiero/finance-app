import cors from "@fastify/cors";
import { appName } from "@finance/shared";
import Fastify from "fastify";
import { registerSwagger } from "./plugins/swagger";
import { accountRoutes } from "./routes/accounts";
import { categoryRoutes } from "./routes/categories";
import { dashboardRoutes } from "./routes/dashboard";
import { healthRoutes } from "./routes/health";
import { householdRoutes } from "./routes/households";
import { payeeRoutes } from "./routes/payees";
import { peopleRoutes } from "./routes/people";
import { settingsRoutes } from "./routes/settings";
import { tagRoutes } from "./routes/tags";
import { transactionRoutes } from "./routes/transactions";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
  });
  await registerSwagger(app);

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
  app.register(transactionRoutes, {
    prefix: "/transactions",
  });
  app.register(dashboardRoutes, {
    prefix: "/dashboard",
  });

  app.get(
    "/",
    {
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
