# Regras de negocio

Este documento separa o comportamento atual das intencoes de produto.
As lacunas conhecidas estao em [estado e proximos passos](estado-e-proximos-passos.md).

## Casa, usuarios e pessoas

- Todo dado financeiro pertence a uma casa (`householdId`).
- `users` e a identidade de acesso; `household_people` e a identidade financeira.
- Uma pessoa financeira pode existir sem usuario e ser vinculada posteriormente.
  Seu ID e historico devem ser preservados ao adicionar o vinculo.
- `personId` informa de quem e a receita/despesa. `createdByUserId`, quando
  implementado, deve informar quem registrou.
- `personId=null` representa um lancamento sem atribuicao individual, normalmente
  da casa. Nao existe um registro especial obrigatorio chamado Casa em people.
- Pode-se lancar em nome de outra pessoa da casa sem trocar de login.
- Uma transacao hoje tem no maximo uma pessoa. Splits dividem categorias,
  nao pessoas; rateio financeiro entre membros foi adiado.
- Visao consolidada inclui todos os lancamentos da casa, inclusive os individuais.
  Visao individual filtra a pessoa. Nao ha regra automatica de repartir gastos
  sem pessoa entre os membros.

Papeis owner/admin/member estao modelados, mas ainda nao tem verificacao de
permissao. Adicionar ou vincular pessoas nao deve virar um mecanismo de expor
usuarios de outras casas. A forma segura de ativar isso continua pendente.

## Transacoes e classificacao

Tipos atuais: `income`, `expense`, `transfer`, `adjustment`.
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
5. Categoria deve combinar com o tipo da transacao; adjustment e excecao atual.
6. Transferencia precisa de origem e destino distintos, ambos cadastrados.
7. Outros tipos nao aceitam `transferAccountId`.
8. Tags duplicadas no payload sao removidas antes de persistir.
9. Transacao, splits, tags e movimentos de saldo sao persistidos atomicamente.

Datas sao validadas apenas por regex de formato. Datas impossiveis e valores
fora da faixa segura de inteiros JavaScript ainda precisam de validacao.

`adjustment` foi adicionado como preparacao, mas nao tem sentido positivo/negativo
definido e nao altera saldo atualmente. Nao usa-lo para conciliacao ate resolver
essa regra. Tambem nao ha tratamento de estornos ou conversao entre moedas.

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

Ao editar uma transacao, o service reverte o efeito antigo, substitui os dados,
splits e tags, e aplica o novo efeito dentro de uma transacao de banco.
Isso contempla mudar valor, tipo, conta e status.

DELETE faz soft delete e reverte o efeito anterior. Um segundo DELETE encontra
a transacao como excluida e retorna 404, sem reverter o saldo novamente.
Nao ha endpoint de restauracao.

`POST /accounts/:id/recalculate-balance` reconstroi o saldo a partir de
`initialBalanceCents` mais movimentos confirmados nao excluidos, incluindo
transferencias recebidas. Esse e o criterio para reconciliar o cache do saldo.
Hoje alteracoes manuais em `currentBalanceCents` ou `initialBalanceCents` podem
gerar divergencias; o recalculo nao preserva um saldo atual informado avulso.

## Categorias, tags e favorecidos

- Categorias suportam parentId. Criacao verifica casa do pai; update impede
  autorreferencia direta. Ciclos indiretos e consistencia completa de tipo entre
  pai/filhos ainda nao sao garantidos.
- Categoria tem nome unico por casa e tipo. `isSystem` identifica categorias do
  seed, mas nao impede edicao ou arquivamento.
- Tags sao marcadores livres, unicos por nome dentro da casa.
- Favorecidos guardam nome e nome normalizado com trim, minusculas em pt-BR e
  remocao de diacriticos. O nome normalizado e unico por casa.
- Duplicidades podem gerar erro SQL ainda nao mapeado para 409.

## Arquivamento e preservacao

| Recurso | DELETE atual | Listagem padrao |
| --- | --- | --- |
| people | Marca isActive=false | Ainda inclui pessoas inativas |
| categories | Marca isArchived=true | Exclui arquivadas; includeArchived=true inclui todas |
| accounts | Marca isArchived=true | Exclui arquivadas; includeArchived=true inclui todas |
| payees | Exclusao fisica apenas se nao usado | Todos |
| tags | Exclusao fisica apenas se nao usada | Todas |
| transactions | Preenche deletedAt e reverte saldo | Exclui soft deleted |

Payees usados em transacoes, inclusive soft deleted, ou em recorrencias nao podem
ser apagados. Tags com vinculos em transaction_tags, inclusive de transacoes
soft deleted, tambem nao. Hoje esse bloqueio retorna 400.

Nao existem endpoints de desarquivamento. Referencias a contas/categorias
arquivadas ou pessoas inativas ainda nao sao bloqueadas ao criar lancamentos.

## Settings do MVP

Escolhida uma unica tabela tipada por casa, em vez de key/value generico ou
duas tabelas de preferencias. Isso mantem as configuracoes compartilhadas claras.

| Campo | Default | Comportamento atual |
| --- | --- | --- |
| currency | BRL | Configuravel, mas nao faz conversao ou valida compatibilidade entre contas |
| timezone | America/Sao_Paulo | Persistido; dashboard ainda nao aplica calendario por timezone |
| locale | pt-BR | Persistido; nao representa uma internacionalizacao pronta |
| monthlyPeriodStartDay | 1 | API permite 1 a 28; ainda nao altera o periodo do dashboard |
| includePendingInReports | true | Dashboard inclui pending e confirmed, exclui canceled |

PUT atual faz atualizacao parcial/upsert da configuracao. Tema pode ficar no
frontend/localStorage quando for implementado. `user_settings`, preferencia de
pessoa/conta e dashboard individual ficaram fora. Settings nao inclui a opcao
de somar canceladas; essa sugestao inicial foi descartada do modelo atual.

## Relatorios e previsoes

Dashboard atual usa o mes calendario por `transactionDate`, nao competencia.
Somente income soma receita e expense soma despesa. Transferencias nao entram
nesses totais; `balanceCents` e receita menos despesa do periodo, nao saldo
bancario consolidado.

O agregado de categorias atual soma splits de todos os tipos selecionados e
precisa ser separado por receita/despesa antes de alimentar graficos de consumo.
O endpoint mensal ainda nao filtra por pessoa. A lista de transacoes ja filtra.

Previsoes futuras devem comecar com recorrencias, renda esperada, compromissos
e medias historicas por categoria. Nao foi escolhido modelo estatistico, provedor
de IA, biblioteca de graficos nem servico externo para isso.
