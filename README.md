# MillionsNest Connect

## Visão Geral
O **MillionsNest Connect** é a camada omnichannel de atendimento, relacionamento, agentes de IA e execução segura de ações nos aplicativos do ecossistema MillionsNest. Este repositório contém o código frontend em React/Vite, atualmente operando em um modo de demonstração (DEMO_MODE), validando conceitos de segurança, políticas e interface de usuário através de mocks locais antes da integração definitiva com os serviços de backend.

## Stack
* **Framework:** React 19, Vite 6
* **Estilização:** Tailwind CSS 4
* **Linguagem:** TypeScript
* **Runtime de Testes:** Node.js (via `tsx`)
* **Principais Dependências:** `lucide-react`, `motion`, `@google/genai`, `express`

## Estrutura do Repositório
* `/src`: Código-fonte principal da aplicação.
  * `/src/components`: Componentes visuais genéricos de layout e interface.
  * `/src/core`: Lógica central (políticas de acesso, regras de negócio e `ToolGateway`).
  * `/src/demo`: Dados simulados (datasets) e simuladores de backend (`DemoPolicySimulator`) para execução autônoma em DEMO_MODE.
  * `/src/features`: Módulos funcionais isolados por domínio (inbox, menu, tools, knowledge, etc).
  * `/src/tests`: Testes unitários e de domínio isolados.
  * `/src/types`: Definições de tipagem TypeScript canônicas do projeto.
* `/docs`: Documentações suplementares (arquitetura, regras de produto, protocolo de ferramentas e segurança).

## Pré-requisitos
* Node.js (v22 recomendado)
* Gerenciador de pacotes: npm, com `package-lock.json` versionado para instalações reproduzíveis.

## Instalação
Instalação reproduzível a partir do lockfile:
```bash
npm ci
```

## Desenvolvimento
Para iniciar o servidor local:
```bash
npm run dev
```

## Build
```bash
npm run build
```

## Lint
A checagem estática (typecheck e sintaxe) é feita pelo TypeScript:
```bash
npm run lint
```

## Testes
O projeto possui scripts de testes individuais e independentes. Alguns dos principais:
* `npm run test:chartdelivery`
* `npm run test:inbox-domain`
* `npm run test:inbox-mobile`
* `npm run test:zerocost`
* `npm run test:gatewayzc`
* `npm run test:gatewaytenant`
* `npm run test:authority`
* `npm run test:menu-mobile`
* `npm run test:tools-mobile`

Consulte o `package.json` (bloco `scripts`) para visualizar todos os comandos disponíveis.

## Variáveis de Ambiente
Crie um arquivo `.env` referenciando `.env.example`.  
Variáveis atualmente necessárias:
* `GEMINI_API_KEY`: Chave da API (server-side)
* `APP_URL`: URL base do serviço

**Atenção:** Nunca inclua credenciais reais nos arquivos versionados ou na documentação.

## Arquitetura Resumida, Autenticação e Integrações
A arquitetura é fundamentada em um princípio de **Zero Trust Client**:
* O frontend não toma decisões finais de autorização.
* O componente central de execução de ações é o `ToolGateway`, acessível via Tool Protocol.
* Atualmente (DEMO_MODE), o `DemoPolicySimulator` avalia contexto (organização, claims de acesso e confirmações do usuário) em substituição a um backend real.
* O sistema prevê integrações operacionais (como *MusicScale*) através de ferramentas (Tools) padronizadas e auditáveis.

## Documentação Adicional
Consulte os arquivos na pasta `/docs` para aprofundamento técnico:
* `docs/ARCHITECTURE.md`: Detalhes sobre o isolamento do frontend, idempotência e o DEMO_MODE.
* `docs/PRODUCT.md`: Proposta de valor e regras inegociáveis de domínio.
* `docs/SECURITY.md`: Regras rigorosas de segurança, isolamento multi-tenant (organizações) e consentimento (LGPD).
* `docs/TOOL_PROTOCOL.md`: Protocolos de invocação e avaliação de risco das ferramentas do ecossistema.
