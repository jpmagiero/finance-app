# Contexto do projeto

Leia [README.md](README.md), [arquitetura](docs/arquitetura.md),
[regras de negocio](docs/regras-de-negocio.md) e
[estado atual](docs/estado-e-proximos-passos.md) antes de implementar.
Consulte [API](docs/api.md) e [banco](docs/banco-de-dados.md) conforme a tarefa.

## Decisoes estabelecidas

- Prioridade atual: backend ate finalizar os endpoints do MVP.
- Monorepo pnpm: `apps/api`, `apps/web`, `packages/shared`.
- Fastify + TypeScript + Drizzle + SQLite; React + Vite; Biome em ambos.
- Node 22 e pnpm 9.15.4 sao as referencias do setup atual.
- Dinheiro em centavos inteiros; UUIDs em texto gerados na aplicacao.
- `users` representa login; `household_people` representa a pessoa financeira.
- Pessoa, conta e favorecido sao opcionais nas transacoes; casa e obrigatoria.
- Uma pessoa pode lancar gastos de outra sem trocar de login.
- Tags e settings fazem parte do MVP; settings e uma tabela tipada por casa.
- Imports, attachments, sessoes, convites e rateio entre pessoas foram adiados.
- Autenticacao foi adiada, nao implementada. Roles no banco nao sao autorizacao.

## Como trabalhar

- Regras de negocio nos services; rotas cuidam de HTTP, validacao e Swagger.
  Dashboard e households ainda precisam concluir essa separacao.
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
O build atual da API apenas verifica tipos, sem gerar um executavel de producao.
Nao existe suite automatizada ou script `test` ainda; nao declare testes que nao
foram executados. Mudancas em saldos pedem verificacao de criacao, edicao,
mudanca de status, transferencia, exclusao e rollback.

## Continuidade

Consulte [Skills e MCP](docs/skills-e-mcp.md) para ferramentas recomendadas.
Essas recomendacoes nao significam que skills ou servidores estejam instalados.
