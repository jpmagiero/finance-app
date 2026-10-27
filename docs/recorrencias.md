# Recorrências

Implementadas como evolução do app após a primeira entrega de lançamentos/dashboard.
Deploy permanece fora da prioridade desta etapa; [orçamentos](orcamentos.md) também foram implementados.

## Uso na interface

Depois de atualizar as dependências, execute na raiz:

```bash
npm run db:migrate
npm run dev
```

Não repetir seed em um banco existente. A migration 0002 adiciona estruturas;
não gera lançamentos e não altera saldos. A validação usa bancos temporários,
sem aplicar migrations no SQLite pessoal.

Abra Recorrências > Nova recorrência. Informe receita/despesa, valor, data de
início e frequência. Pessoa, conta e favorecido são opcionais; divisões por
categoria, tags e observações são suportadas.

A data inicial ancora o calendário:
- Diária: repete a cada N dias.
- Semanal: a cada N semanas no dia da semana da data inicial.
- Mensal: a cada N meses no dia da data inicial.
- Anual: a cada N anos no mês/dia da data inicial.

N varia de 1 a 120. O fim é opcional e inclusivo. No dia 31, meses menores usam
o último dia, sem mudar a âncora: 31/jan, 28/fev, 31/mar. Uma regra de 29/fev
anual usa 28/fev nos anos comuns e volta a 29/fev nos bissextos. Datas são de
negócio, sem conversão de fuso; o fuso da casa só preenche a data inicial na UI.

Use Gerar, escolha de/até (até 366 dias inclusivos) e Pré-visualizar datas.
A prévia distingue novos pendentes, ocorrências existentes e excluídas.
Gerar pendentes cria somente as novas. Isso é uma ação explícita: abrir a tela,
iniciar a API ou passar a data não gera lançamentos automaticamente.

## Histórico e saldos

Cada ocorrência cria uma transação pending, com cópia do valor, referências,
splits, tags e observações. O login que executou a geração fica como autor.
Sem conta, o lançamento aparece nos relatórios sem movimentar saldo bancário.

Pending não movimenta saldo. Confirmar, editar ou excluir usa o mesmo service
financeiro dos lançamentos manuais. O dashboard pode incluir pendentes conforme
includePendingInReports, exibindo também confirmados e pendentes separados.

O par recurringTransactionId/occurrenceDate é único no SQLite. occurrenceDate
preserva a data original, mesmo se transactionDate for editada. Exclusão lógica
mantém a chave: gerar novamente não ressuscita um lançamento excluído. Uma
repetição/reinicialização não cria a mesma ocorrência duas vezes.

Alterar a regra afeta somente ocorrências ainda não geradas; não atualiza valores
ou datas do histórico. Alterar o calendário muda as datas candidatas nas próximas
gerações: confira a prévia, especialmente se escolher um intervalo passado.
Pausar bloqueia novas gerações e preserva todos os lançamentos existentes;
retomar permite escolher novamente qualquer intervalo válido da vigência.
Não há exclusão física da regra nem cancelamento em massa de pendentes.

Geração de um intervalo é atômica: transações, splits, tags e vínculos são
gravados juntos. Se qualquer ocorrência falhar, nenhuma nova ocorrência daquele
pedido fica gravada. Uma transação SQLite imediata serializa escritores; o índice
único mantém a defesa de idempotência no banco.

## Referências e acesso

Owner, admin e member podem operar recorrências da própria casa. Sessão, CSRF,
membership, papel e isolamento por ID seguem a política dos lançamentos.
Uma pessoa pode gerar lançamentos atribuídos a outra pessoa da casa.

Criação/edição e cada nova ocorrência validam referências na mesma casa. Contas/
categorias arquivadas ou pessoas inativas bloqueiam novos lançamentos: restaure
o cadastro ou ajuste a regra. Pausar não exige revalidar essas referências.
Favorecidos/tags usados por uma regra, inclusive pausada, não podem ser apagados.
O tipo de categoria e a moeda de conta em uso por regra também não podem mudar.

## API

| Método | Caminho | Efeito |
| --- | --- | --- |
| GET | /recurring/ | Lista regras da casa da sessão, incluindo pausadas |
| GET | /recurring/:id | Detalha regra e template |
| POST | /recurring/ | Cria; retorna 201 |
| PUT | /recurring/:id | Substitui template/calendário; casa imutável |
| PATCH | /recurring/:id/active | Pausa/retoma com isActive booleano |
| POST | /recurring/:id/preview | Prévia de datas e vínculos; body from/to |
| POST | /recurring/:id/generate | Gera pendentes; body from/to |

Payload de criação/substituição:

```json
{
  "householdId": "ID_DA_CASA",
  "type": "expense",
  "amountCents": 15000,
  "description": "Internet",
  "frequency": "monthly",
  "interval": 1,
  "startsAt": "2026-10-31",
  "endsAt": null,
  "isActive": true,
  "splits": [{ "categoryId": null, "amountCents": 15000 }],
  "tagIds": []
}
```

Opcionais: personId, accountId, payeeId, notes e descrição por split.
interval default 1, isActive default true, tagIds default []. Não enviar
status/transactionDate/competenceDate/transferAccountId; status gerado é pending,
a data vem do calendário e competência fica vazia. Transferências/ajustes
recorrentes, scheduler e confirmação automática não estão nesta etapa.

Prévia responde [{date,transactionId,deleted}]. Geração responde
{created,skipped,transactionIds}; skipped inclui ocorrências excluídas.
Regras antigas sem recurring_splits usam categoryId/amountCents como split único
até serem editadas. nextRunAt, autoCreate, dayOfMonth/dayOfWeek são campos legados
do schema, sem agendador; novas regras usam startsAt como âncora e autoCreate=false.

## Verificação

Testes Node cobrem calendários, limites, referência/autorização/CSRF, geração
idempotente após editar/excluir, nova instância da API, rollback SQL de geração e
edição do template, saldos e proteção dos cadastros. Playwright cobre criação,
prévia, geração repetida, mudança de valor preservando histórico, confirmação/
exclusão, pausa/retomada e layout mobile. Dados exclusivamente sintéticos.
