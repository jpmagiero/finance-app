# Orçamentos

Implementados na API e na interface após autorização do usuário. A prioridade
continua sendo o desenvolvimento do app; esta etapa não altera o deploy.

## Usar na interface

Na raiz do projeto, depois de atualizar o código:

```bash
npm run db:migrate
npm run dev
```

Não rodar seed novamente em banco existente. A migration 0003 adiciona moeda e
arquivamento aos orçamentos; não cria transações nem recalcula saldos. Foi
validada somente com SQLite temporário, sem usar o banco pessoal.

Abra Orçamentos > Novo orçamento. Informe nome, visão da casa/pessoa, moeda,
período e pelo menos um limite por categoria de despesa.

- Mensal: escolha o mês. O início acompanha monthlyPeriodStartDay da casa;
  dia 15/mês 2026-10 cobre 15/10 a 14/11.
- Anual: janeiro a dezembro do ano escolhido.
- Personalizado: escolha datas inicial e final, inclusivas.
- Datas são salvas no orçamento. Mudar settings depois não desloca planos já
  salvos. Alterar mês/ano ou datas do orçamento cria sua nova janela de consulta.
- Os limites são desse período específico. Não há repetição automática do
  orçamento nos meses seguintes nem transferência de sobra entre períodos.

Editar substitui os limites do plano, sem modificar lançamentos. Arquivar
preserva os itens e libera a possibilidade de outro plano no mesmo intervalo.
Incluir arquivados permite consultar/restaurar; restauração revalida sobreposição.

## Cálculo e alertas

Exemplo: Mercado com limite de R$ 1.200, R$ 800 confirmados e R$ 150 pendentes:
comprometido R$ 950, disponível R$ 250. Se comprometido superar o limite,
exibir excesso. Aviso visual a partir de 80%, limite atingido em 100% e excesso
acima de 100%. O app continua permitindo registrar despesas.

O consumo usa splits de transações expense, pela transactionDate e intervalo
inclusivo do orçamento. Não usa competência. Pending e confirmed aparecem
separados; canceled e soft deleted não entram. Receitas/transferências não
consomem limite. Gerar uma recorrência pode criar um pending que já aparece
como comprometido; o template sozinho não conta como gasto.

Pendentes entram no comprometido mesmo quando includePendingInReports=false
no dashboard. A tela informa essa diferença: orçamento acompanha compromissos,
e o setting continua controlando apenas o resultado dos relatórios existentes.

Categorias são exatas. Um split na categoria filha não entra automaticamente
na categoria pai; pai/filha podem ter limites independentes sem dupla contagem.
Cada categoria só pode ter um item no mesmo plano.

A seção Despesas sem limite mostra, separadamente, categorias sem item e gastos
sem categoria na mesma visão/período/moeda. Esses valores não são descontados
do disponível das categorias limitadas. O limite total/disponível total somam
somente itens do plano; a tabela indica excessos individuais mesmo quando há
sobra em outra categoria.

Dinheiro permanece em centavos inteiros seguros; somas usam BigInt. Limites
devem ser positivos e sua soma segura; consumo acima da faixa retorna 400,
sem arredondar nem alterar dados.

## Pessoa, moedas e sobreposição

Casa inclui todas as pessoas e lançamentos sem pessoa. Um orçamento individual
inclui somente personId. Casa/individual são visões sobrepostas; não somar seus
totais como se fossem gastos diferentes.

A moeda é explícita no orçamento. O cálculo usa a moeda da conta, ou a moeda
atual dos settings da casa para lançamentos sem conta, conforme o modelo atual
do app. Não há conversão cambial. Despesas em outra moeda são excluídas do
cálculo e sua quantidade aparece em aviso. Alterar currency dos settings muda
a interpretação dos lançamentos sem conta; eles ainda não têm moeda histórica
própria. Limites do orçamento mantêm a moeda salva.

Não se permitem dois orçamentos ativos com a mesma categoria, casa/pessoa
exata e moeda em datas sobrepostas, inclusive uma data compartilhada no limite.
Os nomes e tipos de período podem diferir; a regra de sobreposição continua.
Diferentes categorias, pessoas, moedas ou períodos disjuntos são permitidos.
Casa e pessoa podem coexistir. Criação, edição e restauração verificam a regra
dentro de transação imediata, serializando escritores.

## Histórico e autorização

Owner/admin/member podem criar, editar, arquivar e restaurar planos da própria
casa. Sessão, CSRF, membership e isolamento por ID são os mesmos dos lançamentos.
Pessoa e categorias devem pertencer à casa; categorias são somente de despesa.
Novos vínculos não aceitam pessoas/categorias arquivadas. Edições/restaurações
podem manter referências históricas existentes. Categorias usadas em orçamento,
inclusive arquivado, não podem mudar de tipo.

Gravação de orçamento e itens é atômica, com rollback em falhas parciais.
Arquivar apenas marca isArchived: não apaga os itens, transações ou pessoas.
Nenhuma operação de orçamento movimenta saldo de conta.

## API

| Método | Caminho | Resultado |
| --- | --- | --- |
| GET | /budgets/ | Planos ativos da casa da sessão |
| GET | /budgets/?includeArchived=true | Inclui arquivados |
| GET | /budgets/:id | Plano e itens |
| GET | /budgets/:id/summary | Consumo por categoria e despesas sem limite |
| POST | /budgets/ | Cria; 201 |
| PUT | /budgets/:id | Substitui plano e itens; casa imutável |
| DELETE | /budgets/:id | Arquiva; 204 |
| POST | /budgets/:id/restore | Restaura com validação de sobreposição |

Exemplo mensal para casa cujo início financeiro é dia 15:

```json
{
  "householdId": "ID_DA_CASA",
  "personId": null,
  "name": "Casa — outubro",
  "period": "monthly",
  "startsAt": "2026-10-15",
  "endsAt": "2026-11-14",
  "currency": "BRL",
  "items": [
    { "categoryId": "ID_MERCADO", "limitCents": 120000 },
    { "categoryId": "ID_LAZER", "limitCents": 40000 }
  ]
}
```

De 1 a 100 itens, sem categorias repetidas. startsAt/endsAt exigidos; monthly e
yearly validam a janela. Na edição que preserva período/datas já salvos,
mudanças posteriores de settings não invalidam a janela histórica.

Summary retorna budget, items (limite, confirmado, pendente, comprometido,
disponível e excesso), totals, unbudgeted, unbudgetedCents e excludedCurrencyCount.
A leitura usa transação SQLite para uma visão consistente dos dados.
Tipos compartilhados e schemas Zod/OpenAPI acompanham as novas rotas.

## Verificação

Testes em SQLite temporário cobrem splits, status, moedas, pessoa, categorias,
janelas financeiras, sobreposição/restauração, arquivamento, rollback de itens,
limites numéricos e isolamento/autorização. Playwright exercita criação, consumo,
excesso, plano individual, edição, sobreposição, arquivo/restauração, reload e
tela de celular. O banco e as credenciais reais não foram usados.
