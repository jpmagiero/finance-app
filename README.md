# Finance App

Aplicativo web de controle financeiro familiar, inicialmente para duas pessoas,
com hospedagem em home server. Deve permitir acompanhar receitas, despesas e
contas de forma individual e consolidada, mesmo para pessoas sem login.

## Por onde continuar

Esta documentacao substitui a dependencia do historico do chat. Foi consolidada
em **2026-10-20**, a partir das decisoes discutidas e do codigo no commit
`5bbbb44` (`feat/create-services`).

**Estado atual:** backend financeiro com autenticacao/autorizacao e frontend
funcional para cadastros, lancamentos e dashboard. Ha testes com SQLite temporario.
API compilada, Compose/Caddy HTTPS e backups estao implementados; a implantacao
no servidor ainda precisa de validacao com Docker ativo. Recorrencias agora estao implementadas com geracao explicita de pendentes;
orcamentos tambem estao implementados, com limites por categoria e consumo
confirmado/pendente por casa ou pessoa.
Existir uma tabela nao significa que a feature esta pronta.

Escopo confirmado em **2026-10-26**: primeira entrega com lancamentos e
dashboard, acessada pela rede de casa ou VPN com logins individuais.
Recorrencias e orcamentos foram desenvolvidos na evolucao seguinte. Veja o
[plano atualizado](docs/analise-e-plano-2026-10-26.md).

| Documento | Conteudo |
| --- | --- |
| [Arquitetura e decisoes](docs/arquitetura.md) | Produto, escopo, stack escolhida, alternativas e justificativas |
| [Banco de dados](docs/banco-de-dados.md) | Dicionario das 18 tabelas, relacionamentos, convencoes e migracao futura |
| [Regras de negocio](docs/regras-de-negocio.md) | Pessoas, casas, transacoes, saldos, categorias e settings |
| [Acesso e interface](docs/acesso-e-interface.md) | Primeiro login, permissoes, proxy, fluxos e limites da entrega |
| [Recorrencias](docs/recorrencias.md) | Regras, calendario, geracao de pendentes e idempotencia |
| [Orcamentos](docs/orcamentos.md) | Limites por categoria, periodos, pessoa/casa e consumo |
| [Producao](docs/producao.md) | Build/start, Compose, HTTPS, backups e restauracao |
| [API](docs/api.md) | Endpoints existentes, parametros, exemplos, Swagger e erros |
| [Desenvolvimento](docs/desenvolvimento.md) | Setup em outro computador, comandos, banco local e operacao |
| [Estado e proximos passos](docs/estado-e-proximos-passos.md) | Entregas, limitacoes verificadas e ordem de continuidade |
| [Analise e plano de evolucao](docs/analise-e-plano-2026-10-26.md) | Revisao de 2026-10-26, prioridades, marcos e criterios de conclusao |
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
pnpm test
cp apps/api/.env.example apps/api/.env
pnpm db:migrate
pnpm db:seed
pnpm auth:provision
pnpm dev
```

Copie o `.env` apenas no primeiro setup, sem sobrescrever configuracoes existentes.
Para detalhes de instalacao, variaveis e recuperacao dos dados, consulte o
[guia de desenvolvimento](docs/desenvolvimento.md).

- API: <http://localhost:3333>
- Swagger UI: <http://localhost:3333/docs>
- OpenAPI JSON: <http://localhost:3333/docs/json>
- Frontend, ao executar `pnpm dev:web`: <http://localhost:5173>

O comando auth:provision pede os dados do primeiro login e uma senha de no minimo
12 caracteres. Nao existe senha padrao. Em banco existente, rode db:migrate
antes de provisionar; db:seed e para o setup inicial. Veja o
[guia de acesso](docs/acesso-e-interface.md).

O SQLite fica por padrao em `apps/api/data/app.sqlite` e nao e versionado.
As migrations e o lockfile sao versionados. Clonar o Git recupera o codigo e a
estrutura do banco, mas nao os lancamentos financeiros de outra maquina.
