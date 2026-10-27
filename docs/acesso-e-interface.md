# Acesso individual e interface funcional

Entrega em 2026-10-26. Complementa os documentos de API, arquitetura e desenvolvimento.
Recorrências e orçamentos continuam fora da primeira entrega.

## Atualizar e iniciar

No Ubuntu/WSL, na raiz do projeto:

```bash
nvm use
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm auth:provision
pnpm dev
```

Também é possível executar os scripts com npm:

```bash
npm run db:migrate
npm run auth:provision
npm run dev
```

Os scripts da raiz continuam usando pnpm internamente. No primeiro setup de um
banco vazio, executar também db:seed depois de db:migrate e antes de auth:provision.
Não repetir seed para criar usuários adicionais.

A migration 0001 cria apenas sessions e índices. Não remove nem transforma os
lançamentos existentes. Fazer backup consistente dos dados reais antes de
atualizações de banco; a validação desta entrega usa somente bancos temporários.

O provisionamento pede e-mail e nome, lista as casas existentes com numero e ID,
e pede o numero da casa (Enter seleciona a primeira). Entradas invalidas repetem
a pergunta; nomes duplicados podem ser diferenciados pelo ID. Esse comando nao
cria nem renomeia casas. No seed padrao a casa se chama Casa; um nome novo, como
Ap-2801, nao era reconhecido pelo prompt antigo. Escolha a casa ja cadastrada
para provisionar o login sem separar seus dados em outra casa.

A senha precisa ter de 12 a 128 caracteres e e digitada sem eco. Senha curta,
longa ou confirmacao diferente exibem mensagem em portugues e repetem a pergunta
sem perder os dados de identidade/casa ja informados. Os defaults de
identidade sao admin@local e Admin. Para o primeiro acesso, informar o e-mail
do usuário do seed preserva seus vínculos e histórico.

Não existe senha padrão. Esse comando local também permite redefinir uma senha;
ao redefinir, as sessões antigas do usuário são revogadas. Um login em andamento
revalida a senha e o estado ativo dentro da transacao que cria a sessao; assim,
uma verificacao antiga nao cria sessao valida depois da redefinicao. O acesso administrativo
ao servidor é necessário para executá-lo. Não há endpoint público de setup,
cadastro livre, convite ou recuperação por e-mail.

Abra http://localhost:5173 e entre com as credenciais que acabou de definir.
Reinicie processos antigos depois de instalar dependências/migrations. Para
rede local/VPN, use o endereço do servidor na porta do frontend; o navegador
envia a API para /api no mesmo host. Vite encaminha ao backend por proxy.

## Fluxos disponíveis

- Login/logout individual, sessão após recarregar e alteração da própria senha.
- Dashboard por período financeiro e pessoa, resultado do período, receitas,
  despesas, valores pendentes separados, fluxo por dia e despesas por categoria.
- Lançamentos: criar receita/despesa/transferência, pessoa/conta/favorecido opcionais,
  múltiplos splits, tags, competência e observações.
- Editar lançamento completo, confirmar pendente e excluir com confirmação.
- Filtros por descrição/observações, tipo, status, conta, categoria, tag e pessoa;
  paginação de 20 registros e extrato incluindo transferências recebidas.
- Cadastros de contas, pessoas, categorias, favorecidos e tags, com edição,
  arquivamento/restauração de contas/pessoas/categorias e exclusão protegida de
  favorecidos/tags em uso.
- Preferências de fuso horário, início do período e inclusão de pendentes.
- Administradores podem criar logins de membro, vinculando uma pessoa financeira
  já existente ou criando uma nova. O vínculo mantém o histórico da pessoa.

O resultado do período não é saldo bancário. Saldos das contas consideram apenas
movimentos confirmados e aparecem individualmente. Se houver contas de moedas
diferentes, a interface oculta indicadores/gráficos consolidados: não existe
conversão cambial. A lista continua mostrando a moeda da conta de cada lançamento.

