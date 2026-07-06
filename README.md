# Finance App

Aplicativo web pessoal para controle financeiro familiar.

## Stack

- React + Vite no frontend
- Fastify + TypeScript no backend (validacao Zod ponta a ponta via fastify-type-provider-zod)
- Drizzle ORM + SQLite
- Vitest para testes da API
- Biome para lint e formatacao
- Monorepo com pnpm workspaces

## Primeiros comandos

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Por padrao, a API usa `apps/api/data/app.sqlite` e escuta em `127.0.0.1:3333`.
A documentacao interativa fica em `http://localhost:3333/docs` (desativada quando `NODE_ENV=production`).

Testes da API:

```bash
pnpm --filter @finance/api test
```

## Variaveis de ambiente

Veja `apps/api/.env.example` e `apps/web/.env.example`. As principais:

- `HOST` — padrao `127.0.0.1`. Use `0.0.0.0` apenas se quiser expor a API na rede local
  (a API ainda **nao tem autenticacao**; nao exponha fora de uma rede confiavel).
- `CORS_ORIGIN` — origens permitidas, separadas por virgula (padrao `http://localhost:5173`).
- `DATABASE_URL` — caminho do SQLite (`file:./data/app.sqlite`).

## Convencoes do dominio

- **Dinheiro**: sempre inteiros em centavos (`*Cents`). Nunca float, nunca valor com sinal —
  exceto `adjustment`, cujo `amountCents` carrega o sinal e e somado direto ao saldo da conta.
  A regra "como cada tipo de transacao afeta saldos" vive em um unico lugar:
  `apps/api/src/lib/balance.ts` (`balanceDeltas`).
- **Escopo por household (pre-auth)**: enquanto nao ha login, toda rota por `:id` exige
  `?householdId=` na query e os services validam a posse (`and(eq(id), eq(householdId))`).
  Quando a autenticacao for implementada, o `householdId` passara a vir da sessao.
- **Datas**: `transactionDate`/`competenceDate` sao strings `YYYY-MM-DD` na data local do
  household — a conversao de fuso e responsabilidade do cliente (nunca use
  `new Date().toISOString().slice(0, 10)` no front; formate com a data local).
  Timestamps (`createdAt`/`updatedAt`/`deletedAt`) sao ISO-8601 UTC gerados pela aplicacao.
- **Validacao**: schemas Zod do `@finance/shared` sao a fonte unica (entrada e DTOs de
  resposta), consumidos pelo Fastify (validacao + serializacao + OpenAPI) e pelo front.
- **Soft delete**: transacoes usam `deletedAt`; toda agregacao que parte de
  `transaction_splits`/`transaction_tags` deve fazer join com `transactions` filtrando
  `deletedAt IS NULL`.

## Estrutura

```txt
apps/
  api/      Fastify, Drizzle e SQLite
  web/      React e Vite
packages/
  shared/   tipos, constantes e schemas compartilhados
```
