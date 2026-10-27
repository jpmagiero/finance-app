# Regras de negocio

Este documento separa o comportamento atual das intencoes de produto.
As lacunas conhecidas estao em [estado e proximos passos](estado-e-proximos-passos.md).

## Casa, usuarios e pessoas

- Todo dado financeiro pertence a uma casa (`householdId`).
- `users` e a identidade de acesso; `household_people` e a identidade financeira.
- Uma pessoa financeira pode existir sem usuario e ser vinculada posteriormente.
  Seu ID e historico devem ser preservados ao adicionar o vinculo.
- `personId` informa de quem e a receita/despesa. `createdByUserId`
  informa o login que registrou; o servidor o preenche e preserva na edicao.
- `personId=null` representa um lancamento sem atribuicao individual, normalmente
  da casa. Nao existe um registro especial obrigatorio chamado Casa em people.
- Pode-se lancar em nome de outra pessoa da casa sem trocar de login.
- Uma transacao hoje tem no maximo uma pessoa. Splits dividem categorias,
  nao pessoas; rateio financeiro entre membros foi adiado.
- Visao consolidada inclui todos os lancamentos da casa, inclusive os individuais.
  Visao individual filtra a pessoa. Nao ha regra automatica de repartir gastos
  sem pessoa entre os membros.

Owner/admin administram cadastros, configuracoes e novos logins. Member pode
consultar e operar lancamentos da propria casa, inclusive de outra pessoa.
A casa vem da sessao e a membership e revalidada a cada requisicao.
Vinculos de pessoa/login exigem membership e sao unicos por usuario/casa na
aplicacao; userId=null remove o vinculo. Acesso nao e concedido por esse vinculo.

## Transacoes e classificacao

Tipos permitidos em novos payloads: `income`, `expense`, `transfer`.
`adjustment` permanece no schema do banco e nas consultas de historico, mas
POST/PUT o rejeitam com 400 ate definir sua regra financeira.
Status atuais: `pending`, `confirmed`, `canceled`; default `confirmed`.

O payload exige casa, tipo, valor positivo em centavos, data e ao menos um split.
Pessoa, conta e favorecido sao opcionais. Uma despesa para um estabelecimento
nao cadastrado pode usar `description` sem `payeeId`.

Regras implementadas no Zod e services:

1. Total e valor de cada split devem ser inteiros positivos.
2. Soma dos splits deve ser exatamente igual a `amountCents`.
3. Categoria e opcional por split; mesmo sem divisao, enviar um split unico.
4. Pessoa, contas, favorecido, categorias e tags referenciados devem pertencer
   a mesma casa informada no payload.
5. Categoria deve combinar com o tipo da transacao.
6. Transferencia precisa de origem e destino distintos, ambos cadastrados
   e da mesma moeda. A casa da transacao e imutavel no PUT.
7. Outros tipos nao aceitam `transferAccountId`.
8. Tags duplicadas no payload sao removidas antes de persistir.
9. Transacao, splits, tags e movimentos de saldo sao persistidos atomicamente.

Datas exigem calendario valido em YYYY-MM-DD, anos 0001 a 9999; meses exigem
YYYY-MM com mes 01 a 12. Filtros exigem from <= to. Dinheiro usa inteiros seguros
JavaScript (limites inclusivos de +/- 9007199254740991 centavos); valores de
transacoes e splits sao positivos. Somatorios usam BigInt internamente, e saldo
final/relatorios fora da faixa segura retornam 400 sem gravar valor arredondado.

`adjustment` foi adicionado como preparacao, mas nao tem sentido positivo/negativo
definido. Sua criacao/substituicao esta bloqueada; registros legados continuam
sem efeito no saldo e nao devem ser usados para conciliacao. Tambem nao ha tratamento de estornos ou conversao entre moedas.

## Saldos

Somente transacoes `confirmed` movimentam contas. Pendentes e canceladas nao
alteram saldo; lancamentos sem conta podem entrar nos relatorios, mas nao no
saldo de uma conta.

