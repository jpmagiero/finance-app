# API atual

Contrato-base `5bbbb44` (2026-10-20), atualizado em 2026-10-26 para
confiabilidade financeira: saldo somente leitura, casa imutavel, datas reais,
limites numericos e restricoes de ajuste/moeda.
Base local padrao: `http://localhost:3333`. Nao existe prefixo `/api` ou versao
no caminho. Os plugins de recursos registram a raiz em `/`; Swagger pode mostrar
`/accounts/`, por exemplo. Os exemplos usam a forma com barra final.

## Acesso (2026-10-26)

Rotas financeiras exigem sessao HttpOnly e membership na casa. Escritas exigem
x-csrf-token obtido em login ou GET /auth/me. Autoria de novas transacoes vem
do login; o cliente nao a escolhe. As permissoes, provisionamento e configuracao
LAN/VPN estao em [acesso e interface](acesso-e-interface.md).

| Metodo | Caminho | Contrato |
| --- | --- | --- |
| POST | /auth/login | email/password; retorna user, householdId, role, csrfToken e cookie; 200 |
| GET | /auth/me | Identidade da sessao; 200 ou 401 |
| POST | /auth/logout | Revoga sessao e limpa cookie; 204 |
| POST | /auth/password | currentPassword/newPassword; minimo 12 na nova; revoga todas as sessoes; 204 |
| GET | /auth/users | Logins da propria casa, sem hashes; administradores recebem lista |
| POST | /auth/users | name/email/password e personId opcional; cria membro na casa; 201 |

Login tem limite de 10 tentativas/IP/minuto; troca de senha 5. Nao ha signup
publico, convites, reset por e-mail ou selecao de outra casa na interface.

## Swagger e validacao

- UI interativa: <http://localhost:3333/docs>
- OpenAPI gerado: <http://localhost:3333/docs/json>
- Registro: `apps/api/src/plugins/swagger.ts`, antes das rotas no `app.ts`.
- `buildApp()` e async; `index.ts` aguarda sua criacao e inicia o servidor.
- Tags agrupam Health, Households, People, Categories, Accounts, Payees, Tags,
  Settings, Transactions, Dashboard e Auth.

JSON Schemas nas rotas sao usados pelo Fastify/Ajv e pelo Swagger. Schemas Zod
do shared tambem validam payloads. Nao ha geracao automatica entre os dois;
manter ambos alinhados. As respostas Swagger ainda usam objetos/arrays genericos
em diversos endpoints e nao descrevem todos os campos ou erros.

Na integracao inicial, `example` nos schemas de validacao causou erro de keyword
desconhecida no Ajv estrito e foi removido. Validar o boot do servidor alem do
typecheck ao alterar schemas. O servidor anunciado pelo Swagger esta fixo em
localhost:3333, mesmo se HOST/PORT forem alterados.

## Endpoints existentes

