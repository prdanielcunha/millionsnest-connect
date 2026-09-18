# AGENTS.md - Manual Técnico Operacional

## Project Purpose
**MillionsNest Connect** é a camada omnichannel de atendimento, relacionamento, agentes de IA e execução segura de ações no ecossistema MillionsNest. A interface React/Vite ainda opera predominantemente em **DEMO_MODE**, utilizando mocks e simuladores locais para validar regras de negócio, políticas de risco e isolamento de interface. O repositório também contém a primeira runtime server-side real do **Connect Core**, inicialmente limitada a uma vertical read-only e sem substituir silenciosamente o modo demonstrativo.

## Mandatory Reading
Antes de modificar qualquer código ou estrutura, o agente DEVE:
1. Ler este `AGENTS.md` integralmente.
2. Ler o `README.md` localizado na raiz.
3. Consultar a documentação complementar em `docs/` (`ARCHITECTURE.md`, `SECURITY.md`, `PRODUCT.md`, `TOOL_PROTOCOL.md`).
4. Localizar a implementação funcional existente referente à tarefa.
5. Localizar os testes unitários/de domínio relacionados em `src/tests/`.
6. Avaliar o impacto das alterações tanto no DEMO_MODE quanto na runtime real, quando a tarefa tocar `src/core/runtime`, `src/server` ou `server.ts`.

**ATENÇÃO:** O conhecimento do projeto é particionado. Existe um *Kit Externo de Sucessão* armazenado fora deste repositório com o histórico, o roadmap e a estratégia de negócio. NÃO assuma ou invente detalhes estratégicos que não estejam provados aqui. Baseie-se em evidências de código, testes e documentação interna.

## Source of Truth
A hierarquia canônica de verdade técnica neste repositório é:
1. **Testes implementados** (`src/tests/*.ts`).
2. **Implementação real ou demonstrativa correspondente ao fluxo** (`src/core/runtime`, `src/server`, `src/core`, `src/demo`).
3. **Documentação Técnica** (`docs/`).
4. **Comentários de código**.
Nunca assuma um comportamento silenciosamente se houver conflito. Investigue, baseie-se nos testes ou reporte a inconsistência.

## Architecture Overview
O projeto obedece ao princípio de **Zero Trust Client**:
* O frontend NUNCA possui autoridade de permissão ou acesso final.
* A UI ainda usa DEMO_MODE em diversos módulos, com `DemoPolicySimulator` e `ToolGatewayService` para provas de conceito.
* A primeira runtime real fica server-side em `src/core/runtime`, `src/server` e `server.ts`.
* O MillionsNest Hub permanece a fonte canônica de identidade, organizações, memberships e RBAC.
* Cada aplicativo de domínio deve revalidar sua própria autorização antes de acessar dados; o Connect não injeta roles/capabilities como autoridade.

### Primeira boundary real verificada no código
A vertical `get_next_schedule` usa:
1. `HubSessionContextHttpProvider` → `GET /api/ecosystem/connect/session-context` no Hub;
2. `ConnectCoreService` → resolução de intent, tenant/appAccess e auditoria fail-closed;
3. `MusicScaleNextScheduleHttpTool` → `GET /api/v1/connect/next-schedule` no MusicScale;
4. o MusicScale revalida o Firebase Bearer e exige sua capability canônica `scales.read`.

O bearer é transitório. Nunca persistir ou registrar o token em logs/auditoria.

## Repository Structure
* `/src/core/`: serviços canônicos e políticas, incluindo o ToolGateway demonstrativo.
* `/src/core/runtime/`: runtime real do Connect Core e adapters cross-app server-side.
* `/src/server/`: composição HTTP/Express da runtime real.
* `/src/demo/`: ambiente de mocks, datasets e simuladores.
* `/src/features/`: UI dividida por módulos (inbox, tools, menu etc.).
* `/src/components/`: componentes visuais e layouts.
* `/src/types/`: interfaces e tipos canônicos.
* `/src/tests/`: suítes executáveis de domínio/integração local.
* `/docs/`: manuais e especificações.
* `server.ts`: entrypoint do servidor Core.

