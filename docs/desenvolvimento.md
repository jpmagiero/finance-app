# Desenvolvimento e continuidade em outro computador

Execute os comandos na raiz do clone, salvo indicacao contraria.
Use caminhos do seu clone, sem depender de caminhos pessoais do chat.
Para um roteiro de ponta a ponta, consulte [retomada](retomada.md): separa dados
novos de restauracao de backup e fornece o contexto para a proxima sessao.

## Acesso e frontend (entrega atual)

A API exige login. Em banco novo, depois de migrations/seed, execute
auth:provision em terminal interativo para definir o primeiro acesso.
Em banco restaurado, use os logins existentes.
A interface usa /api no mesmo origin, com proxy Vite para a API.
Consulte [acesso e interface](acesso-e-interface.md) para comandos, permissoes
e configuracao LAN/VPN. Recorrencias e orcamentos tambem estao implementados;
a prioridade atual e o produto, com deploy postergado pelo usuario.

## Runtime e dependencias

Referencia atual: Node 22 e pnpm 9.15.4. `.node-version` contem `22`;
`package.json` declara `engines.node >=22` e `packageManager=pnpm@9.15.4`.
Isso nao certifica todas as futuras majors do Node, especialmente pelo driver
nativo better-sqlite3.

Se nvm ja estiver instalado:

```bash
nvm install 22
nvm use 22
corepack enable
corepack prepare pnpm@9.15.4 --activate
node --version
pnpm --version
```

Se Corepack nao estiver disponivel na instalacao do Node, uma alternativa e
`npm install --global pnpm@9.15.4`. Nao e necessario executar as duas formas.

O repositorio tem `.nvmrc` e `.node-version` com 22. Dentro do clone, nvm pode
selecionar essa major com `nvm install` e `nvm use`. Ferramentas compativeis
tambem podem ler `.node-version`.

No Windows com clone em `\\wsl.localhost\Ubuntu\...`, executar os comandos
dentro do WSL, nao pelo wrapper pnpm.cmd do Windows (CMD nao preserva cwd UNC).
Em automacao: `wsl -d Ubuntu -- bash -lc` com cwd Linux e nvm carregado.

