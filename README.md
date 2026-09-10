# MillionsNest Connect

## Visão Geral
O **MillionsNest Connect** é a camada omnichannel de atendimento, relacionamento, agentes de IA e execução segura de ações nos aplicativos do ecossistema MillionsNest. A interface React/Vite ainda opera predominantemente em **DEMO_MODE**, validando conceitos de segurança, políticas e experiência com mocks locais. Em paralelo, esta base agora contém a primeira runtime server-side real e isolada do Connect Core, preparada para a vertical read-only **“Qual é minha próxima escala?”** sem transformar o frontend em autoridade.

A runtime real ainda está em fase de integração/validação e **não substitui o DEMO_MODE nem implica deploy em produção por si só**.

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

Esses endpoints existem no código da runtime, mas o Firebase Hosting atual continua estático até que uma integração Cloud Run/rewrite seja explicitamente validada e promovida.

## Documentação Adicional
Consulte:
* `docs/ARCHITECTURE.md`
* `docs/PRODUCT.md`
* `docs/SECURITY.md`
* `docs/TOOL_PROTOCOL.md`
