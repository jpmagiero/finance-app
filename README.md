# Finance App

Aplicativo web de controle financeiro familiar, inicialmente para duas pessoas,
com hospedagem em home server. Deve permitir acompanhar receitas, despesas e
contas de forma individual e consolidada, mesmo para pessoas sem login.

## Por onde continuar

Esta documentacao substitui a dependencia do historico do chat. Foi consolidada
em **2026-10-20**, a partir das decisoes discutidas e do codigo no commit
`5bbbb44` (`feat/create-services`).

**Prioridade atual: finalizar o backend e seus endpoints antes de evoluir o frontend.**
O backend tem CRUD dos cadastros e de transacoes; o frontend ainda e um prototipo.
Autenticacao/autorizacao, testes automatizados, recorrencias e orcamentos
funcionais ainda estao pendentes. Existir uma tabela nao significa que a feature
esta pronta.

| Documento | Conteudo |
| --- | --- |
| [Arquitetura e decisoes](docs/arquitetura.md) | Produto, escopo, stack escolhida, alternativas e justificativas |
| [Banco de dados](docs/banco-de-dados.md) | Dicionario das 15 tabelas, relacionamentos, convencoes e migracao futura |
| [Regras de negocio](docs/regras-de-negocio.md) | Pessoas, casas, transacoes, saldos, categorias e settings |
| [API](docs/api.md) | Endpoints existentes, parametros, exemplos, Swagger e erros |
| [Desenvolvimento](docs/desenvolvimento.md) | Setup em outro computador, comandos, banco local e operacao |
| [Estado e proximos passos](docs/estado-e-proximos-passos.md) | Entregas, limitacoes verificadas e ordem de continuidade |
| [Skills e MCP](docs/skills-e-mcp.md) | Recomendacoes de ferramentas e workflows portaveis |
| [AGENTS.md](AGENTS.md) | Contexto curto para agentes que retomarem o repositorio |

## Stack

TypeScript + Node.js, Fastify, Drizzle ORM, SQLite (`better-sqlite3`), Zod,
React + Vite, Biome e pnpm workspaces.

```text
apps/api/        Backend, schema e migrations
apps/web/        Frontend React
packages/shared/ Tipos, enums e schemas Zod compartilhados
docs/           Decisoes, contratos e continuidade
```

## Inicio rapido

Com Node 22 e pnpm 9.15.4, execute na raiz do repositorio:

```bash
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
pnpm db:migrate
pnpm db:seed
pnpm dev:api
```

Copie o `.env` apenas no primeiro setup, sem sobrescrever configuracoes existentes.
Para detalhes de instalacao, variaveis e recuperacao dos dados, consulte o
[guia de desenvolvimento](docs/desenvolvimento.md).

- API: <http://localhost:3333>
- Swagger UI: <http://localhost:3333/docs>
- OpenAPI JSON: <http://localhost:3333/docs/json>
- Frontend, ao executar `pnpm dev:web`: <http://localhost:5173>

O SQLite fica por padrao em `apps/api/data/app.sqlite` e nao e versionado.
As migrations e o lockfile sao versionados. Clonar o Git recupera o codigo e a
estrutura do banco, mas nao os lancamentos financeiros de outra maquina.
