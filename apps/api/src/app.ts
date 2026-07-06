import cors from "@fastify/cors";
import { apiInfoSchema, appName } from "@finance/shared";
import Fastify from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { ZodError } from "zod";
import { corsOrigins } from "./env";
import { HttpError, isSqliteConstraintError } from "./lib/http";
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
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: "validation_error",
        issues: error.validation,
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "validation_error",
        issues: error.issues,
      });
    }

    if (isSqliteConstraintError(error, "SQLITE_CONSTRAINT_UNIQUE")) {
      return reply.status(409).send({
        error: "conflict",
        message: "Ja existe um registro com estes dados nesta casa.",
      });
    }

    if (isSqliteConstraintError(error)) {
      return reply.status(400).send({
        error: "bad_request",
        message: "Operacao viola uma restricao de integridade.",
      });
    }

    // Erros nao previstos: log completo no servidor, resposta generica ao
    // cliente para nao vazar detalhes internos.
    request.log.error(error);
    return reply.status(500).send({
      error: "internal_error",
      message: "Erro interno.",
    });
  });

  await app.register(cors, {
    origin: corsOrigins,
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
        response: { 200: apiInfoSchema },
      },
    },
    async () => ({
      name: appName,
      status: "ok",
    }),
  );

  return app;
}
