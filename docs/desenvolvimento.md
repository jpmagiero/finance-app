# Desenvolvimento e continuidade em outro computador

Execute os comandos na raiz do clone, salvo indicacao contraria.
Nao dependa do caminho `/home/john/Projects/finance-app` em outras maquinas.

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

Correcao de uma orientacao anterior do chat: nvm normalmente usa `.nvmrc`, nao
`.node-version`. Este repositorio nao tem `.nvmrc`; portanto usar `nvm use 22`
explicitamente. Ferramentas compativeis podem ler `.node-version`.

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
pnpm dev:api
```

Copiar exemplos apenas quando os `.env` ainda nao existem. O `.env` do web e
opcional para o foco atual no backend. Nunca versionar valores privados.

Nao executar db:generate em cada clone: as migrations ja estao versionadas.
Gerar migration somente depois de alterar intencionalmente o schema.
Executar migrate e depois seed, em sequencia.

## Variaveis de ambiente

Arquivo `apps/api/.env`, carregado por dotenv:

| Variavel | Default | Uso |
| --- | --- | --- |
| HOST | 0.0.0.0 | Interface do servidor; usar 127.0.0.1 para limitar a maquina local |
| PORT | 3333 | Porta HTTP |
| DATABASE_URL | file:./data/app.sqlite | Caminho do SQLite |
| SEED_USER_NAME | Admin | Nome inicial |
| SEED_USER_EMAIL | admin@local | Email inicial, nao credencial de login |
| SEED_HOUSEHOLD_NAME | Casa | Nome da casa inicial |

Arquivo `apps/web/.env`: `VITE_API_URL=http://localhost:3333`.
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
| pnpm build | Typecheck em shared/API e build Vite no web |
| pnpm db:generate | Gera migration a partir do schema |
| pnpm db:migrate | Aplica migrations |
| pnpm db:seed | Provisiona dados iniciais |
| pnpm db:studio | Abre Drizzle Studio |

Nao existe script `test`, suite automatizada, `start` de producao ou bundle
compilado da API. `pnpm build` passar nao comprova que a API esta deployavel.
O shared tambem exporta fontes `.ts`, detalhe a resolver no build de producao.

Biome usa espacos, indentacao 2, largura 100, aspas duplas e ponto e virgula.
TypeScript usa strict, noUncheckedIndexedAccess e noImplicitOverride.

## Verificacao manual

Com a API iniciada:

```bash
curl --fail http://localhost:3333/health/
curl --fail http://localhost:3333/docs/json
curl --fail http://localhost:3333/households/current
```

Use `curl --fail` ou confira explicitamente status HTTP: curl sem essa opcao
pode terminar com sucesso mesmo recebendo 400/500.
Em testes futuros, usar Fastify inject e banco SQLite temporario com migrations.
Nao criar lancamentos de teste no banco financeiro pessoal.

## Banco, backup e troca de maquina

Git transporta codigo, docs, schema, migrations e lockfile. Nao transporta:
SQLite, `.env`, autenticacao de ferramentas/MCP ou preferencias locais.

Para continuar apenas o desenvolvimento, gerar banco novo com migrate/seed.
Para continuar com os mesmos dados, transferir tambem um backup consistente do
SQLite por um canal privado e ajustar DATABASE_URL. Nao publicar o banco no Git.

Um procedimento simples, ainda manual, e parar todos os processos que escrevem
no banco, copiar o arquivo e testar a restauracao em uma copia separada.
Se WAL for ativado futuramente, considerar os arquivos auxiliares ou usar o
mecanismo de backup do SQLite. Nao assumir que copiar o arquivo enquanto ha
escritas produz backup consistente. Nao existe rotina automatica implementada.

## Home server

Persistencia de volume, backup, HTTPS, controle de acesso e processo de producao
precisam ser implementados antes de considerar o deploy pronto.
A API atual escuta 0.0.0.0, reflete origens no CORS e nao autentica clientes.
Ela nao deve ser exposta publicamente como se os dados estivessem protegidos.

Swagger anuncia localhost:3333 e precisa ser ajustado para outro host/porta.
No web, localhost se refere ao navegador do usuario; ao acessar pela rede,
VITE_API_URL deve apontar para o servidor acessivel ou um proxy configurado.
Docker Compose, VPN e reverse proxy continuam como propostas de operacao.

## Como retomar uma tarefa

1. Ler README e o backlog; conferir `git status` para preservar trabalho existente.
2. Consultar arquitetura, regras e contratos da area que sera alterada.
3. Instalar com lockfile e usar um banco de desenvolvimento.
4. Implementar, validar comportamento e atualizar Swagger/docs afetados.
5. Executar check/typecheck/build e registrar verificacoes ou limitacoes reais.

Exemplo de contexto suficiente para uma nova sessao:

> Leia AGENTS.md, README.md e docs/estado-e-proximos-passos.md. O foco e o
> backend. Continue pelo primeiro item pendente, conferindo o codigo antes de
> considerar qualquer regra ja implementada.
