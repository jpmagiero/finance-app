# Análise técnica e plano de evolução

Documento historico: diagnostico inicial e registro das entregas posteriores.
Para decidir o proximo trabalho, use [estado atual](estado-e-proximos-passos.md).
Para trocar de maquina, use [retomada](retomada.md). Nao tratar a tabela de
marcos/achados inicial como lista de bugs ou funcionalidades ainda pendentes.

Revisão em **2026-10-26**, sobre o commit `9d85900`, com árvore de trabalho inicialmente limpa. Complementa o [backlog](estado-e-proximos-passos.md). As propostas abaixo não representam funcionalidades entregues. O escopo da primeira entrega e o modo de acesso foram confirmados pelo usuário nesta revisão.

## Execução das etapas de ambiente e núcleo financeiro

Atualização em 2026-10-26: Node 22.23.4 e pnpm 9.15.4 preparados no WSL;
dependências instaladas com frozen-lockfile. Adicionados .nvmrc e pnpm test.
A suíte usa Node Test Runner, tsx, Fastify inject e SQLite temporário com
migrations reais; 60 testes passaram, incluindo rollback tardio e repetição
de migrations/seed.

Corrigidos saldo atual avulso, saldo inicial inconsistente, mudança de casa
no PUT, escrita de adjustment, transferência entre moedas distintas,
alteração de moeda em conta com histórico, datas inválidas e overflow.
Saldo na edição usa diferença líquida exata por conta. Nenhuma migration
nova ou alteração de dados pessoais foi necessária.

Os marcos 0 e 1 abaixo foram executados. Os achados e a tabela de evidências
da revisão inicial foram preservados como histórico; o estado vigente está
em regras-de-negocio.md, api.md e estado-e-proximos-passos.md.
Moeda única por casa segue proposta; este bloco protege transferências e
histórico, sem converter ou consolidar moedas distintas.

## Execução do bloco de acesso e frontend

Também em 2026-10-26 foram implementados logins individuais, sessões persistentes,
autorização por casa/papel, CSRF e interface financeira funcional. Os pré-requisitos
de consulta incluíram dashboard por período/pessoa, filtros/paginação e correções
de cadastros. Veja [acesso e interface](acesso-e-interface.md).

Isso cobre os fluxos iniciais do marco de frontend e a parte de acesso do marco 4.
O marco de operação não está integralmente concluído: build/start de produção,
CI, backups automatizados e deploy HTTPS continuam pendentes. Os achados originais
a seguir são históricos e não substituem o estado atualizado.

## Entendimento do produto

O Finance App é um controle financeiro doméstico, inicialmente para duas pessoas e hospedado em home server. Deve oferecer visão individual e consolidada de receitas, despesas, contas e planejamento.

A separação central é entre quem acessa (`users`), quem participa da casa (`household_members`) e a quem pertence o lançamento (`household_people`). Uma pessoa financeira pode não ter login; quem opera pode lançar para outra pessoa. Essa separação deve continuar na autenticação e na interface.

O conceito implementado é receita; o resultado mensal é receita menos despesa. Não existe apuração de lucro empresarial, rentabilidade ou patrimônio líquido. Transferências não representam receita/despesa. Lançamentos sem conta continuam válidos para relatórios: resultado mensal e variação bancária podem diferir.

O escopo original inclui tags, settings, splits por categoria, recorrências e orçamentos. Em 2026-10-26, o usuário confirmou uma primeira entrega com lançamentos e dashboard, deixando recorrências e orçamentos para depois. O acesso inicial será pela rede de casa ou VPN, com logins individuais. Importações, anexos, convites, rateio entre pessoas, faturas completas e parcelamento avançado continuam adiados. A prioridade permanece concluir os endpoints do backend da primeira entrega antes dos fluxos do frontend. As tabelas de planejamento podem permanecer sem bloquear essa entrega.

## Evidências e limites

Foram lidos documentos, AGENTS.md, fontes da API, services, rotas, contratos shared, frontend, configurações, schema, migration e seed. Importers do lockfile foram conferidos para distinguir versões resolvidas dos ranges. Metadados de migration foram inspecionados como estrutura. Não foram abertos arquivos .env privados nem dados do SQLite pessoal.

Esta é uma revisão estática: não comprova execução, desempenho, segurança completa ou ausência de outras falhas. Não houve auditoria de vulnerabilidades das dependências nem atualização de versões.

| Verificação | Resultado |
| --- | --- |
| Git no WSL | HEAD 9d85900; sem mudanças antes desta documentação |
| Runtime WSL | Node 18.16.1; Node 22 ausente no nvm; pnpm indisponível no PATH consultado |
| Dependências | node_modules ausente na raiz |
| pnpm check/typecheck/build | Tentados no shell Windows; wrapper CMD perde cwd UNC e procura package.json em C:\Windows; não chegaram às ferramentas do projeto |
| Testes HTTP/funcionais | Não executados; não existe suíte versionada ou script test |
| Banco pessoal | Não utilizado; migrations e seed não executados |