## Critical Areas
As seguintes áreas são consideradas de **Alto Risco**:
* `src/core/services/toolGateway.ts`: gateway demonstrativo das ferramentas existentes.
* `src/demo/policies/demoPolicySimulator.ts`: autorização simulada.
* `src/core/policies/zeroCost/zeroCostPolicy.ts`: regras de provedores/custo.
* `src/core/services/chartDelivery.ts`: isolamento e entrega de conteúdo.
* `src/core/runtime/connectCore.ts`: orquestração da primeira runtime real.
* `src/core/runtime/hubSessionContextHttpProvider.ts`: boundary com o Hub canônico.
* `src/core/runtime/musicScaleNextScheduleHttpTool.ts`: boundary com MusicScale.
* `src/server/createConnectServer.ts` e `server.ts`: superfície HTTP server-side.
* `firebase.json` e workflows de deploy: fronteira de publicação; não alterar para apontar `/api/**` a backend inexistente.

## Development Rules
* **Investigue antes de modificar:** escopo sempre minimalista.
* **Reutilize e evite duplicação:** não crie segundas fontes de verdade.
* **Não desative arquitetura por conveniência:** não bypassar Hub, Tool Protocol ou autorização do app de destino.
* **Não confie no frontend:** UID, role, capabilities ou organizationId vindos do cliente são apenas contexto solicitado; autoridade precisa ser revalidada server-side.
* **Não adicione dependências ao acaso:** preserve as decisões do `package.json`.
* **Alterações pequenas e reversíveis:** testes antes de concluir.
* **Não promover runtime real automaticamente:** código server-side pronto não significa Cloud Run/Hosting configurado nem produção publicada.

## Commands
Comandos existentes no projeto:
* **Install:** `npm ci`
* **Frontend Development:** `npm run dev`
* **Core Development:** `npm run dev:core`
* **Lint / Typecheck:** `npm run lint`
* **Frontend Build:** `npm run build`
* **Core Server Build:** `npm run build:core`
* **Core Server Start:** `npm run start:core`
* **Core HTTP/Integration Tests:** `npm run test:core-http`
* **Tool Gateway tenant boundary:** `npm run test:gatewaytenant`
* Demais testes: scripts `npm run test:*` definidos em `package.json`.

Não invente comandos adicionais que não existam no `package.json` atual.

## Testing Requirements
Antes da conclusão de uma alteração:
1. Rode o teste específico da área modificada.
2. Rode `npm run lint`.
3. Rode `npm run build` se tocar no frontend ou contratos compartilhados.
4. Rode `npm run build:core` e `npm run test:core-http` se tocar na runtime server-side.
5. Se tocar em Hosting/deploy, rode o contrato `npm run test:firebase-hosting` e valide que nenhum backend inexistente foi referenciado.

## Definition of Done
A tarefa só é concluída quando:
* o requisito explícito foi implementado e o escopo incidental preservado;
* nenhuma refatoração cosmética alheia foi introduzida;
* testes relacionados continuam verdes;
* lint/build aplicáveis passam;
* documentação acompanha mudanças reais de arquitetura, integração ou env;
* nenhuma alegação de “produção pronta” é feita sem evidência de deploy/smoke real.

## Security Rules
* **Nunca** escreva senhas, API keys, Firebase Bearer, JWTs ou secrets reais em commits/documentação/.env.example.
* Isolamento por `organizationId` é inegociável.
* Nenhum dado de org A pode ser devolvido em contexto de org B.
* O Connect não pode confiar em telefone, Instagram ID, e-mail, UID ou role informados pelo cliente como prova de autorização.
* A primeira runtime real deve continuar encaminhando apenas o mínimo necessário ao app de destino; o MusicScale revalida o bearer por conta própria.
* Logs/auditoria não podem conter bearer, conteúdo integral de mensagens, e-mail ou telefone. UIDs devem ser mascarados quando logados.

## Environment Variables
Somente nomes/descrições e exemplos não secretos podem ser documentados.

Variáveis existentes:
* `GEMINI_API_KEY` — secret server-side para fluxos Gemini existentes.
* `APP_URL` — URL base do app quando necessária.
* `MILLIONSNEST_HUB_ORIGIN` — origin server-side do Hub canônico; não é secret.
* `MUSICSCALE_ORIGIN` — origin server-side do MusicScale; não é secret.
* `PORT` — porta do servidor Core quando executado standalone.

