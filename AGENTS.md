# AGENTS.md - Manual Técnico Operacional

## Project Purpose
**MillionsNest Connect** é a camada omnichannel de atendimento, relacionamento, agentes de IA e execução segura de ações no ecossistema MillionsNest. Este repositório foca na implementação do frontend (React/Vite). Atualmente, ele opera primordialmente no **DEMO_MODE**, utilizando mocks e simuladores (como `DemoPolicySimulator` e `ToolGateway`) locais para validar regras de negócios, políticas de risco e isolamento de interface de forma segura, sem mutações diretas em bases de dados reais.

## Mandatory Reading
Antes de modificar qualquer código ou estrutura, o agente DEVE:
1. Ler este `AGENTS.md` integralmente.
2. Ler o `README.md` localizado na raiz.
3. Consultar a documentação complementar em `docs/` (`ARCHITECTURE.md`, `SECURITY.md`, `PRODUCT.md`, `TOOL_PROTOCOL.md`).
4. Localizar a implementação funcional existente referente à tarefa.
5. Localizar os testes unitários/de domínio relacionados em `src/tests/`.
6. Avaliar o impacto das alterações na arquitetura do DEMO_MODE e no isolamento de componentes.

**ATENÇÃO:** O conhecimento do projeto é particionado. Existe um *Kit Externo de Sucessão* armazenado fora deste repositório com o histórico, o roadmap e a estratégia de negócio. NÃO assuma ou invente detalhes estratégicos que não estejam provados aqui. Baseie-se apenas em evidências (código, testes e documentação interna).

## Source of Truth
A hierarquia canônica de verdade técnica neste repositório é:
1. **Testes implementados** (`src/tests/*.ts`). Se um teste passa, ele documenta o comportamento atual esperado.
2. **Implementação de Core e Mocks** (`src/core/` e `src/demo/`).
3. **Documentação Técnica** (`docs/`).
4. **Comentários de código**.
Nunca assuma um comportamento silenciosamente se houver conflito. Investigue, baseie-se nos testes ou reporte a inconsistência.

## Architecture Overview
O projeto obedece ao princípio de **Zero Trust Client**:
* O frontend NUNCA possui autoridade de permissão ou acesso final.
* Todas as ações mutáveis operam via **Tool Protocol** através do **Tool Gateway** (`src/core/services/toolGateway.ts`).
* No cenário atual (DEMO_MODE), a avaliação é executada por simuladores (`DemoPolicySimulator`) baseados em regras rígidas e datasets fictícios restritos a contextos de organizações (`organizationId`).

## Repository Structure
* `/src/core/`: Onde residem serviços canônicos (`toolGateway`), validações e políticas (`zeroCostPolicy`).
* `/src/demo/`: Concentra todo o ambiente de mocks (datasets de cifras, simuladores, aprovações).
* `/src/features/`: Estruturação vertical da UI, dividida por módulos (inbox, tools, menu).
* `/src/components/`: Componentes visuais horizontais e layouts.
* `/src/types/`: Interfaces e tipos canônicos (fonte de verdade sobre dados).
* `/src/tests/`: Suítes executáveis de domínio.
* `/docs/`: Manuais estendidos do repositório.

## Critical Areas
As seguintes áreas são consideradas de **Alto Risco** e exigem extremo rigor e checagem de testes ao serem alteradas:
* `src/core/services/toolGateway.ts`: Ponto focal de entrada para ferramentas e auditorias.
* `src/demo/policies/demoPolicySimulator.ts`: Motor simulado de autorização e controle de capabilities e riscos.
* `src/core/policies/zeroCost/zeroCostPolicy.ts`: Regras restritas para provedores sem custo.
* `src/core/services/chartDelivery.ts` (e transposição associada): Filtros sensíveis de segurança multi-tenant baseados em `organizationId` e direitos autorais.

## Development Rules
* **Investigue antes de modificar**: O escopo deve ser sempre minimalista.
* **Reutilize e Evite Duplicação**: Use hooks, funções core e tipos já estabelecidos. Não crie segundas fontes de verdade (ex: dois tipos diferentes para `SongChartProjection`).
* **Não desative arquitetura por conveniência**: Não desative o `ToolGateway` em favor de chamadas diretas apenas para aprovar um requisito rápido.
* **Não adicione dependências ao acaso**: Preserve as decisões presentes no `package.json`.
* **Alterações pequenas**: Preserve a regressão executando o comando de teste específico relacionado ao módulo em que trabalhou.

