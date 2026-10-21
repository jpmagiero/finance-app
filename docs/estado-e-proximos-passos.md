# Estado e proximos passos

Levantamento em **2026-10-20**, baseado no commit `5bbbb44`.
Este arquivo e o ponto de retomada: atualizar ao concluir cada bloco de trabalho.

## O que ja foi entregue

| Area | Estado |
| --- | --- |
| Monorepo | pnpm workspaces, api/web/shared, lockfile e TypeScript strict |
| Qualidade | Biome na raiz e scripts check/typecheck/build |
| Persistencia | SQLite, Drizzle, migration inicial e seed |
| Schema | 15 tabelas incluindo tags, settings, recorrencias e orcamentos |
| Cadastros | Listar, buscar, criar, editar e arquivar people/categories/accounts |
| Payees e tags | CRUD com bloqueio de exclusao se usado |
| Settings | GET e PUT com upsert |
| Transacoes | Listar, buscar com splits/tagIds, criar, substituir e soft delete |
| Saldos | Aplicacao/reversao atomica dos movimentos e endpoint de recalculo |
| Services | accounts, categories, people, payees, tags, settings, transactions e common |
| Relatorio | Dashboard mensal basico e primeira casa com dados associados |
| Swagger | UI, OpenAPI e schemas basicos dos endpoints |
| Frontend | Estrutura React/Vite e prototipo com health check; sem fluxos financeiros funcionais |

O historico Git registra `21e4a33` (base), `17bda0a` (Swagger) e
`5bbbb44` (services/CRUD). Nao existem testes automatizados versionados.
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
| Acesso | Sem autenticacao, autorizacao ou roles aplicadas; consultas por ID nao validam solicitante | Definir identidade/acesso antes de uso com dados sensiveis; testar isolamento entre casas |
| Casa atual | `/households/current` retorna primeira casa com limit(1) | Vincular selecao ao contexto de acesso quando implementado |
| Vinculo pessoa/login | Verifica apenas existencia do userId; nao membership, unicidade ou consentimento | Definir vinculacao segura; impedir associacao arbitraria a usuarios de outras casas |
| Desvinculo pessoa | Update usa `input.userId ?? person.userId`, entao null nao remove vinculo | Distinguir undefined de null e cobrir em teste |
| Services | Dashboard e households ainda acessam db nas rotas | Extrair services, concluindo a padronizacao iniciada |
| Transacao editada | PUT permite mudar householdId | Tornar a casa imutavel e validar contexto do recurso |
| Saldos | Conta aceita saldo atual avulso; mudar saldo inicial nao ajusta o atual automaticamente | Definir origem unica do saldo e atualizacao/reconciliacao consistente |
| Ajustes | Tipo adjustment aceito, sem impacto de saldo ou direcao definidos | Especificar a regra ou restringir ate implementar |
| Moedas | Transferencia entre moedas diferentes usa o mesmo numero, sem cambio | Restringir a mesma moeda no MVP ou definir cambio explicitamente |
| Categorias | Apenas autorreferencia direta bloqueada; ciclos indiretos e tipos pai/filhos incompletos | Validar hierarquia e impedir mudanca de tipo que invalide historico |
| Cadastros inativos | Novas transacoes aceitam referencias arquivadas; sem restore | Definir politica e adicionar endpoints se necessario |
| Pessoas inativas | Lista inclui inativas sem filtro | Padronizar filtros de ativos/arquivados |
| Datas | Regex aceita datas/meses impossiveis | Validacao de calendario e de intervalo from <= to |
| Dinheiro | `.int()` sem faixa segura explicitamente definida | Validar valores e somas com Number.isSafeInteger |
| Dashboard | Ignora monthlyPeriodStartDay, competencia e filtro de pessoa | Definir calendario financeiro e filtros consistentes |
| Categorias no dashboard | Soma splits de todos os tipos e carrega todos os splits do banco | Separar receita/despesa e agregar por consulta filtrada |
| Erros | Unicidade/FK podem virar 500; Ajv/Zod usam formatos diferentes | Padronizar erro, conflito 409 e respostas OpenAPI |
| Contratos | Zod e JSON Schema duplicados; varias respostas genericas | Alinhar validacao/documentacao e DTOs sem divergencia |
| Lista de transacoes | Limit sem paginacao e sem filtros categoria/tag/busca | Implementar contrato de paginacao e filtros |
| Testabilidade | Services importam db global; sem suite automatizada | Banco temporario, Fastify inject e isolamento de dependencia quando necessario |
| Producao | Build da API e apenas tsc --noEmit; shared exporta TS | Build/start executavel e validacao de deploy |

Essas pendencias sao diagnostico para continuidade, nao correcoes implementadas
pela tarefa de documentacao. As notas numericas anteriores foram opinioes de
momento; nao substituem testes nem significam que autenticacao esteja pronta.

## Ordem sugerida para continuar

1. **Confiabilidade do nucleo:** testes de services/HTTP em SQLite temporario,
   cobrindo saldos em criacao, edicao, pending/confirmed/canceled, transferencia,
   soft delete, rollback e rejeicao de referencias de outra casa.
2. **Fechar contratos e acesso:** resolver as lacunas acima, priorizar identidade
   e autorizacao conforme uso real, padronizar erros/DTOs/Swagger e terminar a
   extracao de dashboard/households para services.
3. **Consultas:** paginacao, busca, categorias/tags, entradas e saidas de uma conta;
   dashboard por pessoa/categoria/fluxo/saldo com regras de periodo definidas.
4. **Recorrencias:** CRUD, gerar ocorrencias idempotentes, datas de vencimento e
   templates compativeis com os tipos permitidos; agendador so quando necessario.
5. **Orcamentos:** CRUD de budgets/items, limites por categoria e pessoa/casa,
   comparacao planejado vs realizado e validacao de periodos.
6. **Operacao:** build/start de producao, CI, container/Compose se adotado,
   backups com teste de restauracao, configuracao de host/CORS/HTTPS.
7. **Frontend:** conectar fluxos e graficos a API validada, mantendo o foco atual
   no backend ate concluir seus endpoints.
8. **Evolucoes:** previsoes por regras/medias; avaliar rateio, convites e faturas
   quando trouxerem valor real. Imports/anexos continuam fora do escopo aceito.

O framework de teste sugerido foi Vitest, mas ainda nao foi instalado ou aprovado
como decisao definitiva. Fastify inject pode testar HTTP sem abrir porta.

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