## Identidade e permissões

Owner/admin administram cadastros, preferências e novos logins. Member consulta
dados da própria casa e cria/edita/confirma/exclui lançamentos, inclusive para
outra pessoa da mesma casa. Vínculo financeiro não concede acesso por si só.

A casa vem da sessão e de membership válido, nunca da primeira casa global.
Leituras e escritas por ID, listas, settings, restauração e recálculo conferem
a casa autorizada. A autoria de novos lançamentos vem do login no servidor;
o cliente não pode escolher createdByUserId. Alterações preservam a autoria
original.

Uma sessão seleciona a primeira membership do usuário em ordem estável.
Troca entre casas na interface ainda não está implementada. Esta entrega
atende ao uso inicial de uma casa; não é administração completa de múltiplas casas.

## Mecanismo de acesso

- Senhas: scrypt assíncrono do Node, salt aleatório por senha, N=32768/r=8/p=1
  e comparação por timingSafeEqual. Não são armazenadas senhas em texto.
- Sessões: token aleatório de 32 bytes; SQLite guarda somente seu SHA-256.
  Cookie finance_session é HttpOnly, SameSite=Strict, Path=/, duração de 7 dias.
- COOKIE_SECURE=true deve ser configurado ao servir por HTTPS.
- Toda escrita autenticada exige x-csrf-token, retornado em login e GET /auth/me.
  O frontend mantém o token em memória; não usa localStorage para credenciais.
- Requisições com Origin incompatível são rejeitadas, inclusive login.
  CORS é fechado por padrão; WEB_ORIGIN permite um origin explícito quando
  necessário. Prefira frontend/API no mesmo origin com /api.
- Login: limite de 10 tentativas por IP/minuto; troca de senha: 5/minuto.
  O limitador em memória é adequado ao processo único previsto e reinicia
  junto da API. Sem suporte a múltiplas instâncias ou Redis.
- Logout invalida a sessão; mudar senha ou provisionar novamente revoga todas.
  Expiração, usuário inativo e membership removida bloqueiam acesso.
- Logs não recebem o body das credenciais. Respostas de erro não expõem SQL.

HTTP local permanece possível para desenvolvimento. Para o home server, use o
HTTPS configurado no Compose, inclusive com acesso por VPN. Esta entrega nao
configura o servidor automaticamente. Compose/Caddy, HTTPS e backups estao
implementados; consulte [producao](producao.md) para instalar e operar.

## Contratos ajustados

GET /transactions/ mantém array sem page. Com page=1, retorna
{items,total,page,pageSize}; limit define o tamanho de 1 a 200. Ordenação:
transactionDate, createdAt e id descendentes. Busca é substring, sem wildcard;
não há normalização completa de acentos/Unicode na busca SQLite.

GET /dashboard/monthly aceita personId; unassigned representa sem pessoa.
month=2026-10 com monthlyPeriodStartDay=15 cobre 15/10 a 14/11. Relatórios usam
transactionDate, não competência; datas de negócio não sofrem conversão de fuso.

Categories do dashboard inclui somente splits de despesas selecionadas e
um grupo category=null para sem categoria. Pendentes podem compor o resultado
conforme settings; confirmados e pendentes também vêm separados.

GET /people/ omite inativos por padrão; includeInactive=true inclui histórico.
POST /people/:id/restore, /accounts/:id/restore e /categories/:id/restore
restauram os cadastros. Novos lançamentos não aceitam referências arquivadas;
edições podem manter referências antigas. Tipos de categorias com histórico
não podem mudar, e hierarquias não admitem ciclos ou tipos incompatíveis.

Erros usam error/message e issues quando aplicável: 400 validação, 401 login,
403 permissão/CSRF/origin, 404 inexistente/fora da casa, 409 duplicidade,
429 limite de tentativas e 500 genérico para falha inesperada.

