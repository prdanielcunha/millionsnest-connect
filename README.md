# MillionsNest Connect

## Visão Geral
O **MillionsNest Connect** é a camada inteligente de comunicação, atendimento, relacionamento e orquestração segura dos aplicativos do ecossistema MillionsNest. Em **LIVE_MODE**, o produto já possui superfícies reais e tenant-safe para Connect Core/Assist, experiência adaptativa por papel, Radar/Cofre/Pessoas, workspaces comerciais, Canais, Automações, Operações/Auditoria e Inbox durável com lista/timeline reais. O caminho legado de **DEMO_MODE** continua existindo apenas para demonstração e desenvolvimento isolado; ele não é a fonte de verdade da operação ao vivo.

A runtime server-side real está publicada em produção e preserva Hub/RBAC/multi-tenant/Tool Gateway como autoridades. O WhatsApp Business oficial já possui adapter, webhook, ingestão, outbox e boundary de resposta humana implementados, porém a **ativação do provider em produção permanece fail-closed até a configuração externa da Meta/GitHub Actions ser concluída**.

## Estado atual
Consulte `docs/CURRENT_STATUS.md` para o estado certificado, módulos ativos, gates restantes e a continuidade operacional.

## Stack
* **Frontend:** React 19, Vite 6
* **Servidor Core:** Node.js + Express
* **Estilização:** Tailwind CSS 4
* **Linguagem:** TypeScript
* **Runtime de Testes:** Node.js (via `tsx`)
* **Principais Dependências:** `lucide-react`, `motion`, `@google/genai`, `express`

## Estrutura do Repositório
* `/src`: Código-fonte principal da aplicação.
  * `/src/components`: Componentes visuais genéricos de layout e interface.
  * `/src/core`: Lógica central, incluindo o `ToolGateway` demonstrativo e a runtime server-side do Connect Core.
  * `/src/core/runtime`: contratos e adapters reais da primeira vertical do Core (Hub, MusicScale, auditoria e boundary HTTP).
  * `/src/server`: composição do servidor Express do Core.
  * `/src/demo`: dados simulados e simuladores de backend (`DemoPolicySimulator`) para a UI em DEMO_MODE.
  * `/src/features`: módulos funcionais isolados por domínio (inbox, menu, tools, knowledge, etc).
  * `/src/tests`: testes unitários e de domínio isolados.
  * `/src/types`: definições de tipagem TypeScript canônicas do projeto.
* `/docs`: documentações suplementares.
* `server.ts`: entrypoint server-side da runtime real do Connect Core.

## Pré-requisitos
* Node.js 22 recomendado.
* npm, com `package-lock.json` versionado para instalações reproduzíveis.

## Instalação
```bash
npm ci
```

## Desenvolvimento
Frontend DEMO_MODE:
```bash
npm run dev
```

Runtime server-side do Connect Core:
```bash
npm run dev:core
```

## Build
Frontend:
```bash
npm run build
```

Servidor Core:
```bash
npm run build:core
```

Para executar o bundle server-side já gerado:
```bash
npm run start:core
```

## Lint
```bash
npm run lint
```

## Testes
O projeto possui scripts de testes individuais e independentes. Alguns dos principais:
* `npm run test:core-http` — primeira vertical real Hub → Connect Core → MusicScale e boundary HTTP.
* `npm run test:chartdelivery`
* `npm run test:inbox-domain`
* `npm run test:inbox-mobile`
* `npm run test:zerocost`
* `npm run test:gatewayzc`
* `npm run test:gatewaytenant`
* `npm run test:authority`
* `npm run test:menu-mobile`
* `npm run test:tools-mobile`

Consulte o `package.json` para todos os comandos disponíveis.

## Variáveis de Ambiente
Crie um arquivo `.env` referenciando `.env.example`. Nunca versione valores reais de secrets.

Variáveis existentes da aplicação:
* `GEMINI_API_KEY`: chave server-side para os fluxos que usam Gemini.
* `APP_URL`: URL base do serviço quando necessária.

Variáveis server-side da primeira runtime real do Connect Core:
* `MILLIONSNEST_HUB_ORIGIN`: origem canônica do MillionsNest Hub usada para `GET /api/ecosystem/connect/session-context`.
* `MUSICSCALE_ORIGIN`: origem canônica do MusicScale usada para a ferramenta read-only de próxima escala.
* `CONNECT_RELEASE_SHA`: SHA imutável da revisão publicada; é exposto no `/api/health` para provar qual build está realmente servindo.

Essas duas variáveis contêm **somente origins** (scheme + host), nunca credenciais. O Firebase Bearer do usuário é recebido transitoriamente por requisição e não deve ser persistido nem registrado em auditoria.

## Arquitetura Resumida, Autenticação e Integrações
A arquitetura é fundamentada em **Zero Trust Client**:
* O frontend não toma decisões finais de autorização.
* O `ToolGateway` existente continua sendo a superfície demonstrativa das ações do DEMO_MODE.
* A primeira runtime real do Core é server-side e não aceita UID, role ou capabilities vindos do navegador como autoridade.
* Para a vertical de próxima escala, o Connect consulta o contexto canônico do Hub usando o Bearer do usuário; depois o MusicScale revalida independentemente o mesmo Bearer, a organização e a capability canônica `scales.read` antes de ler dados.
* O Connect não recebe acesso direto ao Firestore do MusicScale e não duplica autenticação/RBAC do Hub.
* A auditoria inicial dessa runtime é estruturada e PII-safe; persistência durável de auditoria permanece uma etapa posterior.

### Endpoints server-side preparados
* `GET /api/health` — healthcheck da runtime do Connect Core.
* `POST /api/core/message` — boundary in-app autenticada da primeira vertical do Core.
* `GET /api/core/nestjourney/followup` — projeção mínima e autenticada de um primeiro contato pendente do NestJourney. O Hub revalida tenant, entitlement, capability, escopo, owner e consentimento antes de liberar nome/telefone para o Connect.

### NestJourney Resolve Loop V1

O Connect pode receber um deep link seguro `/journey-followup/:id` vindo do NestJourney pelo handoff canônico do Hub. O identificador na URL é opaco e não contém nome, telefone ou texto pastoral.

Nesta V1, o Connect:
* busca o contexto mínimo de forma server-authoritative no Hub;
* prepara um roteiro de primeiro contato baseado no playbook Raiz e Mesa;
* abre o composer do WhatsApp com o rascunho;
* não afirma que a mensagem foi enviada;
* não encerra a Care Promise;
* devolve o usuário ao NestJourney para registrar o outcome humano observado.

O provider oficial do WhatsApp já possui boundary server-side implementada. Enquanto a ativação externa da Meta não estiver concluída, abrir um draft manual continua não sendo evidência de entrega nem resolução; envio oficial só pode ser registrado após confirmação real do provider.

Os endpoints live do Connect Core já são servidos pela arquitetura de produção com Cloud Run/rewrite e gates de release. Novos providers e ações permanecem desativados por padrão até passarem pelos respectivos preflights, smoke tests e políticas de rollback.

## Documentação Adicional
Consulte:
* `docs/ARCHITECTURE.md`
* `docs/PRODUCT.md`
* `docs/SECURITY.md`
* `docs/TOOL_PROTOCOL.md`