| Metodo | Caminho | Comportamento |
| --- | --- | --- |
| GET | `/` | Nome e status da API |
| GET | `/health/` | Status e uptime do processo |
| GET | `/households/current` | Casa autorizada da sessao, settings, people e members |
| GET | `/people/` | Lista por householdId; includeInactive=true inclui inativos |
| POST | `/people/` | Cria pessoa financeira |
| GET | `/people/:id` | Busca pessoa |
| PUT | `/people/:id` | Atualiza parcialmente pessoa |
| DELETE | `/people/:id` | Arquiva pessoa; 204 |
| GET | `/categories/` | Lista por householdId; filtros type e includeArchived |
| POST | `/categories/` | Cria categoria |
| GET | `/categories/:id` | Busca categoria |
| PUT | `/categories/:id` | Atualiza parcialmente categoria |
| DELETE | `/categories/:id` | Arquiva categoria; 204 |
| GET | `/accounts/` | Lista por householdId; filtro includeArchived |
| POST | `/accounts/` | Cria conta |
| GET | `/accounts/:id` | Busca conta |
| PUT | `/accounts/:id` | Atualiza parcialmente conta |
| DELETE | `/accounts/:id` | Arquiva conta; 204 |
| POST | `/accounts/:id/recalculate-balance` | Reconstroi saldo com transacoes confirmadas |
| GET | `/payees/` | Lista por householdId |
| POST | `/payees/` | Cria favorecido/pagador |
| GET | `/payees/:id` | Busca favorecido/pagador |
| PUT | `/payees/:id` | Atualiza parcialmente favorecido/pagador |
| DELETE | `/payees/:id` | Exclui se nao utilizado; 204 |
| GET | `/tags/` | Lista por householdId |
| POST | `/tags/` | Cria tag |
| GET | `/tags/:id` | Busca tag |
| PUT | `/tags/:id` | Atualiza parcialmente tag |
| DELETE | `/tags/:id` | Exclui se nao utilizada; 204 |
| GET | `/settings/:householdId` | Busca settings; 404 se inexistentes |
| PUT | `/settings/:householdId` | Atualiza parcialmente ou cria settings da casa existente |
| GET | `/transactions/` | Lista com filtros; sem splits/tags expandidos |
| POST | `/transactions/` | Cria transacao com splits e tags; 201 |
| GET | `/transactions/:id` | Busca transacao com splits e tagIds |
| PUT | `/transactions/:id` | Substitui dados editaveis, splits e tags; ajusta saldo |
| DELETE | `/transactions/:id` | Soft delete e reversao de saldo; 204 |
| GET | `/dashboard/monthly` | Resumo por householdId e month |

POSTs de cadastro retornam 201; demais leituras/atualizacoes retornam 200.
Ha endpoints de logins listados acima e POST /people/:id/restore,
/accounts/:id/restore e /categories/:id/restore (204). Nao ha CRUD completo
de users/membership, criar/editar casa, recorrencias ou budgets.

A casa atual vem da sessao e membership, nunca de limit(1) global. Listas,
operacoes por ID, settings, restore e recalculo verificam a casa autorizada.
Recursos de outra casa retornam 404. Member opera lancamentos; owner/admin
tambem administram cadastros, preferencias e novos logins.

## Parametros de consulta

Listas de cadastros exigem `householdId`. Accounts/categories aceitam
`includeArchived=true` ou `false` como texto; ausente significa false.
Categories aceita `type=income|expense|transfer`.

| GET /transactions | Regras atuais |
| --- | --- |
| householdId | Obrigatorio |
| personId | Filtro individual opcional |
| accountId | Filtra origem ou destino, incluindo transferencias recebidas |
| type | income, expense, transfer, adjustment |
| status | pending, confirmed, canceled |
| from / to | Datas YYYY-MM-DD, limites inclusivos |
| limit | Inteiro de 1 a 200, default 50 |
| page | Opcional; ativa envelope items/total/page/pageSize |
| search | Substring de descricao/notes, ate 180 caracteres |
| categoryId / tagId | Filtram por vinculos de splits/tags |

A lista ordena por transactionDate, createdAt e id descendentes. Sem page,
retorna array; com page, retorna {items,total,page,pageSize}. personId=unassigned
filtra registros sem pessoa. Filtros de data sao inclusivos; nao ha cursor.

`GET /dashboard/monthly` exige `householdId` e `month=YYYY-MM`.
Retorna `month`, `incomeCents`, `expenseCents`, `balanceCents`,
`transactionCount` e `categories`. A configuracao includePendingInReports
influencia status e monthlyPeriodStartDay define os limites do periodo.
Aceita personId (incluindo unassigned) e retorna from/to, flow e totais
confirmados/pendentes separados. Categorias incluem apenas despesas, com
category=null para sem categoria. hasMixedCurrencies sinaliza falta de cambio.

## Campos de criacao e edicao

Campos opcionais de IDs podem ser nulos; ID informado precisa existir.
Nao enviar campos calculados ou de auditoria como se fossem controlados pelo
cliente. Enviar `currentBalanceCents` em POST/PUT de conta retorna 400.