Schemas Zod e OpenAPI continuam separados. Foram alinhados os contratos alterados
e adicionadas respostas de acesso/erro e requisitos de cookie/CSRF. Algumas
respostas antigas ainda são genéricas; isso permanece como melhoria de contratos.

## Verificação e limites

A suite pnpm test usa bancos SQLite temporários e migrations versionadas.
O fixture apps/api/src/tests/serve-ui.ts cria outro banco temporário
e uma identidade exclusivamente sintética para verificação no navegador.
Não apontar testes ou esse fixture para o banco pessoal: ele sempre substitui
DATABASE_URL por um caminho novo.

Para uma verificação manual isolada, inicie a API sintética:

```bash
pnpm --filter @finance/api exec tsx src/tests/serve-ui.ts
```

Em outro terminal, rode Vite na porta de teste, apontando para essa API:

```bash
API_PROXY_TARGET=http://127.0.0.1:4333 pnpm --filter @finance/web exec vite --host 127.0.0.1 --port 4173 --strictPort
```

O fixture usa owner@example.invalid e Synthetic-Password-123! apenas no banco
sintético descartável. Essa credencial não existe no setup normal e não é uma
senha padrão do produto. Encerrar o fixture fecha e remove o banco temporário.

Continuam pendentes: CI, validacao dos containers no home server,
gestão completa de membros/papéis e multi-casa, recorrências,
orçamentos, faturas e parcelamento. Dados pessoais não foram usados nos testes.

## Evidencias da entrega

Verificado em 2026-10-26:

- pnpm install --frozen-lockfile, pnpm check, pnpm typecheck e pnpm build passaram.
- pnpm test: 94 testes passaram, sem skip, incluindo login concorrente,
  readiness e backup/restore. pnpm test:e2e: 2 cenarios passaram.
- Navegador Chromium: cadastro de contas/pessoa/tag/favorecido, despesa pendente,
  confirmacao, edicao, splits, receita, transferencia, filtros, dashboard,
  recarregamento com sessao, criacao de login vinculado, login de membro,
  restricao administrativa e exclusao. Nenhum erro JavaScript nesse fluxo.
- Desktop 1440px e celular 390px; rolagem de tabelas/contas fica no componente,
  sem overflow horizontal da pagina.
- Provisionamento local exercitado em PTY com migrations/seed temporarios:
  pessoa do seed preservada, senha sem eco e hash scrypt gravado.
- git diff --check e git diff --cached --check sem erros.

O fluxo de navegador agora esta versionado em tests/e2e e roda com pnpm test:e2e.
O comando inicia API/Vite isolados, nao reutiliza servidores existentes e usa
banco descartavel. pnpm test continua com testes Node; pnpm test:all executa ambos.
Na primeira vez: pnpm exec playwright install --with-deps chromium (bibliotecas
do sistema podem exigir privilegios administrativos). Nao apontar para o banco
pessoal. Os dois cenarios incluem fluxo financeiro/roles/mobile e credenciais
invalidas, com screenshots/traces locais apenas em caso de falha.

## Evolucao: recorrencias

A navegacao inclui Recorrencias para todos os papeis da casa. Criar/editar regras
de receitas/despesas, escolher intervalo, conferir previa e gerar pending.
Pausa/retomada preserva historico; a lista de lancamentos sinaliza a origem
recorrente e a data original. Antes de usar: npm run db:migrate. Nao ha geracao
automatica em background. Veja [guia](recorrencias.md). Orcamentos tambem foram implementados; [guia](orcamentos.md).

## Evolucao: orcamentos

Navegacao Orcamentos para todos os papeis. Planos mensais/anuais/personalizados
por casa/pessoa, moeda e categorias. Consumo confirmado/pendente, disponivel e
excesso, despesas sem limite, edicao e arquivamento/restauracao. Antes de usar,
execute npm run db:migrate para aplicar 0003. Nao repetir seed. O plano acompanha
seu intervalo salvo e nao cria lancamentos nem movimenta contas.