Preparar Node 22 e pnpm 9.15.4 dentro do WSL, instalar pelo lockfile e repetir os checks. O problema acima não demonstra falha de compilação do código.

## Tecnologias e decisões

Versões resolvidas no lockfile, sem instalação presente nesta máquina:

| Camada | Tecnologia / versão | Papel |
| --- | --- | --- |
| Organização | pnpm workspaces; packageManager 9.15.4 | Monorepo api/web/shared |
| Linguagem | TypeScript 5.9.3, strict | Tipagem e contratos comuns |
| HTTP | Fastify 5.8.5 | Plugins por recurso, logging e schemas HTTP |
| Persistência | Drizzle ORM 0.43.1; drizzle-kit 0.31.10 | Consultas tipadas e migrations |
| Banco | SQLite via better-sqlite3 11.10.0 | Banco local; componente nativo depende do runtime |
| Validação | Zod 3.25.76 | Payloads, tipos e ambiente |
| Documentação | @fastify/swagger 9.7.0; swagger-ui 5.2.6 | OpenAPI e exploração manual |
| Interface | React/React DOM 19.2.6; Vite 6.4.2; Lucide 0.511.0 | SPA de dashboard |
| Qualidade | Biome 2.4.15 | Lint e formatação |

Boas decisões de domínio: dinheiro em centavos inteiros; UUIDs na aplicação; banco relacional; pessoa/conta/favorecido opcionais; casa obrigatória; transferência em um registro com duas contas; preservação de histórico; alteração de lançamento, splits, tags e saldo em transação SQL.