| Recurso | Obrigatorios no POST | Outros campos aceitos |
| --- | --- | --- |
| people | householdId, name | userId, color, avatarUrl |
| categories | householdId, name, type | parentId, color, icon |
| accounts | householdId, name, type | personId, institution, currency, initialBalanceCents, creditLimitCents, statementClosingDay, statementDueDay, isShared |
| payees | householdId, name | Nenhum |
| tags | householdId, name | color |
| transactions | householdId, type, amountCents, transactionDate, splits | personId, accountId, payeeId, status, description, notes, competenceDate, transferAccountId, tagIds |

Limites atuais: nome de pessoa/categoria/conta 120 caracteres; payee 160; tag 80;
descricao de transacao/split 180; notes 2000; color 32; icon 80.
Moeda exige tres caracteres; limite de credito nao negativo; dias de cartao 1 a 31.
Dinheiro exige inteiros seguros JavaScript (+/- 9007199254740991 centavos), com
transacoes/splits positivos. Datas e meses precisam existir no calendario, com
anos 0001 a 9999, e filtros exigem from <= to. Overflow de saldo/agregacao
retorna 400. Transferencias exigem contas de mesma moeda.

Editar saldo inicial recalcula saldo atual atomicamente; saldo atual e somente
leitura. Moeda de conta com historico (inclusive excluido) nao pode mudar.
As demais regras de moedas e conversao continuam pendentes.

PUT de cadastros permite omitir campos e preserva os existentes. Household nao
e editavel nesses recursos. PUT de transacao reutiliza o schema de criacao:
exige os campos obrigatorios e substitui splits/tags. Omitir status retorna ao
default confirmed e omitir tagIds remove as tags, pois o default e array vazio.
PUT de transacao exige a mesma householdId do registro existente; mudanca
retorna 400 sem gravacoes. POST/PUT aceitam apenas income, expense e transfer;
adjustment continua consultavel como historico, mas sua escrita retorna 400.

## Exemplo sem pessoa, conta ou favorecido conhecidos

Use um banco de desenvolvimento com dados sinteticos. Obtenha householdId
em `/households/current`; os IDs abaixo sao placeholders para substituir.

```json
{
  "householdId": "ID_DA_CASA",
  "type": "expense",
  "amountCents": 12050,
  "transactionDate": "2026-10-20",
  "description": "Compra no mercado",
  "splits": [
    { "amountCents": 12050 }
  ],
  "tagIds": []
}
```

Para atribuir a outra pessoa, adicionar `personId` da mesma casa. Para
categorizar, informar categoryId em cada split. Para transferencia, usar
`type=transfer`, origem e destino distintos; splits continuam obrigatorios,
podendo ter categoria nula.

## Exemplo de settings

```http
PUT /settings/ID_DA_CASA
Content-Type: application/json
```

```json
{
  "currency": "BRL",
  "timezone": "America/Sao_Paulo",
  "locale": "pt-BR",
  "monthlyPeriodStartDay": 1,
  "includePendingInReports": true
}
```

## Erros atuais

lib/http.ts e o error handler central traduzem validacao Zod/Ajv para 400,
ausencia/expiracao de sessao para 401, permissao/CSRF/origin para 403,
recurso inexistente ou de outra casa para 404, duplicidade para 409 e limite
de tentativas para 429. Falhas inesperadas retornam 500 generico, sem SQL.

Formato error/message e issues quando aplicavel. OpenAPI inclui esses erros
e esquemas de cookie/CSRF. Algumas respostas antigas ainda sao genericas.
Health verifica o processo, nao readiness de migrations ou persistencia.

## Saude para operacao

GET /health/ e liveness publico. GET /health/ready e readiness publico: 200
quando a tabela de sessoes pode ser consultada, 503 caso contrario. Nao substitui
validacao de integridade do banco. OPENAPI_SERVER_URL define o prefixo anunciado
(default /; /api no Compose). Veja [producao](producao.md).