| Operacao confirmada | Origem | Destino |
| --- | --- | --- |
| income | Soma o valor em accountId | Nao se aplica |
| expense | Subtrai o valor em accountId | Nao se aplica |
| transfer | Subtrai em accountId | Soma em transferAccountId |
| adjustment | Sem impacto implementado | Sem impacto implementado |

Ao editar uma transacao, o service calcula o efeito liquido por conta entre o
lancamento antigo e o novo, e substitui dados, splits e tags na mesma transacao
de banco. Isso contempla mudar valor, tipo, conta e status. O calculo exato evita
overflow intermediario na reversao de uma edicao cujo saldo final e valido.

DELETE faz soft delete e reverte o efeito anterior. Um segundo DELETE encontra
a transacao como excluida e retorna 404, sem reverter o saldo novamente.
Nao ha endpoint de restauracao.

`POST /accounts/:id/recalculate-balance` reconstroi o saldo a partir de
`initialBalanceCents` mais movimentos confirmados nao excluidos, incluindo
transferencias recebidas. Esse e o criterio para reconciliar o cache do saldo.
`currentBalanceCents` e somente leitura: enviar esse campo em POST/PUT de conta
retorna 400. Criacao usa o saldo inicial; editar `initialBalanceCents` recalcula
o saldo atual a partir do historico na mesma transacao SQL. Overflow aborta
a edicao inteira. Divergencias legadas nao sao corrigidas automaticamente no
startup; o recalculo explicito continua disponivel.

Moeda de uma conta com qualquer historico, inclusive pending/canceled ou soft
deleted e transferencias recebidas, nao pode mudar. Ainda e possivel cadastrar
contas com moedas distintas; nao ha conversao ou agregacao por moeda no dashboard.
A restricao implementada neste bloco e de transferencia e preservacao do historico,
nao a proposta futura de moeda unica por casa.

## Categorias, tags e favorecidos

- Categorias suportam parentId. Criacao/edicao validam casa, tipo e ausencia
  de ciclos na hierarquia. Tipo de categoria usada em splits historicos nao
  pode mudar; mudancas tambem preservam consistencia dos filhos.
- Categoria tem nome unico por casa e tipo. `isSystem` identifica categorias do
  seed, mas nao impede edicao ou arquivamento.
- Tags sao marcadores livres, unicos por nome dentro da casa.
- Favorecidos guardam nome e nome normalizado com trim, minusculas em pt-BR e
  remocao de diacriticos. O nome normalizado e unico por casa.
- Duplicidades de unicidade retornam 409 com mensagem generica, sem expor SQL.

## Arquivamento e preservacao

| Recurso | DELETE atual | Listagem padrao |
| --- | --- | --- |
| people | Marca isActive=false | Omite inativas; includeInactive=true inclui todas |
| categories | Marca isArchived=true | Exclui arquivadas; includeArchived=true inclui todas |
| accounts | Marca isArchived=true | Exclui arquivadas; includeArchived=true inclui todas |
| payees | Exclusao fisica apenas se nao usado | Todos |
| tags | Exclusao fisica apenas se nao usada | Todas |
| transactions | Preenche deletedAt e reverte saldo | Exclui soft deleted |

Payees usados em transacoes, inclusive soft deleted, ou em recorrencias nao podem
ser apagados. Tags com vinculos em transaction_tags, inclusive de transacoes
soft deleted, tambem nao. Hoje esse bloqueio retorna 400.

POST /people/:id/restore, /accounts/:id/restore e /categories/:id/restore
restauram cadastros. Novos vinculos de lancamentos nao aceitam pessoas inativas
ou contas/categorias arquivadas. Edicoes podem manter referencias historicas
ja usadas, inclusive ao confirmar/excluir, sem criar novos vinculos inativos.

## Settings do MVP

Escolhida uma unica tabela tipada por casa, em vez de key/value generico ou
duas tabelas de preferencias. Isso mantem as configuracoes compartilhadas claras.

