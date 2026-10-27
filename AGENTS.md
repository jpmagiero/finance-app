# Contexto do projeto

Leia [README.md](README.md), [arquitetura](docs/arquitetura.md),
[regras de negocio](docs/regras-de-negocio.md) e
[estado atual](docs/estado-e-proximos-passos.md) antes de implementar.
Consulte [API](docs/api.md) e [banco](docs/banco-de-dados.md) conforme a tarefa.

## Decisoes estabelecidas

- Estado atual: backend e frontend financeiros com acesso individual;
  foco seguinte em contratos restantes e validacao do deploy no home server.
- Monorepo pnpm: `apps/api`, `apps/web`, `packages/shared`.
- Fastify + TypeScript + Drizzle + SQLite; React + Vite; Biome em ambos.
- Node 22 e pnpm 9.15.4 sao as referencias do setup atual.
- Dinheiro em centavos inteiros; UUIDs em texto gerados na aplicacao.
- `users` representa login; `household_people` representa a pessoa financeira.
- Pessoa, conta e favorecido sao opcionais nas transacoes; casa e obrigatoria.
- Uma pessoa pode lancar gastos de outra sem trocar de login.
- Tags e settings fazem parte do MVP; settings e uma tabela tipada por casa.
- Imports, attachments, convites e rateio entre pessoas continuam adiados.
- Sessoes persistentes foram adotadas: cookie HttpOnly, CSRF e hash do token;
  senhas com scrypt. Nunca adicionar bypass de autenticacao ao app real.
- Primeira entrega (2026-10-26): lancamentos e dashboard; recorrencias/orcamentos depois.
- Acesso inicial por LAN/VPN com logins individuais. Autorizacao verifica
  membership, casa e papel a cada requisicao. Primeiro login por auth:provision;
  veja docs/acesso-e-interface.md. Roles isoladas no banco nao sao autorizacao.

## Como trabalhar

- Regras de negocio nos services; rotas cuidam de HTTP, validacao e Swagger.
  Dashboard e households tambem usam services. Preservar essa separacao.
- Atualize schemas Zod e contratos OpenAPI juntos; hoje eles sao separados.
- Preserve atomicidade entre transacoes, splits, tags e movimentos de saldo.
- Confira vinculos com a mesma casa. Validacao de FK nao substitui autorizacao.
- Preserve historico: pessoas/contas/categorias sao arquivadas; transacoes usam
  soft delete; tags/payees em uso nao podem ser excluidos.
- Nao trate limitacoes catalogadas como regras desejadas; veja o backlog.
- Nao use o SQLite pessoal para testes. Use banco temporario e dados sinteticos.
- Versione migrations e lockfile; nao versione `.env`, SQLite ou credenciais MCP.
- Depois de mudar comportamento, atualize a documentacao correspondente.

## Verificacao

Execute na raiz: `pnpm check`, `pnpm typecheck`, `pnpm build`.
O build da API gera ESM em dist via esbuild, incluindo shared; start usa Node.
Execute tambem `pnpm test`: Node Test Runner + Fastify inject, migrations reais
e SQLite temporario. Execute pnpm test:e2e para mudancas na interface (Playwright,
Chromium e bibliotecas de sistema instalados). Nao declare testes que nao foram executados.
Mudancas em saldos pedem verificacao de criacao, edicao,
mudanca de status, transferencia, exclusao e rollback.

Producao: consulte docs/producao.md. Nunca testar restauracao no banco pessoal;
restore exige destino novo. Compose/Caddy e rotina de backup estao versionados.

## Continuidade

Consulte [Skills e MCP](docs/skills-e-mcp.md) para ferramentas recomendadas.
Essas recomendacoes nao significam que skills ou servidores estejam instalados.