## Database / Persistence Rules
A UI em DEMO_MODE continua usando mocks locais. A primeira runtime real **não introduz um banco de identidade/RBAC no Connect** e não recebe acesso direto ao Firestore do MusicScale.

Para a primeira vertical real:
* contexto de sessão vem do Hub por API server-side;
* dados de escala são lidos pelo endpoint autenticado do próprio MusicScale;
* auditoria inicial é log estruturado PII-safe, não uma persistência durável declarada.

Não invente persistências nem replique coleções do Hub/MusicScale dentro do Connect sem especificação explícita e arquitetura revisada.

## Authentication / Authorization Rules
* UI demonstrativa e runtime real são conceitos distintos.
* Na runtime real, o browser fornece apenas o Firebase Bearer transitório e o pedido do usuário.
* O Connect consulta o Hub para contexto canônico.
* O app de destino deve revalidar o mesmo bearer e sua própria capability antes de qualquer leitura/mutação.
* Para a vertical de próxima escala, a capability real do MusicScale é `scales.read`.
* Nunca crie hardcoded UID, owner bypass ou capability sintética para fazer um teste passar.

## Cross-Project Integrations
Integrações reais confirmadas no código desta branch:
* **MillionsNest Hub:** `GET /api/ecosystem/connect/session-context` via `MILLIONSNEST_HUB_ORIGIN`.
* **MusicScale:** `GET /api/v1/connect/next-schedule` via `MUSICSCALE_ORIGIN`, com autorização revalidada pelo MusicScale.

Demais integrações continuam A VALIDAR conforme código/documentação/kit de sucessão. Não marque WhatsApp, Instagram, NestFinance ou outros canais/apps como “integrados” sem implementação e testes reais.

## UI / UX Rules
* Utilize componentes compartilhados.
* Estilização via Tailwind CSS.
* Ícones via `lucide-react`.
* Não crie sistemas visuais paralelos.
* A UI atual do Inbox continua demonstrativa até existir handoff/autenticação canônica suficiente para chamar `/api/core/message` com segurança.

## Hosting / Deploy Rules
* O Firebase Hosting atual continua estático, com fallback SPA para `/index.html`.
* A existência de `server.ts` e de `dist-core/server.cjs` não publica a API.
* Antes de adicionar rewrite `/api/**`, verificar o serviço Cloud Run real e seus contratos de autenticação/ambiente.
* Alterações de deploy devem preservar rollback, WIF existente e smoke tests.
* Não realizar deploy de produção como efeito colateral de uma PR de código sem autorização operacional e gates adequados.

## Known Technical Risks
* **DEMO_MODE Coupling:** módulos de UI ainda dependem de dados mockados.
* **Boundary de autenticação:** o frontend ainda não deve chamar a runtime real até haver uma fonte canônica segura do bearer/contexto.
* **Hosting estático:** a runtime Core ainda precisa de publicação Cloud Run + rewrite validada antes de estar acessível pelo domínio público.
* Uso inadequado de `as any` pode contornar a segurança de tipos.

## Change Discipline
* Evite ampliar escopo.
* Não misture migração de Hosting, mudanças visuais, WhatsApp e novos produtos em um mesmo patch sem necessidade.
* Preserve `main`/produção enquanto a implementação estiver em Draft/validação.
* Mudanças devem ser reversíveis, localizadas e comprovadas por testes.

## Documentation Discipline
Sempre que novos scripts, integrações reais, variáveis de ambiente ou fronteiras de deploy surgirem, mantenha `README.md`, `docs/` e este arquivo coerentes com o código. Não descreva mocks como produção nem runtime staged como deploy concluído.

## When Uncertain
1. Investigue o código-fonte.
2. Consulte os testes específicos.
3. Consulte `docs/`.
4. Verifique o repositório canônico do app externo antes de inventar endpoint/capability.
5. Se ainda faltar evidência, marque **A VALIDAR** e não fabrique arquitetura funcional falsa.
