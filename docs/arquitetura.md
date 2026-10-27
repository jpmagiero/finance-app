# Arquitetura e decisoes

Referencia: 2026-10-20, codigo-base `5bbbb44`. Este arquivo registra decisoes
aceitas; propostas e lacunas estao identificadas como tais.

## Objetivo e usuarios

Controle financeiro domestico para o usuario e sua esposa, inicialmente com
pouco volume de dados e acesso interno em home server. O produto deve mostrar
receitas, despesas, saldo, evolucao mensal, consumo por categoria e visoes
individuais ou consolidadas da casa.

Uma pessoa pode registrar um gasto de outra pessoa da casa. Nao se deve exigir
login para cada pessoa representada nos lancamentos. A mesma pessoa financeira
pode receber um login posteriormente sem perder o historico.

## Escopo e ordem de entrega

O MVP contempla cadastros de pessoas, contas opcionais, categorias, favorecidos,
tags, receitas/despesas/transferencias, splits por categoria, settings da casa
e dashboard mensal. Recorrencias e orcamentos foram incluidos no schema e no
planejamento do MVP. Recorrencias agora possuem API e interface, com geracao
explicita de pendentes. Orcamentos possuem API/interface com limites por
categoria, casa/pessoa, periodos e moeda explicita.

A prioridade anterior foi concluir a API; a interface financeira ja esta funcional.
Previsao de gastos e renda fica para uma etapa posterior, com base no historico,
recorrencias, compromissos futuros e medias por categoria.

Ficaram fora agora: importacoes CSV/OFX, anexos/comprovantes, rateio entre pessoas,
convites por e-mail, auditoria detalhada, faturas completas e parcelamento avancado.
Nao existem integracoes bancarias ou uso de IA em runtime.

### Revisao da primeira entrega em 2026-10-26

O usuario confirmou uma primeira entrega com lancamentos e dashboard,
incluindo os cadastros e settings necessarios. Recorrencias e orcamentos
passam para uma evolucao posterior, sem exigir remocao das tabelas existentes.
A entrega de acesso e interface funcional foi concluida no bloco seguinte de
2026-10-26; detalhes em [acesso e interface](acesso-e-interface.md).

O acesso inicial sera pela rede de casa ou VPN com logins individuais.
Autenticacao e autorizacao usam sessoes no SQLite, cookie HttpOnly e CSRF,
com senhas scrypt. Convites continuam fora do escopo. Ver [plano atualizado](analise-e-plano-2026-10-26.md).

## Stack escolhida

| Parte | Decisao | Motivo |
| --- | --- | --- |
| Linguagem | TypeScript no back e front | Experiencia do mantenedor com Node/TS, produtividade e contratos compartilhados |
| Runtime | Node.js; referencia atual Node 22 | Processo convencional no home server e ecossistema conhecido |
| API | Fastify | Plugins, logging Pino, validacao por schemas e baixo custo de framework |
| Persistencia | Drizzle ORM + SQLite | Modelo relacional tipado, migrations e operacao simples |
| Driver | better-sqlite3 | Acesso local sincrono ao SQLite, adequado ao escopo pequeno |
| Validacao | Zod | Ja usado em env e payloads; enums e tipos compartilhados |
| Frontend | React + Vite | Aplicacao interna com dashboard, sem necessidade inicial de SSR |
| Qualidade | Biome + TypeScript strict | Um padrao de lint/format para todo o repositorio |
| Documentacao HTTP | @fastify/swagger + @fastify/swagger-ui | OpenAPI e exploracao da API em `/docs` |
| Organizacao | Monorepo com pnpm workspaces | Mudancas coordenadas e compartilhamento de contratos |

As versoes declaradas estao nos `package.json`; as resolvidas estao no
`pnpm-lock.yaml`. Os ranges originais nao representam necessariamente a versao
exata instalada. Nao atualizar dependencias apenas para acompanhar este documento.

### Alternativas consideradas

- **Hono:** considerado pela API leve e suporte a diferentes runtimes/edge.
  Fastify foi escolhido para o servidor Node convencional e seus plugins.
- **NestJS:** considerado, mas sua estrutura nao foi necessaria para o tamanho inicial.
- **Next.js:** considerado; React + Vite atende o dashboard interno sem exigir SSR.
- **Prisma:** considerado; Drizzle foi a escolha aceita para acesso relacional e migrations.
- **PostgreSQL:** primeira sugestao, substituida por SQLite pela simplicidade operacional.
- **MySQL/MariaDB:** alternativas relacionais validas, sem necessidade concreta aqui.
- **MongoDB:** nao escolhido; relacionamentos e integridade sao centrais no dominio.
- **DuckDB:** cogitado para analytics, nao como banco transacional principal.
- **Go/Rust/Python:** nao houve benchmark comparativo nem escolha por essas linguagens.
  A decisao de TS considera o uso esperado e manutencao, nao uma alegacao de ser
  a linguagem mais rapida. Python so foi cogitado para previsoes futuras.

