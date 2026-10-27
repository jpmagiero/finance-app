# Retomar o Finance App em outra máquina

Referência de continuidade: 2026-10-26. Este guia não depende do histórico do chat
nem de caminhos pessoais. Consulte [estado e próximos passos](estado-e-proximos-passos.md)
para escolher o próximo bloco de trabalho.

## O que já está pronto

API e interface de lançamentos, dashboard, cadastros/settings, login individual,
autorização por casa/papel, recorrências com geração explícita de pendentes e
orçamentos. API compilada, Compose/Caddy e backup/restauração existem, mas o
usuário priorizou desenvolvimento do app antes de validar o deploy.

Stack: Node 22, pnpm 9.15.4, TypeScript, Fastify, Drizzle/SQLite/better-sqlite3,
React/Vite e Biome. O projeto não depende de MCP, plugins, contas de IA ou Docker
para desenvolver localmente.

## Antes de sair da máquina atual

- Versione e envie ao remoto o código, as docs, migrations/metadados e lockfile que
  deseja levar. Confirme a branch e o commit desejados. Arquivos apenas locais,
  inclusive staged, não aparecem no clone de outra máquina.
- Se quiser os mesmos dados financeiros, gere um snapshot com
  `npm run db:backup` na raiz. O default é apps/api/backups; escolha o arquivo
  exato informado pelo comando e transfira por canal privado.
- Guarde os valores necessários do .env separadamente. Não publique banco,
  backups, .env ou credenciais no Git.
- Não copie node_modules, dist, cache do navegador ou caminhos temporários desta
  sessão. Reinstale as dependências na outra máquina.

Backup contém dados financeiros, hashes de senha e sessões. O Git contém somente
o código e a estrutura; não sincroniza lançamentos entre dois computadores.
Não usar duas cópias independentes do SQLite como se houvesse sincronização.

## Preparar o clone

Os comandos abaixo usam shell Linux/WSL, a partir da raiz do clone na branch
escolhida. No Windows com projeto dentro do WSL, execute no terminal do WSL.

Com nvm já instalado:

```bash
nvm install 22
nvm use 22
corepack enable
corepack prepare pnpm@9.15.4 --activate
node --version
pnpm --version
pnpm install --frozen-lockfile
git status --short
```

Se Corepack não existir, instale pnpm 9.15.4 usando npm; não é necessário usar
ambos os métodos. better-sqlite3 é nativo: na ausência de binário compatível,
serão necessárias ferramentas de compilação do sistema e Python. Os detalhes
do ambiente estão em [desenvolvimento](desenvolvimento.md).

Os scripts npm da raiz chamam pnpm internamente. Use pnpm para instalar,
preservando pnpm-lock.yaml; não criar outro lockfile com npm install.

Copie apenas os exemplos cujos arquivos de destino ainda não existem:

```bash
cp apps/api/.env.example apps/api/.env
# Opcional: o proxy Vite já tem default local.
cp apps/web/.env.example apps/web/.env
```

Ajuste apps/api/.env para a máquina. Caminhos relativos de DATABASE_URL são
resolvidos a partir de apps/api quando se usam os scripts da raiz.

## Caminho A: dados novos para desenvolvimento

Use um SQLite separado dos dados pessoais. Em apps/api/.env, por exemplo:

```dotenv
DATABASE_URL=file:./data/development.sqlite
COOKIE_SECURE=false
```

Se quiser um nome/e-mail de seed próprios, ajuste SEED_USER_NAME,
SEED_USER_EMAIL e SEED_HOUSEHOLD_NAME antes do primeiro seed. Para vincular o
primeiro login à pessoa do seed, use esse mesmo e-mail no provisionamento.

```bash
npm run db:migrate
npm run db:seed
npm run auth:provision
npm run dev
```

auth:provision lista casas existentes por número/ID; não cria nem renomeia casas.
A senha tem 12 a 128 caracteres, sem eco, com nova tentativa em caso de erro.
Não existe senha padrão. Usar outro login não troca automaticamente a pessoa
financeira atribuída ao lançamento.

## Caminho B: recuperar os mesmos dados de um backup

Transfira o snapshot por canal privado e mantenha a API parada durante a troca.
Use caminhos absolutos válidos na máquina de destino:

```bash
npm run db:restore -- /caminho/privado/snapshot.sqlite /caminho/privado/restored.sqlite
```

O destino deve ser um arquivo novo. O comando valida o backup e recusa sobrescrever
um arquivo existente. Ajuste apps/api/.env para
DATABASE_URL=file:/caminho/privado/restored.sqlite e então:

```bash
npm run db:migrate
npm run dev
```

Não rodar seed em banco restaurado. O backup já contém as pessoas, logins,
vínculos e hashes das senhas; entre com as credenciais existentes. Não é
necessário rodar auth:provision novamente. Use-o apenas se precisar redefinir a
senha, sabendo que isso revoga as sessões do usuário.

Não copiar diretamente um SQLite ativo. O comando de backup inclui commits no
WAL e produz um snapshot independente. A restauração não altera .env, não inicia
serviços e não sincroniza com o banco da máquina anterior.

## Migrations e verificação

As migrations atuais são:
- 0000: schema financeiro inicial.
- 0001: sessões e índices de acesso.
- 0002: splits/tags de recorrências, notes e chave de ocorrência.
- 0003: moeda e arquivamento de orçamentos.

Aplicar as migrations versionadas com db:migrate. Não executar db:generate para
preparar um clone; só gerar migration ao alterar intencionalmente o schema.

Na raiz:

```bash
npm run check
npm run typecheck
npm run test
npm run build
pnpm exec playwright install --with-deps chromium
npm run test:e2e
```

A instalação das bibliotecas do Chromium pode exigir privilégios administrativos.
Use a instalação padrão do Playwright na nova máquina; não reutilize diretórios
/tmp ou LD_LIBRARY_PATH usados como adaptação no ambiente anterior.

Os testes Node e E2E usam SQLite temporário e dados sintéticos. Playwright inicia
API/Vite próprios nas portas 4333/4173 e não reutiliza servidores existentes;
essas portas precisam estar livres. Os testes não devem apontar para o SQLite
pessoal. Dados reais não são necessários para validar uma feature.

Última verificação de implementação registrada: 121 testes Node e 4 cenários E2E,
check/typecheck/build e diff checks passaram. Isso é evidência da máquina anterior,
não substitui a execução dos checks na máquina nova.

## Abrir e entender as visões

Frontend: http://localhost:5173. API: http://localhost:3333/health/.
Swagger: http://localhost:3333/docs. O navegador usa /api via proxy Vite;
não configurar localhost de outro computador dentro do bundle do frontend.

Toda a casa consolida todas as pessoas e lançamentos sem pessoa.
Casa / sem pessoa filtra somente lançamentos sem atribuição financeira.
Por isso, gastos atribuídos a John/Admin aparecem em Toda a casa e nos respectivos
filtros individuais, mas não em Casa / sem pessoa.

A seleção da casa vem da sessão/membership. O login que registrou e a pessoa
financeira do lançamento são conceitos separados. Veja [acesso](acesso-e-interface.md).

## Contexto para a próxima sessão

Copie este pedido, acrescentando a feature escolhida:

> Leia AGENTS.md, README.md, docs/retomada.md e docs/estado-e-proximos-passos.md.
> O núcleo financeiro, acesso, recorrências explícitas e orçamentos estão entregues.
> A prioridade é desenvolver o app; deploy está postergado. Confira git status
> para preservar mudanças existentes e valide o ambiente com dados sintéticos.
> Continue pela feature que eu indicar, atualizando contratos, testes e docs.
