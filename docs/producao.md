# Produção no home server

Entrega de 2026-10-26: API compilada, frontend estático, proxy HTTPS e backups
com restauração verificada. A configuração é para uma instância da API e um
SQLite local ao servidor. A implantação no servidor e a instalação da CA nos
dispositivos ainda precisam ser feitas pelo operador.

## Build e execução com npm

Node 22 e pnpm 9.15.4 instalados. Na raiz:

```bash
pnpm install --frozen-lockfile
npm run check
npm run typecheck
npm run test
npm run build
npm run start:api
```

Os scripts npm chamam pnpm internamente. O build usa esbuild para gerar ESM em
apps/api/dist, incluindo o shared no bundle. Dependências externas e o driver
nativo continuam em node_modules. O frontend sai em apps/web/dist; Vite dev e
vite preview não são o servidor de produção.

A API lê apps/api/.env quando iniciada por start:api. Para os comandos compilados:

```bash
pnpm --filter @finance/api db:migrate:prod
# Somente para um banco novo:
pnpm --filter @finance/api db:seed:prod
pnpm --filter @finance/api auth:provision:prod
```

As migrations ficam em apps/api/drizzle e são distribuídas junto do dist.
O empacotamento isolado usa pnpm --filter @finance/api deploy --prod DESTINO.
Esse diretório roda com Node e dependências de produção, sem tsx/TypeScript.
Não copiar node_modules entre sistemas ou arquiteturas diferentes.

## Compose e HTTPS na LAN/VPN

Requisitos: Docker Engine em execução, Docker Compose e DNS da rede/VPN
resolvendo um hostname para o IP do home server. Sem portas encaminhadas no
roteador para esta entrega interna.

```bash
cp deploy/.env.example deploy/.env
# Edite APP_HOST, por exemplo finance.home.arpa, com o DNS correspondente.
docker compose --env-file deploy/.env config --quiet
docker compose --env-file deploy/.env build
docker compose --env-file deploy/.env run --rm --no-deps api node dist/db/migrate.js
# Apenas banco vazio:
docker compose --env-file deploy/.env run --rm --no-deps api node dist/db/seed.js
docker compose --env-file deploy/.env run --rm --no-deps api node dist/db/provision-user.js
docker compose --env-file deploy/.env up -d
docker compose --env-file deploy/.env ps
```

Copiar o exemplo apenas no primeiro setup. APP_HOST contém somente hostname
(e porta se necessário), sem https:// nem caminho. finance.localhost é um
default para testar na própria máquina; em outro dispositivo localhost aponta
para o próprio dispositivo. Configure DNS real da LAN/VPN para acesso remoto.

O proxy publica 80/443 e redireciona HTTP para HTTPS. A API fica somente na
rede interna do Compose. /api é removido pelo proxy; /docs preserva o caminho
e OpenAPI anuncia /api. WEB_ORIGIN e COOKIE_SECURE=true já estão no Compose.
O cookie de login é Secure, HttpOnly e SameSite=Strict. O healthcheck usa
/health/ready: retorna 503 se o banco/migration de sessões não puder ser lido;
isso não substitui uma verificação completa da integridade do banco.

TLS_ISSUER=internal usa a CA local do Caddy. Instale somente seu certificado
raiz público como confiável em cada dispositivo/navegador:

```bash
docker compose --env-file deploy/.env cp proxy:/data/caddy/pki/authorities/local/root.crt ./finance-local-ca.crt
```

Não ignore alertas TLS no uso normal. Preserve caddy_data, que contém a CA e
suas chaves privadas; nunca distribua essas chaves. Para domínio público com
DNS e desafios ACME alcançáveis, defina TLS_ISSUER=acme e ACME_EMAIL válido.
A configuração não provisiona DNS, VPN ou regras do roteador.

Volumes: finance_data (SQLite), finance_backups (snapshots), caddy_data e
caddy_config. API roda como usuário node, com filesystem raiz somente leitura;
somente os volumes e /tmp aceitam escrita. Não use down -v em dados reais.

## Backups

O serviço backup faz um snapshot ao iniciar e a cada BACKUP_INTERVAL_HOURS
(default 24). BACKUP_KEEP=14 preserva os 14 snapshots mais recentes produzidos
pela ferramenta, após validar um novo. O processo usa a API online do SQLite,
inclui commits no WAL e publica um arquivo independente com journal DELETE.
Valida integrity_check, foreign_key_check e tabelas essenciais. Falha sai com
código diferente de zero e aparece nos logs; Compose tenta reiniciar o serviço.

```bash
docker compose --env-file deploy/.env logs --tail=100 backup
docker compose --env-file deploy/.env run --rm --no-deps backup node dist/db/backup.js
mkdir -p private-backups
chmod 700 private-backups
docker compose --env-file deploy/.env cp backup:/backups/. ./private-backups/
```

Confira periodicamente logs e idade dos snapshots. Copie-os também para outro
dispositivo por canal privado; o volume no mesmo disco não protege contra perda
do servidor. Snapshots incluem dados financeiros, hashes de senha e sessões;
proteja acesso e transporte. Não copiar o arquivo SQLite ativo diretamente.

Fora do Docker, com o DATABASE_URL correto no ambiente/apps/api/.env:

```bash
npm run db:backup
# Destino padrão apps/api/backups, ou BACKUP_DIR absoluto no ambiente.
# Após build, sem tsx:
pnpm --filter @finance/api db:backup:prod
```

## Restauração sem sobrescrever o original

O comando exige destino novo, recusa arquivo existente e valida origem/destino.
Pare todos os escritores e o agendador antes de trocar o banco. Não restaure por
cima de app.sqlite; preserve também seus auxiliares WAL/SHM, se existirem.

Exemplo com um snapshot já exportado para private-backups/snapshot.sqlite:

```bash
docker compose --env-file deploy/.env stop api backup proxy
docker compose --env-file deploy/.env run --rm --no-deps -v "$PWD/private-backups/snapshot.sqlite:/restore/snapshot.sqlite:ro" api node dist/db/restore.js /restore/snapshot.sqlite /data/recovered-2026-10-26.sqlite
# Em deploy/.env, altere DATABASE_FILE=recovered-2026-10-26.sqlite
docker compose --env-file deploy/.env run --rm --no-deps api node dist/db/migrate.js
docker compose --env-file deploy/.env up -d --force-recreate
```

Não rode seed na recuperação. Confira login, contas, saldos e lançamentos antes
de considerar a recuperação concluída. Se necessário, auth:provision:prod
redefine senha e revoga sessões de um usuário. Restaurar snapshot pode recuperar
sessões ainda válidas daquele instante.

Sem Docker: npm run db:restore -- /caminho/snapshot.sqlite /caminho/novo.sqlite;
ajuste DATABASE_URL para o novo arquivo antes de reiniciar. O restore não altera
.env e não inicia serviços automaticamente.

## Atualizações e validação desta entrega

Antes de atualizar: gere/exporte backup, pare escritores, construa a nova versão,
aplique migrations e só então inicie serviços. Não há rollback automático de
migration; preserve a imagem e o snapshot anteriores.

Verificado com SQLite sintético: migrations/seed/provisionamento compilados,
instalação isolada com dependências apenas de produção, Node executando dist,
Caddy com CA local validada pelo cliente, SPA, Swagger /api, login e cookie
Secure, CSRF, logout, backup/restauração compilados. Compose config foi validado.
O daemon Docker estava indisponível neste ambiente: as imagens e os contêineres
ainda precisam ser construídos/exercitados em um host com Docker ativo. DNS,
certificados dos dispositivos e backup externo não foram configurados aqui.
