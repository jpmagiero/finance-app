# Estado atual e próximos passos

Referência de continuidade: **2026-10-26**, após recorrências e orçamentos.
Este arquivo descreve o estado vigente. O [plano inicial](analise-e-plano-2026-10-26.md)
contém diagnóstico e decisões históricas; não interpretar achados antigos como
bugs ainda abertos sem conferir o código.

**Prioridade do usuário:** continuar o desenvolvimento do app antes do deploy.
Nenhum próximo bloco de funcionalidades foi escolhido após a entrega de orçamentos.
As prioridades abaixo são sugestões de continuidade, não autorização para
implementar todas de uma vez. Para outra máquina, siga [retomada](retomada.md).

## Entregue

| Área | Estado |
| --- | --- |
| Ambiente | Monorepo pnpm; Node 22/pnpm 9.15.4; Fastify/TS/Drizzle/SQLite, React/Vite e Biome |
| Persistência | 18 tabelas; migrations 0000 a 0003, seed inicial e lockfile versionados |
| Cadastros | Pessoas/contas/categorias com arquivo/restauração; tags/favorecidos com exclusão protegida |
| Financeiro | Receitas/despesas/transferências, conta/pessoa/favorecido opcionais, splits/tags, edição, status e soft delete |
| Integridade | Saldos atômicos, centavos seguros/BigInt, calendário real, mesma casa/moeda, rollback e recálculo |
| Consultas | Busca, filtros, paginação, extrato com transferências recebidas |
| Dashboard | Período financeiro/pessoa, fluxo, despesas por categoria, confirmado e pendente separados |
| Acesso | Login/logout, scrypt, sessões SQLite com hash de token, cookie HttpOnly, CSRF, origin e limites de tentativas |
| Autorização | Membership/casa/papel por requisição; autoria no servidor; primeiro login/recuperação local e criação de membro |
| Interface | Fluxos financeiros conectados, estados de erro/loading/vazio e verificação desktop/mobile |
| Recorrências | Receitas/despesas diárias/semanais/mensais/anuais, intervalo, início/fim, splits/tags/notas; prévia e geração explícita de pending |
| Idempotência | Chave regra/occurrenceDate preservada após editar data ou excluir; pausa/edição não altera histórico |
| Orçamentos | Casa/pessoa, moeda, mensal/anual/custom, limites por categoria exata, confirmado/pendente/disponível/excesso |
| Planejamento | Despesas sem limite separadas; proteção contra sobreposição; arquivo/restauração atômicos |
| Operação preparada | API ESM via esbuild/start Node; Compose/Caddy HTTPS, volumes e backup online/restore seguro |

Guias de comportamento: [regras](regras-de-negocio.md),
[acesso/interface](acesso-e-interface.md), [recorrências](recorrencias.md),
[orçamentos](orcamentos.md), [API](api.md) e [banco](banco-de-dados.md).

## Última questão de uso: Casa e pessoas

O usuário cadastrou valores para John e Admin e relatou zero ao filtrar por casa.
O código distingue:
- Toda a casa: soma todas as pessoas e lançamentos sem pessoa da casa autorizada.
- Casa / sem pessoa: inclui somente personId nulo.
- Pessoa: inclui somente o personId escolhido.

Não há rateio automático dos gastos da casa entre pessoas. O login autor e a
pessoa financeira são independentes. A explicação foi dada ao usuário; não houve
inspeção/reprodução no banco pessoal nem confirmação de bug em Toda a casa.

Possível melhoria de UX: tornar os nomes/descrições desses filtros mais claros.
Se o relato se referir a Toda a casa, investigar período, filtros/status, moeda
e casa da sessão com reprodução sintética antes de concluir que a consolidação
está quebrada. Não mudar a semântica para somar pessoas em Casa / sem pessoa.

## Funcionalidades pendentes

| Bloco | O que falta | Critério sugerido para a próxima entrega |
| --- | --- | --- |
| Clareza de visão | Melhorar explicação de consolidado e sem pessoa | John/Admin/sem pessoa com totais inequívocos na interface e testes |
| Recorrências automáticas | Geração em segundo plano; hoje só ação explícita | Definir quem é o autor, fuso/horário, janela, reinício/pausa e impedir duplicação inclusive com geração manual |
| Evolução de orçamentos | Copiar/repetir para próximos períodos; sem transporte de sobra hoje | Preservar planos anteriores e revalidar datas, moeda e sobreposição; definir cópia explícita ou automática antes de implementar |
| Membros e casas | Gestão completa de membros/papéis e troca da casa na UI | Selecionar somente casas autorizadas; regras para revogação/último owner; vínculo financeiro preservado |
| Cartão | Fatura, fechamento/vencimento e parcelamento | Definir compra x pagamento para não contar despesa duas vezes e tratar parcelas/estornos |
| Previsões | Projeção por recorrências e histórico | Separar previsto, pendente e realizado; não exigir IA em runtime |
| Multimoeda | Relatórios por moeda e moeda histórica em lançamentos sem conta | Evitar soma/conversão implícita e definir migração compatível do histórico |

