# Estado e proximos passos

Levantamento em **2026-10-20**, baseado no commit `5bbbb44`.
Este arquivo e o ponto de retomada; o levantamento original foi atualizado
abaixo com as entregas de 2026-10-26.

## Atualizacao de escopo em 2026-10-26

Decisao confirmada pelo usuario: a primeira entrega utilizavel contempla
lancamentos e dashboard, com cadastros/settings necessarios. Recorrencias e
orcamentos ficam para depois. Acesso inicial pela rede de casa ou VPN, com
logins individuais: autenticacao/autorizacao passam a ser requisitos dessa
entrega, com mecanismo ainda a definir; convites continuam adiados.

A implementacao abaixo continua sendo o levantamento historico, sem novas
features entregues nesta revisao. Para a ordem atualizada, criterios de
conclusao e limites de verificacao, consulte a
[analise e plano de 2026-10-26](analise-e-plano-2026-10-26.md).
Essa decisao substitui a exigencia anterior de recorrencias/orcamentos para
concluir a primeira entrega; os demais itens tecnicos do backlog permanecem.

## Revisao final de 2026-10-26: acesso, testes e operacao

- Verificacao final: 94 testes Node e 2 cenarios Playwright passaram, sem skip;
  check/typecheck/build, instalacao frozen e diff checks passaram.
- Login revalida hash/usuario ativo em transacao imediata antes de criar sessao.
  Regressoes deterministicas cobrem troca de senha, provisionamento e desativacao.
- Provisionamento repete senha invalida/confirmacao diferente com mensagens claras;
  PTY verificou ausencia de eco e preservacao da identidade do seed.
- Playwright versionado: fluxo financeiro, cadastros, dashboard, roles, sessao,
  filtros e mobile; API e Vite isolados com banco sintetico temporario.
- API compilada via esbuild, shared incluido, start por Node e comandos de banco
  compilados. Instalacao isolada somente com dependencias de producao exercitada.
- Dockerfile/Compose, volumes, Caddy HTTPS, readiness e backup online periodico
  com retencao e restore para arquivo novo. Guia em [producao](producao.md).
- HTTPS real verificado com CA local confiavel, SPA, Swagger, cookie Secure e CSRF;
  backup/restauracao compilados tambem exercitados com dados sinteticos.
- Docker daemon indisponivel: Compose config validado, mas imagens/containers
  ainda precisam ser construidos/exercitados no home server.

## Entregue em 2026-10-26: acesso e interface funcional

- Login/logout, sessoes SQLite com hash do token, cookie HttpOnly, CSRF,
  verificacao de origin, limites de tentativas e troca da propria senha.
- Provisionamento lista casas existentes por numero/ID, repete escolhas invalidas
  e preserva os dados; selecao e senha oculta verificadas em PTY temporario.
- Provisionamento inicial/recuperacao local; administradores criam logins
  de membro e podem vincular pessoa financeira existente sem mudar historico.
- Autorizacao em listas, recursos por ID, restore, recalc e settings:
  membership/casa/papel revalidados a cada requisicao; autoria no servidor.
- Migration 0001 adiciona sessions; lockfile versiona cookie/rate-limit.
- Dashboard/households extraidos para services; periodo financeiro, pessoa,
  pendentes separados, despesas por categoria e join de splits filtrado.
- Paginacao, busca, categoria/tag e extrato com transferencias recebidas.
- Categorias com hierarquia consistente; vinculos de login validados,
  null/undefined corrigidos e campos HTTP nullable preservados sem coercao.
- Politica de arquivamento para novos vinculos e restauracao dos cadastros.
- Erros centrais 400/401/403/404/409/429; OpenAPI documenta acesso/CSRF.
- Frontend com login, dashboard real, lancamentos/splits/tags, edicao,
  confirmacao/exclusao, filtros/paginacao, cadastros e preferencias.
- Proxy /api no Vite facilita acesso por LAN/VPN; sem credenciais em localStorage.