Em shells de automacao com nvm instalado mas fora do PATH:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 22
```

Nao copiar node_modules de outro computador: reinstalar a partir do lockfile.
O better-sqlite3 tem componente nativo; se nao houver binario compativel, pode
ser necessario toolchain de compilacao do sistema e Python. Isso e requisito
de build, nao um backend Python.

## Primeiro setup

Depois de clonar o repositorio e entrar na raiz:

```bash
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm db:migrate
pnpm db:seed
pnpm auth:provision
pnpm dev
```

Copiar exemplos apenas quando os `.env` ainda nao existem. O `.env` do web e
opcional quando o proxy local padrao atende. Nunca versionar valores privados.
O roteiro acima e para banco novo. Em banco restaurado/existente, nao rodar seed;
aplicar migrations e usar as credenciais existentes. auth:provision somente se
for necessario criar/recuperar o primeiro login ou redefinir uma senha.

Nao executar db:generate em cada clone: as migrations ja estao versionadas.
Gerar migration somente depois de alterar intencionalmente o schema.
Em banco novo: executar migrate e depois seed, em sequencia. Migrations atuais
0000 a 0003; recorrencias usam 0002 e orcamentos usam 0003. Em banco existente,
somente migrate para atualizar a estrutura.

## Variaveis de ambiente

Arquivo `apps/api/.env`, carregado por dotenv:

| Variavel | Default | Uso |
| --- | --- | --- |
| HOST | 0.0.0.0 | Interface do servidor; usar 127.0.0.1 para limitar a maquina local |
| PORT | 3333 | Porta HTTP |
| DATABASE_URL | file:./data/app.sqlite | Caminho do SQLite |
| COOKIE_SECURE | false | true ao servir HTTPS |
| WEB_ORIGIN | sem default | Origin autorizado; Compose define https://APP_HOST |
| OPENAPI_SERVER_URL | / | Prefixo da API no Swagger; /api no Compose |
| SEED_USER_NAME | Admin | Nome inicial |
| SEED_USER_EMAIL | admin@local | Email inicial, nao credencial de login |
| SEED_HOUSEHOLD_NAME | Casa | Nome da casa inicial |

Arquivo apps/web/.env: API_PROXY_TARGET=http://127.0.0.1:3333 (proxy Vite).
Variaveis VITE sao publicas no bundle; nao armazenar segredos nelas.

Os scripts pnpm filtrados executam com cwd em `apps/api`. O caminho relativo do
banco e resolvido a partir desse cwd, tanto na API quanto no drizzle-kit.
Executar `tsx apps/api/src/index.ts` diretamente da raiz pode apontar para outro
arquivo. Preferir os scripts do workspace.

O prefixo `file:` e removido antes de abrir o arquivo local. Isso nao representa
suporte a banco remoto/libSQL. Diretorios personalizados devem existir antes
de abrir a conexao.

## Seed

O seed cria, se nao encontrar os registros esperados:

- Usuario inicial sem senha, casa e membership owner.
- Pessoa financeira vinculada a esse usuario e settings padrao.
- Categorias: Salario, Outras receitas, Moradia, Mercado, Transporte, Saude,
  Lazer, Assinaturas, Outras despesas, marcadas isSystem.

Nao cria contas, tags ou transacoes de exemplo. O seed procura usuario por email
e casa por nome; nao e um provisionamento multiusuario seguro. Alterar parametros
pode criar novos registros ou associacoes. Nao usar como mecanismo de convite.

## Comandos disponiveis

| Comando | Resultado |
| --- | --- |
| pnpm dev:api | Fastify via tsx watch |
| pnpm dev:web | Vite; default 5173 |
| pnpm dev | API e web em paralelo |
| pnpm check | Biome sem escrita |
| pnpm check:fix | Biome aplicando correcoes |
| pnpm lint / pnpm format | Lint / formatacao com escrita no segundo |
| pnpm typecheck | TypeScript nos workspaces |
| pnpm test | Node Test Runner + tsx, Fastify inject e SQLite temporario |
| pnpm build | Typecheck + bundle ESM da API e build Vite do web |
| pnpm start:api | Node executando apps/api/dist/index.js |
| pnpm test:e2e / pnpm test:all | Playwright isolado / suites Node e navegador |
| pnpm db:backup / pnpm db:restore | Snapshot consistente / restauracao para arquivo novo |
| pnpm db:generate | Gera migration a partir do schema |
| pnpm db:migrate | Aplica migrations |
| pnpm db:seed | Provisiona dados iniciais |
| pnpm db:studio | Abre Drizzle Studio |

A suite Node roda com `pnpm test`. Para E2E, instale Chromium e bibliotecas com
`pnpm exec playwright install --with-deps chromium` e rode `pnpm test:e2e`.
A configuracao inicia seus proprios servidores em 4333/4173 com SQLite descartavel.
O build de producao inclui shared no bundle; veja [producao](producao.md).

Biome usa espacos, indentacao 2, largura 100, aspas duplas e ponto e virgula.
TypeScript usa strict, noUncheckedIndexedAccess e noImplicitOverride.

## Verificacao manual

Com a API iniciada:

```bash
curl --fail http://localhost:3333/health/
curl --fail http://localhost:3333/docs/json
curl -i http://localhost:3333/households/current # 401 esperado sem cookie autenticado
```

Use `curl --fail` ou confira explicitamente status HTTP: curl sem essa opcao
pode terminar com sucesso mesmo recebendo 400/500.
A suite em `apps/api/src/tests/financial.test.ts` usa Fastify inject, cria banco
em diretorio temporario com migrations reais e fecha/remove os bancos ao terminar.
Define DATABASE_URL antes de importar app/db/env e nao carrega .env pessoal.
Inclui repeticao de migrations/seed em outro banco sintetico; testes de rollback
usam triggers que falham depois de gravacoes parciais.
Nao criar lancamentos de teste no banco financeiro pessoal.

Em 2026-10-26, ambiente WSL preparado com Node 22.23.4, pnpm 9.15.4 e
`pnpm install --frozen-lockfile`. A instalacao e local: outro clone ainda precisa
executar o setup. O build da API agora gera artefatos executaveis em dist.

## Banco, backup e troca de maquina

Git transporta codigo, docs, schema, migrations e lockfile. Nao transporta:
SQLite, `.env`, autenticacao de ferramentas/MCP ou preferencias locais.

Para continuar apenas o desenvolvimento, gerar banco novo com migrate/seed.
Para continuar com os mesmos dados, transferir tambem um backup consistente do
SQLite por um canal privado e ajustar DATABASE_URL. Nao publicar o banco no Git.

Use pnpm db:backup: o snapshot online inclui commits no WAL e valida integridade
e vinculos. Restore exige destino novo e nao sobrescreve o original. O Compose
inclui agendamento e retencao. Consulte [producao](producao.md) para exportacao,
restauracao e backup fora do servidor. Nao copie diretamente um SQLite ativo.

## Home server

Compose, volumes persistentes, backup, HTTPS e processo de producao estao
implementados. A implantacao ainda precisa ser validada com Docker ativo no servidor.
A API escuta 0.0.0.0 por default e exige sessao nas rotas financeiras.
CORS fica fechado salvo WEB_ORIGIN explicito. Sessoes/CSRF nao substituem
HTTPS, configuracao do proxy e backups antes de disponibilizar fora do ambiente
de desenvolvimento.

Swagger usa OPENAPI_SERVER_URL (default /, Compose /api).
No web, o navegador usa /api no host acessado; Vite encaminha ao backend,
conforme API_PROXY_TARGET. Em producao, o reverse proxy precisa preservar
esse contrato e encaminhar /api removendo o prefixo.
Docker Compose e Caddy estao versionados; DNS/VPN sao configuracoes externas.

## Como retomar uma tarefa

1. Ler README e o backlog; conferir `git status` para preservar trabalho existente.
2. Consultar arquitetura, regras e contratos da area que sera alterada.
3. Instalar com lockfile e usar um banco de desenvolvimento.
4. Implementar, validar comportamento e atualizar Swagger/docs afetados.
5. Executar check/typecheck/build/test; test:e2e quando alterar a interface.
   Registrar verificacoes e limitacoes reais, atualizar o backlog apos a entrega.

Exemplo de contexto suficiente para uma nova sessao:

> Leia AGENTS.md, README.md, docs/retomada.md e docs/estado-e-proximos-passos.md.
> A prioridade e evoluir o app, com deploy postergado. Lancamentos, dashboard,
> acesso, recorrencias explicitas e orcamentos estao implementados. Preserve
> mudancas locais, use banco sintetico e continue pela feature que eu indicar.