Transferências recorrentes, edição/cancelamento em massa de ocorrências e agregação
de categorias filhas em orçamentos ainda não existem. São evoluções a discutir,
não requisitos já assumidos.

Imports CSV/OFX, anexos, convites por e-mail e rateio continuam adiados.
Não há autorização nesta etapa para integrações bancárias ou outras expansões.

## Melhorias técnicas pendentes

1. **Contratos:** respostas/DTOs completos nos endpoints antigos e reduzir
   duplicação Zod/OpenAPI. Rotas novas de planejamento já têm contratos específicos.
2. **Qualidade da interface:** ampliar acessibilidade e cenários de erro, teclado
   e navegador; manter o fluxo atual coberto.
3. **CI:** automatizar check/typecheck/build/test/E2E em pushes/PRs. Não há workflow
   implementado nem acesso remoto configurado por clonar o projeto.
4. **Testabilidade:** services compartilham db; conexão por instância só quando
   necessária. Não introduzir repositories/microserviços sem necessidade concreta.

Sugestão para retomar: escolher com o usuário o próximo bloco de produto; a
clareza dos filtros pode ser uma melhoria pequena inicial. Antes de scheduler
ou faturas, confirmar as decisões específicas da tabela acima.

## Deploy postergado

Não falta implementar do zero build/start, HTTPS ou backup: a base já existe.
Falta construir/exercitar imagens e contêineres no home server, configurar DNS,
confiar na CA nos dispositivos e exportar backups para outro dispositivo.
O daemon Docker não estava disponível na verificação anterior. A API compilada,
Caddy HTTPS e backup/restore foram exercitados fora dos contêineres com dados
sintéticos; Compose config foi validado.

Não retomar deploy como prioridade sem nova orientação do usuário.
Veja [produção](producao.md) quando esse bloco voltar ao escopo.

## Limites atuais que precisam ser preservados

- Só confirmed movimenta saldo; pending/canceled não. Recorrências geram pending.
- Datas financeiras são de negócio; dashboard usa transactionDate, não competência.
- Adjustment continua bloqueado para novas escritas.
- Transferências exigem contas distintas da mesma moeda.
- Dashboard oculta consolidação de moedas diferentes; orçamento separa por moeda.
- Sem conta, moeda vem do settings atual; não há moeda histórica própria.
- Orçamento usa categoria exata e pending no comprometido mesmo se o dashboard
  estiver configurado para ocultar pendentes.
- Mensal segue início financeiro ao criar a janela; datas salvas não se deslocam
  com mudanças posteriores em settings. Orçamento não se repete automaticamente.
- Sessão escolhe membership em ordem estável; UI ainda não troca entre casas.
- Seed é para banco novo; auth:provision não cria casas nem é convite multiusuário.

## Evidências e retomada

Última verificação da implementação anterior, em 2026-10-26:
- 121 testes Node e 4 cenários Playwright passaram, sem skip.
- check, typecheck, build e diff checks passaram.
- Telas desktop/mobile, inclusive orçamento em 390px, foram exercitadas/inspecionadas.
- Migrations e testes usaram SQLite temporário e dados sintéticos; o agente não
  aplicou migrations no banco pessoal. Isso não informa se o usuário já as aplicou.
- O provisionamento foi exercitado em PTY, com senha sem eco, nova tentativa e
  preservação dos vínculos do seed.

Essas evidências não significam que o setup foi validado em qualquer máquina.
Execute os checks novamente no novo clone. Nesta revisão de continuidade foram
alterados somente documentos; pnpm test/test:e2e não foram repetidos nesta rodada.

Antes de nova feature: ler AGENTS/README/retomada, conferir git status, instalar
pelo lockfile e escolher banco de desenvolvimento. Depois da feature: atualizar
Zod/OpenAPI, migrations quando necessárias, testes e docs. Nunca testar no SQLite
financeiro pessoal nem versionar .env, snapshots ou credenciais.