| Campo | Default | Comportamento atual |
| --- | --- | --- |
| currency | BRL | Configuravel, mas nao faz conversao ou valida compatibilidade entre contas |
| timezone | America/Sao_Paulo | Validado como fuso IANA; interface usa ao preencher a data atual; datas de negocio nao sao convertidas |
| locale | pt-BR | Persistido; nao representa uma internacionalizacao pronta |
| monthlyPeriodStartDay | 1 | API permite 1 a 28; altera os limites do periodo financeiro |
| includePendingInReports | true | Dashboard inclui pending e confirmed, exclui canceled |

PUT atual faz atualizacao parcial/upsert da configuracao. Tema pode ficar no
frontend/localStorage quando for implementado. `user_settings`, preferencia de
pessoa/conta e dashboard individual ficaram fora. Settings nao inclui a opcao
de somar canceladas; essa sugestao inicial foi descartada do modelo atual.

## Relatorios e previsoes

Dashboard usa transactionDate, nao competencia, e respeita monthlyPeriodStartDay.
Exemplo: month=2026-10 e dia 15 cobre 15/10 a 14/11.
Somente income soma receita e expense soma despesa. Transferencias nao entram
nesses totais; `balanceCents` e receita menos despesa do periodo, nao saldo
bancario consolidado.

O agregado de categorias inclui apenas splits de despesas e contempla sem
categoria. Dashboard filtra pessoa ou unassigned (sem pessoa), e retorna
confirmados/pendentes separados, alem dos totais selecionados pelo setting.
Splits sao consultados com join filtrado pela casa e pelo periodo.
A interface oculta consolidacao de moedas distintas; nao ha cambio.

Previsoes futuras devem comecar com recorrencias, renda esperada, compromissos
e medias historicas por categoria. Nao foi escolhido modelo estatistico, provedor
de IA, biblioteca de graficos nem servico externo para isso.

## Recorrencias implementadas

Receitas/despesas com frequencia diaria/semanal/mensal/anual e intervalo 1 a 120.
startsAt ancora o calendario, endsAt e inclusivo; dias ausentes usam o ultimo
dia do mes sem desviar a ancora. Geracao explicita por intervalo de ate 366 dias
cria pending, com autoria do login e copia de splits/tags/observacoes.

O par regra/occurrenceDate e unico, inclusive apos soft delete ou edicao da
data do lancamento. Editar/pausar a regra preserva os lancamentos existentes.
Um pedido de geracao e atomico; referencias arquivadas bloqueiam novas
ocorrencias. Tipo de categoria/moeda de conta referenciados por regra nao podem
mudar; tags/favorecidos em uso nao podem ser apagados, inclusive em regra pausada.
Member tambem opera regras da propria casa. Veja [detalhes](recorrencias.md).
Orcamentos tambem foram implementados: [regras completas](orcamentos.md).

## Orcamentos implementados

Limites positivos por categoria de despesa exata; plano da casa inclui todas
as pessoas e sem pessoa, plano individual filtra personId. Consumo vem dos splits
de expense por transactionDate: confirmed e pending separados, canceled/deleted
excluidos. Comprometido = confirmado + pendente; disponivel = limite - comprometido.
Pendentes entram independentemente de includePendingInReports.

Monthly segue monthlyPeriodStartDay ao criar/alterar a janela; yearly e calendario
anual; custom tem datas explicitas. Datas salvas preservam planos apos mudar settings.
Moedas sao separadas, sem cambio; sem conta usa moeda atual da casa. Categorias
sem limite e sem categoria sao exibidas separadamente. Pai nao agrega filhos.

Nao sobrepor limites ativos na mesma categoria, casa/pessoa exata e moeda em
intervalos inclusivos sobrepostos. Casa e individuo coexistem como visoes.
Arquivar preserva itens/historico; restaurar revalida sobreposicao. Gravacao de
itens atomica; nenhum comando altera saldos. Todos os papeis operam na propria
casa, com sessao/CSRF. Categorias em uso nao podem mudar de tipo.