Veja [acesso e interface](acesso-e-interface.md) para os comandos obrigatorios
de atualizacao e primeiro login. O banco pessoal nao foi usado para verificacao.
Contratos genericos restantes e implantacao/validacao no home server continuam pendentes.
Verificacao: 86 testes, check/typecheck/build, fluxo completo em navegador
desktop/celular e provisionamento local em PTY passaram com bancos temporarios.
A verificacao original foi assistida; a revisao final adicionou pnpm test:e2e automatizado.

## Entregue em 2026-10-26: ambiente e nucleo financeiro

- WSL com Node 22.23.4, pnpm 9.15.4 e instalacao pelo lockfile existente.
  Incluido .nvmrc para selecionar Node 22.
- Script pnpm test: Node Test Runner + tsx + Fastify inject, sem novo framework.
  Bancos temporarios com migrations reais, encerramento e limpeza.
- 60 testes: criacao, edicao, status, transferencia, soft delete/repeticao,
  splits/tags, referencias de outra casa, limites numericos, datas, contratos,
  recalc, rollback por falha SQL apos escrita parcial e repeticao de migrate/seed.
- Saldo atual somente leitura; editar saldo inicial recalcula o atual atomicamente.
  Edicao de transacao aplica a diferenca liquida exata por conta.
- Casa de transacao imutavel; escrita de adjustment bloqueada.
- Transferencias entre moedas distintas rejeitadas; moeda de conta com historico
  nao pode mudar. Moeda unica por casa continua proposta, nao regra implementada.
- Calendario real e intervalos validados; inteiros seguros em entradas, saldos
  e agregacoes. Somas internas usam BigInt, sem mudar DTOs ou schema SQL.

Suite inicialmente reproduziu 12 falhas em 47 cenarios; apos correcoes e
ampliacao, 60 passaram. Nao houve acesso ao SQLite pessoal nem alteracao de
.env privado. Sem migration nova porque a estrutura do banco nao mudou.
Nesse marco historico, build da API era apenas tipos e acesso/login estava pendente;
ambos foram implementados nos blocos posteriores acima.
Verificacoes executadas: pnpm test (60/60), pnpm check, pnpm typecheck,
pnpm build e git diff --check. Nenhuma dependencia adicionada; lockfile preservado.

## O que ja foi entregue

| Area | Estado |
| --- | --- |
| Monorepo | pnpm workspaces, api/web/shared, lockfile e TypeScript strict |
| Qualidade | Biome na raiz e scripts check/typecheck/build |
| Persistencia | SQLite, Drizzle, migration inicial e seed |
| Schema | 16 tabelas incluindo tags, settings, recorrencias e orcamentos |
| Cadastros | Listar, buscar, criar, editar e arquivar people/categories/accounts |
| Payees e tags | CRUD com bloqueio de exclusao se usado |
| Settings | GET e PUT com upsert |
| Transacoes | Listar, buscar com splits/tagIds, criar, substituir e soft delete |
| Saldos | Aplicacao/reversao atomica dos movimentos e endpoint de recalculo |
| Relatorio | Dashboard por periodo/pessoa e casa autorizada da sessao |
| Swagger | UI, OpenAPI e schemas basicos dos endpoints |
| Frontend | Login, dashboard, lancamentos, cadastros e preferencias funcionais |

O historico Git registra `21e4a33` (base), `17bda0a` (Swagger) e
`5bbbb44` (services/CRUD). Naquele levantamento ainda nao existiam testes automatizados; a suite atual
foi adicionada na entrega de 2026-10-26.
No desenvolvimento anterior foram executados Biome/typecheck/build e smoke
tests HTTP. Isso e evidencia historica, nao garantia de regressao automatizada.

O teste manual anterior deixou recursos sinteticos arquivados/soft deleted e
payee/tag cuja exclusao foi bloqueada por vinculos. Esses dados nao fazem parte
do seed nem do Git. Nao assumir banco pessoal limpo ou apagar registros pelo
nome ao retomar; usar banco de teste isolado.

