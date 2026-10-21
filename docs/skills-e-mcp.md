# Skills e MCP recomendados

Recomendacoes registradas em **2026-10-20**. Este documento nao instala skills,
plugins ou servidores MCP, nem adiciona dependencias de IA a aplicacao.
Disponibilidade de ferramentas em um chat nao significa configuracao versionada
ou portavel para outra maquina.

## O que vai em cada lugar

- **Docs:** decisoes, regras, contratos, comandos e backlog do produto.
- **AGENTS.md:** contexto curto e convencoes recorrentes para quem alterar codigo.
- **Skill:** workflow reutilizavel para uma tarefa especifica, com instrucoes e
  eventualmente scripts/referencias.
- **MCP:** acesso do agente a uma ferramenta ou fonte de dados, como GitHub ou
  documentacao de bibliotecas. Nao substitui testes ou regras de negocio.

A descoberta de skills locais aceita `.agents/skills` no repositorio, com um
`SKILL.md` por skill. Essa estrutura pode ser versionada para acompanhar o clone.
Ver a [documentacao oficial de Skills](https://learn.chatgpt.com/docs/build-skills).

O [AGENTS.md da raiz](../AGENTS.md) ja foi incluido nesta documentacao para
reduzir dependencia de memoria do chat. Ver
[instrucoes oficiais de AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## Skills que eu criaria para este projeto

Os nomes abaixo sao propostas locais, nao pacotes de terceiros ja instalados.
Cada skill deve consultar estes MDs em vez de duplicar todo o dominio.

| Skill proposta | Quando usar | Conteudo esperado |
| --- | --- | --- |
| finance-api-endpoint | Criar/alterar um endpoint | Conferir regra, Zod, service, contrato HTTP, Swagger, erros e teste de integridade |
| finance-db-migration | Alterar schema ou persistencia | Examinar dados/constraints, gerar migration revisavel, aplicar em copia e conferir saldos/FKs |
| finance-backend-review | Revisar um bloco do backend | Procurar regressao de saldo, acesso entre casas, null/undefined, exclusoes e contratos divergentes |
| finance-home-server | Preparar operacao futura | Build/start, volumes, variaveis, backup/restauracao e configuracao do servidor |

Prioridade sugerida: endpoint e migration; review quando a suite de testes
existir; home-server quando o deploy entrar no escopo. Evitar criar uma skill
generica para cada biblioteca sem um workflow repetido que a justifique.

Estrutura proposta, ainda nao criada:

```text
.agents/skills/
  finance-api-endpoint/SKILL.md
  finance-db-migration/SKILL.md
  finance-backend-review/SKILL.md
  finance-home-server/SKILL.md
```

As instrucoes devem nomear os comandos reais disponiveis e separar os planejados.
Exemplo: nao mandar executar pnpm test como se o script ja existisse.

## MCPs por prioridade

| Integracao | Prioridade | Uso recomendado |
| --- | --- | --- |
| Documentacao de bibliotecas, como Context7 | Alta, se a busca nativa nao bastar | Consultar Fastify/Drizzle/Zod por versao durante alteracoes de contrato |
| GitHub oficial | Media | Issues, PRs, historico e verificacoes remotas ao colaborar entre computadores |
| Playwright MCP | Posterior | Explorar Swagger UI e, depois, fluxos reais do frontend no navegador |
| SQLite com acesso somente leitura | Opcional | Inspecionar schema/dados sinteticos, se houver necessidade recorrente |
| Docker/SSH ou automacao de infraestrutura | Posterior | Operacao do home server quando houver fluxo de deploy definido |

**Context7:** fornece ferramentas para localizar bibliotecas e consultar sua
documentacao. Conferir cobertura e versao da biblioteca; preferir a fonte
oficial quando houver ambiguidade. Nao enviar dados financeiros para buscar
documentacao. Ver [repositorio mantido pelo fornecedor](https://github.com/upstash/context7).

**GitHub:** usar o servidor oficial, acesso limitado ao repositorio necessario e
somente leitura quando o trabalho for consulta/revisao. Escrita depende da tarefa
solicitada. Git e CLI locais podem atender sem MCP adicional. Ver
[GitHub MCP Server](https://github.com/github/github-mcp-server).

**Playwright:** ajuda a inspecionar e operar interfaces; nao substitui uma suite
versionada e reproduzivel de testes de API. Para o foco atual, Fastify inject e
mais direto. Ver [Playwright MCP oficial](https://github.com/microsoft/playwright-mcp).

Para SQLite/infraestrutura nao foi selecionado fornecedor ou pacote. Primeiro
avaliar se scripts locais, Drizzle Studio e comandos existentes resolvem.
Nao recomendo acesso MCP de escrita irrestrita ao banco financeiro pessoal.
Nao precisamos criar um MCP proprio para o Finance App no MVP.

## Portabilidade da configuracao

O Codex permite servidores em `~/.codex/config.toml` ou em
`.codex/config.toml` do projeto confiavel. Ver
[documentacao oficial de MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
Outros clientes podem usar outro formato: nao assumir que a configuracao do
editor sera automaticamente reutilizada por todos.

Recomendacao para quando instalar:

1. Versionar apenas uma configuracao ou exemplo sem segredos, com versoes dos
   servidores escolhidas e verificadas naquela data.
2. Manter tokens, logins OAuth e configuracoes privadas fora do Git; usar
   variaveis de ambiente ou autenticacao propria do cliente.
3. Usar caminhos relativos ou configuraveis, sem caminhos pessoais fixos.
4. Documentar requisitos de Node, Docker ou navegador para cada servidor ativado.
5. Reautenticar GitHub e outros servicos em cada computador quando necessario.
6. Validar as ferramentas disponiveis depois de configurar; clonar o repositorio
   por si so nao concede acesso a contas externas.

Comecaria com AGENTS.md e as docs, depois uma skill de endpoint e uma de
migration. Adicionaria Context7 se a consulta de documentacao trouxer ganho
concreto; GitHub quando houver uso recorrente de issues/PRs; Playwright ao
retomar o front. As credenciais e ferramentas externas nao devem ser necessarias
para rodar o backend local com SQLite.