## Commands
Comandos estritamente existentes no projeto (ver `package.json`):
* **Install**: `npm ci` (use `npm install` somente ao atualizar dependências e o `package-lock.json`)
* **Development**: `npm run dev`
* **Lint / Typecheck**: `npm run lint` (roda `tsc --noEmit`)
* **Build**: `npm run build`
* **Testes**: Executáveis isoladamente (ex: `npm run test:chartdelivery`, `npm run test:inbox-domain`, `npm run test:zerocost`, etc). Não tente executar um utilitário global de testes (como `jest` puro) se ele não estiver no arquivo de scripts.
  * Fronteira tenant do Tool Gateway: `npm run test:gatewaytenant`.

## Testing Requirements
As seguintes verificações **devem** ser realizadas antes da conclusão de uma tarefa de alteração de código:
1. Rode os scripts específicos de teste (`npm run test:*`) associados à área modificada.
2. Rode `npm run lint` para garantir aderência de tipagem e integridade no TS.
3. Rode `npm run build` para garantir que o empacotamento para produção (Vite/esbuild) não está quebrado.

## Definition of Done
A tarefa só é concluída quando:
* O requisito explícito foi implementado, e NADA MAIS.
* Nenhuma refatoração ou troca de biblioteca não solicitada foi realizada.
* Os testes relacionados (`test:*`) continuam verdes.
* `npm run lint` e `npm run build` passam com código zero (0).
* Se regras de negócio mudaram, a respectiva documentação (este arquivo, `README.md` ou `docs/`) foi atualizada.

## Security Rules
* **Nunca** escreva senhas, API keys ou secrets reais em commits, documentações (`AGENTS.md`, `README.md`) ou `.env.example`.
* Regras de isolamento de tenant (`organizationId`) são inegociáveis. Um dado de uma org A jamais vaza para uma org B.
* Encare qualquer modificação em `DemoPolicySimulator` ou validação de direitos (como visualização de cifra restrita) como risco de segurança grave se mal executada.

## Environment Variables
Somente os nomes das variáveis (nunca valores) podem ser documentados.
Atuais: `GEMINI_API_KEY`, `APP_URL`.

## Database / Persistence Rules
Neste projeto, em DEMO_MODE, as estruturas subjacentes como Firebase ou Firestore não existem operacionalmente.
Todo armazenamento ocorre por mocks fixos em memória (veja `src/demo`).
**Não invente persistências, nem injete Firebase** a menos que estritamente requisitado para sair do DEMO_MODE.

## Authentication / Authorization Rules
* Não utilize rotas de autenticação tradicionais do lado do cliente neste mock.
* O sistema conta com objetos artificiais de autorização (`ToolInvocationContext`, `appAccess`, `capabilities`) documentados no `docs/TOOL_PROTOCOL.md`.
* Frontend = apresentação. Autoridade reside na simulação do backend (`DemoPolicySimulator`).

## Cross-Project Integrations
O Connect age em conjunto com outros sistemas, como o MusicScale (citado em mocks e testes de transposição/música).
Qualquer integração real não confirmada nestes arquivos deverá ser considerada: **A VALIDAR COM O KIT EXTERNO DE SUCESSÃO**.

## UI / UX Rules
* Utilize componentes compartilhados (`src/components/common`, `src/components/layout`).
* Estilização mandatoriamente via Tailwind CSS.
* Ícones padronizados via `lucide-react`.
* Não crie sistemas visuais paralelos. Mantenha as interfaces limpas e alinhadas ao já implementado.

## High-Risk Files / Modules
* `/src/core/services/toolGateway.ts`
* `/src/demo/policies/demoPolicySimulator.ts`
* `/src/core/services/chartDelivery.ts`
* `/src/core/policies/zeroCost/zeroCostPolicy.ts`

## Known Technical Risks
* **DEMO_MODE Coupling:** Algumas funcionalidades dependem inteiramente de dados mocados (`mockChartDataset`, `mockInboxTickets`). Um risco técnico inerente será a migração para a API real, momento no qual a tipagem estrita (`src/types/`) deverá ser preservada.
* O uso inadequado de the `as any` nos arquivos de mock pode contornar a segurança de tipos (o que ocorreu historicamente). Seja severo quanto à tipagem.

## Change Discipline
* Evite mudar a arquitetura ou criar diretórios novos aleatoriamente.
* Se for designado a corrigir um bug de regra de negócio, não aplique refatorações visuais secundárias.
* Mudanças devem ser reversíveis, localizadas e com comprovação nos testes (sem suposições).

## Documentation Discipline
Sempre que novos scripts de testes, novos sub-domínios, novas integrações confirmadas ou novas variáveis de ambiente surgirem, o `README.md` e o `AGENTS.md` devem ser mantidos atualizados.

## When Uncertain
1. Investigue o código-fonte rigorosamente.
2. Consulte e leia os scripts de testes específicos (eles descrevem os casos de uso reais).
3. Consulte as documentações presentes em `/docs`.
Se ainda não possuir contexto, **A VALIDAR COM O KIT EXTERNO DE SUCESSÃO**. Nunca invente ou minta no código.