Uma revisao antiga do chat disse que app.sqlite estava staged, mas a verificacao
posterior com git ls-files confirmou que nao estava rastreado. O estado correto
e: banco local ignorado, migrations versionadas.

## Pendencias verificadas no codigo

| Area | Lacuna | Proximo tratamento recomendado |
| --- | --- | --- |
| Moedas | Transferencia entre moedas diferentes bloqueada; dashboard ainda nao agrega por moeda | Definir moeda unica por casa ou relatorios separados antes de uso multimoeda |
| Dashboard | Usa periodo configurado e pessoa; competencia segue fora dos totais | Manter transactionDate como criterio explicito; competencia futura se necessaria |
| Contratos | Zod e JSON Schema duplicados; varias respostas genericas | Alinhar validacao/documentacao e DTOs sem divergencia |
| Testabilidade | Suite temporaria por processo; services ainda usam db compartilhado | Conexao por instancia se houver necessidade de multiplas apps no mesmo processo |
| Producao | Bundle/start, Compose/HTTPS e backup/restore implementados; Docker nao exercitado | Validar imagens/containers no home server, CA nos clientes e copia externa |

Essas pendencias refletem o backlog apos a revisao final de 2026-10-26.
Autenticacao/autorizacao estao implementadas e exercitadas; notas anteriores sao historicas.

## Ordem sugerida para continuar

1. **Confiabilidade do nucleo (entregue):** manter pnpm test e ampliar a suite
   a cada nova regra; os cenarios financeiros e rollback ja estao automatizados.
2. **Contratos restantes:** substituir respostas genericas por DTOs completos,
   mantendo a suite de acesso e contratos atualizada.
3. **Consultas (entregue no escopo inicial):** paginacao, busca, categorias/tags,
   transferencias recebidas e dashboard por periodo/pessoa/fluxo/categoria.
4. **Recorrencias:** CRUD, gerar ocorrencias idempotentes, datas de vencimento e
   templates compativeis com os tipos permitidos; agendador so quando necessario.
5. **Orcamentos:** CRUD de budgets/items, limites por categoria e pessoa/casa,
   comparacao planejado vs realizado e validacao de periodos.
6. **Operacao (base entregue):** validar imagens/containers no home server,
   configurar DNS/CA nos clientes e copia externa dos backups; adicionar CI.
7. **Frontend inicial (entregue):** evoluir a partir dos fluxos reais descritos
   em acesso-e-interface.md; ampliar verificacao de acessibilidade e navegador.
8. **Evolucoes:** previsoes por regras/medias; avaliar rateio, convites e faturas
   quando trouxerem valor real. Imports/anexos continuam fora do escopo aceito.

A suite adotou Node Test Runner, tsx e Fastify inject, sem adicionar Vitest.
O HTTP dos testes Node usa inject; Playwright e verificacoes de producao abrem
portas locais com dados sinteticos.

## Criterio para considerar a API do MVP pronta

- Contratos e endpoints do escopo definidos, implementados e exercitaveis no Swagger.
- Integridade de transacoes e saldos comprovada em testes automatizados.
- Identidade e acesso resolvidos para o modo de uso escolhido; nenhuma permissao
  presumida apenas por existir householdId ou role no banco.
- Recorrencias/orcamentos funcionais se mantidos no escopo de entrega.
- Dashboard e filtros com resultados coerentes com settings.
- Migrations, seed e setup repetiveis em outra maquina.
- Build/start de producao e backup/restauracao verificaveis para o home server.
- Docs atualizadas com comportamento real e limitacoes restantes.

## Como manter a memoria do projeto

Quando uma decisao mudar, atualizar arquitetura e regras afetadas, anotando motivo.
Quando mudar tabela, atualizar banco e versionar migration. Quando mudar endpoint,
atualizar API/Swagger e testes. Ao finalizar um bloco, mover seu estado neste
arquivo de pendente para entregue com a verificacao realizada.
