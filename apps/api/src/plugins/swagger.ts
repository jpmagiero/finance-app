import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { appName } from "@finance/shared";
import type { FastifyInstance } from "fastify";
import { env } from "../env";

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: `${appName} API`,
        description: "API para controle financeiro familiar.",
        version: "0.1.0",
      },
      components: {
        securitySchemes: {
          sessionCookie: { type: "apiKey", in: "cookie", name: "finance_session" },
          csrfToken: { type: "apiKey", in: "header", name: "x-csrf-token" },
        },
      },
      servers: [
        {
          url: env.OPENAPI_SERVER_URL,
          description: "API",
        },
      ],
      tags: [
        { name: "Auth", description: "Login, sessao e logins da casa" },
        { name: "Health", description: "Status da API" },
        { name: "Households", description: "Casa financeira e membros" },
        { name: "People", description: "Pessoas financeiras da casa" },
        { name: "Categories", description: "Categorias de receitas e despesas" },
        { name: "Accounts", description: "Contas, cartoes e carteiras" },
        { name: "Payees", description: "Favorecidos e pagadores" },
        { name: "Tags", description: "Marcadores livres" },
        { name: "Settings", description: "Configuracoes da casa" },
        { name: "Transactions", description: "Lancamentos financeiros" },
        { name: "Dashboard", description: "Resumo e indicadores" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: true,
  });
}