TanStack Query, React Router, bibliotecas de graficos e frameworks de UI foram
sugestoes iniciais; nao foram instalados nem escolhidos definitivamente.

## Por que SQLite agora

Para dois usuarios, baixo volume e uma API local, um banco em arquivo evita
administrar um servidor de banco adicional. SQLite nao tem um daemon separado;
consome CPU, memoria e disco dentro do processo que o utiliza.

Postgres continua sendo uma alternativa futura se concorrencia de escrita,
operacao em multiplas instancias ou outros requisitos justificarem. Os numeros
de RAM citados na conversa foram estimativas gerais, nao medicoes deste projeto.
Nenhuma decisao depende de um valor fixo de consumo.

IDs textuais, centavos inteiros e separacao de services facilitam uma migracao,
mas Drizzle nao torna os dialetos intercambiaveis. Sera necessario adaptar schema,
driver, migrations e transferencia de dados. Veja [banco](banco-de-dados.md).

## Monorepo e responsabilidades

```text
finance-app/
  apps/
    api/
      src/
        app.ts            Montagem do Fastify e plugins
        index.ts          Inicializacao do servidor
        env.ts            Validacao de ambiente
        routes/           HTTP, parse de entrada e contratos Swagger
        services/         Regras de negocio e consultas Drizzle
        db/               Conexao, schema e seed
        lib/              IDs, datas, normalizacao, erros e schemas de docs
        plugins/          Swagger
      drizzle/            Migrations SQL e metadados versionados
      data/               Banco local ignorado pelo Git
    web/                  React, Vite e CSS
  packages/shared/        Tipos, constantes, schemas Zod
  docs/                   Memoria do projeto
```

Fluxo principal: HTTP -> rota -> validacao -> service -> Drizzle -> SQLite.
O pacote shared nao deve depender de Fastify, do driver SQLite ou de dados privados.
Exporta fontes TypeScript, consumidas pelo tsx/Vite e incluidas pelo esbuild
no bundle ESM de producao da API.

Services ja existem para accounts, categories, people, payees, tags, settings,
transactions e verificacoes comuns. Eles usam uma conexao `db` compartilhada.
Households e dashboard tambem possuem services. A camada de autenticacao
confere o acesso HTTP aos recursos por casa, identidade e papel.
Desde 2026-10-26 ha suite com Node Test Runner, tsx e Fastify inject, usando
bancos SQLite temporarios com migrations reais. Services ainda usam db
compartilhado; testes definem a URL antes de importar a aplicacao. Nao foi criada uma
camada de repositories, injecao de dependencias ou microservicos.

## Identidade e acesso

`users` representa login; `household_members` representa associacao e papel;
`household_people` representa quem recebe a atribuicao financeira.

Foram discutidos convites com token secreto e hash para evitar listar/adicionar
qualquer usuario do banco. Convites continuam adiados; sessoes foram implementadas para os logins individuais.
O modelo de papeis esperado e owner/admin para administracao e member para
operacoes financeiras, com enforcement HTTP por membership/casa/papel. Viewer foi considerado e
retirado do enum final.

A entrega de 2026-10-26 adotou scrypt assincrono do Node, sessoes persistidas
com SHA-256 do token e cookie HttpOnly/SameSite=Strict. Escritas exigem CSRF;
login e troca de senha tem limite de tentativas. Membership e papel sao
revalidados em cada requisicao; criacao de transacao registra a autoria do login.
JWT e Argon2 nao foram adotados. Provisionamento inicial e recuperacao sao
locais; novos membros podem ser criados por administradores da propria casa.
Consulte [mecanismo e limites](acesso-e-interface.md).

## Hospedagem e operacao futura

Dockerfile/Compose, volumes persistentes, Caddy com HTTPS e rotina de backup
online/restauracao estao implementados. O bundle ESM roda sem tsx em producao.
Veja [operacao e limites de validacao](producao.md). VPN/DNS e instalacao da CA
sao configuracoes do operador; CI ainda nao foi implementada.

O objetivo e uma aplicacao simples em um home server. Jobs e workers separados
so devem aparecer quando recorrencias ou tarefas de fundo exigirem.

## Evolucao: recorrencias

Calendario ancorado em startsAt, datas de negocio e geracao explicita de pendentes.
Splits/tags do template sao relacionais; occurrenceDate preserva a chave de
idempotencia independente da data editavel. A geracao reutiliza o service
financeiro sob transacao imediata. Nao ha worker/scheduler novo. Veja
[regras e contratos](recorrencias.md). A prioridade atual e evoluir o app;
validacao do deploy foi postergada pelo usuario.

## Evolucao: orcamentos

Plano e itens usam tabelas existentes; migration 0003 adiciona currency e
isArchived. Limites por categoria exata e consumo derivado dos splits de expense.
Periodos ficam salvos, independentemente de settings futuros. Overlap e escrita
de itens sao validados em transacao imediata; leituras de consumo usam snapshot
SQLite. Nao ha scheduler, geracao de transacoes ou mudanca de saldos.
Veja [regras e API](orcamentos.md).
