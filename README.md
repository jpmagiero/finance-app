# Finance App

Aplicativo web pessoal para controle financeiro familiar.

## Stack

- React + Vite no frontend
- Fastify + TypeScript no backend
- Drizzle ORM + SQLite
- Biome para lint e formatacao
- Monorepo com pnpm workspaces

## Primeiros comandos

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Por padrao, a API usa `apps/api/data/app.sqlite`.

## Estrutura

```txt
apps/
  api/      Fastify, Drizzle e SQLite
  web/      React e Vite
packages/
  shared/   tipos, constantes e schemas compartilhados
```