Recomendo manter a stack. O projeto ainda não demonstra necessidade de outro framework, microserviços, repositories genéricos ou troca de banco. SQLite é compatível com a API e armazenamento local previstos; reavaliar com requisitos concretos de concorrência ou múltiplas instâncias escritoras. É uma avaliação de adequação, sem benchmark deste app. Referência: [usos apropriados do SQLite](https://www.sqlite.org/whentouse.html).

## Estado real

| Área | Implementado no código | Falta concluir |
| --- | --- | --- |
| Cadastros | CRUD de people, accounts, categories, payees e tags | Hierarquia, inativos, conflitos e vínculo seguro de login |
| Transações | Criar, consultar, substituir, filtrar e soft delete; splits/tags | Bordas de integridade, paginação, busca e testes |
| Saldos | Aplicar/reverter confirmadas e recalcular conta | Origem única, ajuste, limites numéricos e comprovação automatizada |
| Settings | GET e upsert por casa | Aplicação consistente nos relatórios |
| Dashboard | Totais mensais e categorias | Período financeiro, pessoa e agregações filtradas |
| Identidade | Tabelas de usuários, membros e papéis | Autenticação, autorização e autoria real |
| Recorrências | Tabela e campos de vínculo | Contratos, templates, ocorrências e geração idempotente |
| Orçamentos | Tabelas budgets/budget_items | CRUD e planejado x realizado |
| Frontend | Layout responsivo e consulta ao health | Fluxos financeiros e dados reais |
| Operação | Migrations, seed e scripts dev | Build/start da API, CI, backups e deploy |

O frontend contém resumos fixos, barras ilustrativas, mês fixo e navegação para a mesma página. Apenas health consulta a API. A mensagem sobre a futura API de transações está desatualizada em relação ao backend.

## Achados priorizados (diagnostico historico anterior a implementacao)

### Alta: núcleo financeiro e acesso antes do uso real

1. **Saldo tem duas origens concorrentes.** accounts-service aceita saldo atual avulso e altera saldo inicial sem compensar o atual. Recalcular pode mudar o valor exibido sem novo lançamento. Proposta: saldo inicial + movimentos como origem; saldo atual persistido somente como cache consistente.
2. **Adjustment é aceito sem efeito financeiro.** Contrato aceita o tipo, mas applyTransactionBalance e recálculo não o aplicam. Proposta: restringir criação até definir direção, motivo e impacto nos relatórios.
3. **Transferência não valida moeda.** Usa o mesmo número em contas de moedas diferentes, sem câmbio. Proposta: uma moeda por casa no MVP e bloqueio de alterações incompatíveis com contas/histórico.
4. **PUT permite trocar a casa da transação.** updateTransaction substitui householdId. Proposta: casa imutável, referências contra a casa original e autorização por identidade quando implementada.
5. **Acesso não está implementado.** Operações por ID não verificam solicitante; households/current escolhe a primeira casa. CORS origin:true e HOST 0.0.0.0 não protegem dados. O usuário confirmou logins individuais em LAN/VPN: autenticação e autorização agora são requisitos da primeira versão utilizável. O mecanismo ainda precisa ser escolhido; convites continuam adiados.
6. **Não há proteção automatizada contra regressão.** Atomicidade está estruturada no código, mas falta comprovar rollback e caminhos de edição/status. Recorrências devem reutilizar o mesmo núcleo financeiro.

### Média: contratos, histórico e consultas

- Datas/meses usam regex, sem calendário válido ou intervalo from <= to.
- Valores/somas não garantem explicitamente inteiros seguros JavaScript; verificar também saldo acumulado e agregações, além do payload individual.
- Categorias admitem ciclos indiretos e tipos inconsistentes; mudar tipo pode invalidar classificação histórica.
- Novos lançamentos aceitam cadastros arquivados/inativos. Edição de histórico deve preservar referências antigas sem liberar novas associações indevidas.
- userId:null não desvincula pessoa porque update usa ??; membership e política de vínculo precisam ser definidos.
- Zod e JSON Schema são mantidos à mão; respostas genéricas deixam DTOs pouco definidos. Unicidade pode retornar 500; Ajv/Zod divergem no formato de erro.
- PUT é parcial nos cadastros e substituição em transações. Nesta última, omitir status resulta em confirmed e omitir tags remove os vínculos.
- Filtro accountId só contempla origem; extrato precisa incluir transferências recebidas. Limit 50/200 não oferece navegação completa.
- Dashboard lê todos os splits, filtra em memória e mistura tipos no agregado de categorias; não oferece grupo explícito sem categoria.
- Dashboard ignora início configurado do período e filtro de pessoa; casa inexistente pode resultar em resumo vazio em vez de 404.
- Timestamps SQL e atualizações têm formatos distintos. Definir padrão e acrescentar desempate por ID antes da paginação estável.

Achados por leitura, sem reprodução via HTTP. A documentação de 2026-10-20 já reconhece a maior parte deles; este plano transforma o diagnóstico em entregas verificáveis e explicita dependências.

## Plano por marcos

Sem estimativa em dias até confirmar disponibilidade e escopo. Cada marco termina com documentação atualizada, checks e evidência de comportamento.

| Marco | Entrega | Critério de conclusão |
| --- | --- | --- |
| 0 — Ambiente | Node 22/pnpm 9.15.4 no WSL, dependências e banco sintético isolado | Check/typecheck/build e boot/OpenAPI verificados sem banco pessoal |
| 1 — Núcleo confiável | Testes, regra de saldo, ajustes/moedas/casa, datas e limites | Matriz financeira abaixo passando; recálculo coincide com saldo |
| 2 — Contratos/cadastros | Hierarquia, arquivamento, null/undefined, DTOs/erros; services de dashboard/households | Validação/OpenAPI alinhados; conflitos previsíveis; histórico preservado |
| 3 — Consultas | Paginação, filtros, extrato e dashboard individual/consolidado | Totais de fixtures conhecidos fecham; período/status documentados |
| 4 — Logins e operação | Autenticação individual, autorização por casa, build/start, CI, backup/restauração | Login/logout funcionam; operações sem identidade e acessos de outra casa bloqueados; instalação/restauração com saldos conferidos |
| 5 — Frontend e primeira entrega | Fluxos conectados à API concluída, incluindo acesso individual | Duas pessoas acessam pela LAN/VPN, cadastram, lançam para si/outro, editam, confirmam/excluem, filtram e conferem dashboard |
| 6 — Recorrências, depois da primeira entrega | CRUD e geração explícita por intervalo; migrations do template | Reexecutar não duplica ocorrências, inclusive após reinício; datas e edição definidas |
| 7 — Orçamentos, depois da primeira entrega | CRUD de orçamento/itens e planejado x realizado | Gastos por split, período/pessoa corretos e sem dupla contagem |

A primeira versão utilizável termina no marco 5; recorrências e orçamentos não bloqueiam a entrega. Definir o mecanismo de autenticação no início do marco 2, para estabilizar os contratos de acesso antes do frontend; implementá-lo até o marco 4. Logins devem ser provisionados sem depender de convites, que seguem adiados. VPN limita o alcance de rede, mas não substitui autorização na API. CI básica pode entrar no marco 1 quando os comandos forem reproduzíveis. Containers são uma escolha de operação.

### Primeira entrega recomendada

1. Harness com SQLite temporário, migrations reais, encerramento de conexão e buildApp testável. Permitir conexão/configuração por instância onde necessário, sem uma arquitetura de injeção de dependências completa.
2. Testes do comportamento financeiro válido e regressões dos defeitos conhecidos; corrigir cada defeito junto de seu teste.
3. Consolidar saldo inicial/atual e restringir adjustment sem regra definida.
4. Impedir troca de casa e moedas incompatíveis; validar calendário e dinheiro.
5. Sincronizar docs/contratos afetados, executar checks e revisar diff.

Matriz mínima: receitas/despesas com e sem conta; transferências com duas contas; pending/confirmed/canceled e suas transições; edição de valor/tipo/contas; soft delete, segundo delete e recálculo; substituição de splits/tags; referências de outra casa; falha induzida após escrita parcial e rollback de lançamento, splits, tags e ambas as contas.

Rejeitar payload antes de escrever não comprova rollback. Usar Fastify inject para HTTP sem abrir porta. Runner pode ser Node Test Runner ou Vitest; Vitest permanece proposta. Referência: [guia de testes do Fastify](https://github.com/fastify/fastify/blob/main/docs/Guides/Testing.md).

### Detalhes dos marcos seguintes

- **Contratos:** avaliar fonte única de schemas ou testes de paridade. Escolher adaptador após conferir compatibilidade com versões atuais. Padronizar 400/404/409 e, com acesso, 401/403.
- **Relatórios:** separar realizado, pendente, previsão e saldo das contas. Proposta: transactionDate no MVP, respeitando monthlyPeriodStartDay e retornando limites do período. Competência requer decisão própria.
- **Recorrências:** completar templates ou restringir inicialmente a receita/despesa. Criar chave única persistida de ocorrência; definir dias 29/30/31, anos bissextos, intervalo, pausa, janela, reinício e exclusão/edição de ocorrência. Proposta: gerar pending por padrão e começar por ação explícita, antes do job.
- **Orçamentos:** computar splits de despesas; definir sem categoria, categorias filhas, sobreposição e status. Retornar realizado e comprometido separadamente evita confundir pending com confirmado.
- **Acesso:** selecionar casa no contexto permitido, preencher autoria no servidor e proteger todas as operações. Vínculo financeiro não concede acesso ao login.
- **Operação:** produzir API executável e resolver shared que exporta TS; verificar start fora de watch. Automatizar backup consistente e restaurar em cópia separada; parar escritas ou usar mecanismo próprio de banco ativo. Referência: [SQLite Online Backup API](https://www.sqlite.org/backup.html).
- **Frontend:** cadastros essenciais/lançamento, lista/edição/filtros, dashboard, planejamento. Incluir loading/erro/vazio e verificar teclado e uso móvel.

## Decisões confirmadas e propostas restantes

Confirmado pelo usuário em 2026-10-26: primeira entrega com lançamentos e dashboard; recorrências e orçamentos depois; acesso em rede de casa ou VPN com logins individuais. As demais linhas continuam como propostas técnicas.

| Decisão | Proposta inicial | Consequência |
| --- | --- | --- |
| Recorrências/orçamentos | Confirmado: depois da primeira entrega | Não bloqueiam API e frontend iniciais |
| Acesso inicial | Confirmado: LAN/VPN com logins individuais | Autenticação/autorização obrigatórias na primeira entrega; mecanismo a escolher |
| Moedas | Uma moeda por casa | Evita câmbio e agregação incompatível |
| Adjustment | Restringir até definir regra | Evita conciliação sem efeito no saldo |
| Período/competência | Data da transação + início configurado; competência depois | Relatórios/orçamento coerentes |
| Cartão | Cadastro não equivale a fatura | Se fatura/parcelas forem essenciais, rever escopo antes do frontend |

## Critério de entrega

API da primeira entrega: cadastros, transações, settings, consultas e dashboard implementados/documentados; integridade financeira e isolamento por identidade/casa exercitados; relatórios coerentes; login/logout e provisionamento dos logins definidos. App utilizável exige ainda interface operacional e acesso/backup resolvidos para LAN/VPN. Recorrências e orçamentos compõem uma evolução posterior.

Previsões podem vir depois, começando por compromissos, recorrências e médias. Não há necessidade demonstrada de IA em runtime neste momento.

## Atualizacao apos implementacao

Os achados acima registram o diagnostico inicial. Nucleo financeiro, consultas,
acesso e interface foram implementados e exercitados. A revisao final adicionou
regressoes de login concorrente, validacao amigavel no provisionamento, E2E
Playwright e bundle/start da API, Compose/Caddy HTTPS e backup/restauracao.
94 testes Node e 2 cenarios E2E passaram com SQLite sintetico.
CI, contratos genericos restantes e validacao das imagens/containers no home
server continuam pendentes; o daemon Docker nao estava disponivel. Consulte
[estado atual](estado-e-proximos-passos.md) e [producao](producao.md).

## Evolucao posterior autorizada: orcamentos

Orcamentos agora possuem API/interface com limites por categoria, casa/pessoa,
periodos salvos, moedas separadas, consumo confirmado/pendente, arquivamento e
protecao contra sobreposicao. Veja [guia](orcamentos.md) e [estado atual](estado-e-proximos-passos.md).
A prioridade do usuario e evoluir o app antes de validar o deploy.
