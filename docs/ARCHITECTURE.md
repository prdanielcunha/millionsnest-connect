# Architecture - Demo Mode e Primeira Boundary Real

A interface do aplicativo opera atualmente no **DEMO_MODE**, que simula comportamentos através de mocks e do `DemoPolicySimulator`. Esse ambiente continua válido para UX e ferramentas ainda não integradas.

Em paralelo, o repositório agora contém a **primeira boundary server-side real do Connect Core**, limitada inicialmente à consulta read-only **“Qual é minha próxima escala?”**. Essa runtime está sendo validada em branch/PR e não deve ser confundida com uma ativação automática em produção.

## Distinção entre Simulação e Backend Real
- **Frontend não é autoridade**: o navegador nunca cria ou concede permissão. Toda autorização real precisa ser revalidada server-side.
- **ToolGateway demonstrativo**: o `ToolGatewayService` existente continua roteando ferramentas simuladas em DEMO_MODE, com `DemoPolicySimulator`, idempotência demonstrativa e auditoria local.
- **Connect Core real**: a primeira runtime server-side fica em `src/core/runtime` e `src/server`, separada do comportamento mockado do Inbox atual.
- **Sem acesso direto cross-app ao Firestore**: o Connect não recebe credencial administrativa do MusicScale para essa vertical.

## Primeira Vertical Real: Próxima Escala
Fluxo preparado:

1. O cliente envia `POST /api/core/message` com um Firebase Bearer, texto da solicitação e, quando conhecido, `requestedOrganizationId`.
2. A boundary HTTP do Connect fixa o canal como `inapp`, cria `requestId`/`correlationId` server-side e não aceita roles/capabilities do browser como autoridade.
3. `HubSessionContextHttpProvider` consulta `GET /api/ecosystem/connect/session-context` no MillionsNest Hub.
4. O Hub revalida o Firebase Bearer e devolve o contexto canônico de usuário, organização e `appAccess.musicscale`.
5. `ConnectCoreService` valida tenant, app access, intent e disponibilidade de auditoria.
6. `MusicScaleNextScheduleHttpTool` chama server-to-server `GET /api/v1/connect/next-schedule` no MusicScale.
7. O MusicScale revalida novamente o mesmo Firebase Bearer, resolve membership/global role, exige `scales.read`, consulta apenas registros do `organizationId` autorizado e devolve uma projeção mínima da próxima escala atribuída.
8. O Connect valida novamente o `organizationId` retornado e só então entrega a resposta.

Nenhum `uid`, `systemRole`, `organizationRole`, permission ou capability informado pelo Connect é aceito pelo MusicScale como prova de autoridade. O Bearer é transitório e não entra na auditoria.

## P1 — Unified Fact Stream / Fact Foundation
A primeira vertical real também produz fatos canônicos no boundary da ferramenta, sem mudar a autoridade do Hub ou do MusicScale:

- `TOOL_ACTION_REQUESTED` antes da chamada real ao MusicScale;
- `TOOL_ACTION_COMPLETED` depois do resultado, inclusive em falha do upstream;
- `eventId` determinístico por `requestId + tool + fase`, permitindo deduplicação por um sink durável futuro;
- `organizationId`, `actorId`, `occurredAt`, `recordedAt`, `sourceApp`, `subjectRef`, `scope`, `evidenceRef`, `sensitivity`, `version` e payload mínimo;
- `evidenceRef` aponta inicialmente para a request do Connect e, quando disponível, para o `auditId` devolvido pelo MusicScale;
- Bearer, texto integral da mensagem, e-mail e telefone não fazem parte do contrato de fato.

O adapter inicial é `StructuredLogCoreFactPort`, que emite `MILLIONSNEST_CANONICAL_FACT` com ator mascarado. Isso cria o contrato da Fact Foundation sem introduzir Firestore paralelo, event bus, fila ou custo operacional novo antes da decisão compartilhada de persistência.

Nesta primeira fatia, falha no sink de fatos é **fail-open e observável** (`CONNECT_FACT_RECORD_FAILED`) para não regredir a consulta read-only já existente. A auditoria de segurança do Connect continua **fail-closed** e permanece obrigatória antes da execução da ferramenta.

## Composição Server-Side
Arquivos principais da primeira runtime real:
- `server.ts`: entrypoint Node/Express.
- `src/server/createConnectServer.ts`: healthcheck e endpoint `/api/core/message`.
- `src/core/runtime/connectCore.ts`: orquestração do Core e política fail-closed.
- `src/core/runtime/hubSessionContextHttpProvider.ts`: adapter para contexto canônico do Hub.
- `src/core/runtime/musicScaleNextScheduleHttpTool.ts`: adapter para a ferramenta read-only do MusicScale.
- `src/core/runtime/canonicalFacts.ts`: contrato canônico inicial, adapter estruturado e decorator da ferramenta real.
- `src/core/runtime/connectCoreRuntimeFactory.ts`: composition root server-side.
- `src/core/runtime/structuredCoreAudit.ts`: auditoria estruturada inicial sem PII sensível.

## Auditoria
A primeira runtime usa um `CoreAuditPort`. O adapter atual grava **logs estruturados PII-safe** e mascara o UID. Ele não registra Bearer, conteúdo integral da conversa, telefone ou e-mail.

Esse adapter não é declarado como armazenamento de auditoria durável. Uma persistência definitiva pode substituir o port posteriormente sem alterar o contrato central do Core.

## Fluxo de Confirmação e Execução no DEMO_MODE
Para as ferramentas simuladas já existentes:
1. Ferramentas R2 ou R3 exigem autorização/confirmação.
2. A confirmação local gera uma `DemoConfirmationEvidence`.
3. O `ToolGatewayService` recebe a invocação via `invokeTool`.
4. O `DemoPolicySimulator` avalia o risco e as evidências.
5. Se autorizado, a execução passa pelas checagens demonstrativas de idempotência e produz `AuditEvent`.

A primeira ferramenta real de próxima escala é **R1_AUTH_READ** e não realiza mutação.

## Estado de Deploy
A configuração atual do Firebase Hosting do Connect continua publicando o frontend estático e fazendo fallback SPA para `/index.html`. Portanto:
- a runtime server-side já pode ser construída separadamente com `npm run build:core`;
- isso **não significa que `/api/core/message` esteja publicado no domínio do Connect**;
- nenhuma rewrite `/api/**` para Cloud Run deve ser adicionada antes de existir e ser verificado o serviço real de backend;
- promoção para Cloud Run/Firebase Hosting deve ocorrer como etapa separada, pequena, reversível e coberta por smoke tests.

## Variáveis Server-Side
- `MILLIONSNEST_HUB_ORIGIN`: origem canônica do Hub.
- `MUSICSCALE_ORIGIN`: origem canônica do MusicScale.

São apenas origins e não secrets. Credenciais/tokens continuam transitórios e nunca devem ser versionados.

## P1 Fact Foundation — minimal read models

The canonical Fact Stream now also feeds a deterministic, tenant-scoped tool-activity projection.

- `InMemoryToolActivityReadModel` consumes the same canonical facts emitted by the real MusicScale boundary.
- Projection is idempotent by `eventId`, keeps only compact counters/references, and preserves `evidenceRef` for traceability.
- Rebuild from canonical facts is deterministic and AI-free; tests cover duplicate events, tenant isolation and out-of-order rebuild.
- `createConnectCoreRuntimeBundle` exposes the Core plus its internal read models without changing the existing `createConnectCoreRuntime` API.
- The current read-model storage is explicitly **process-memory only**. This slice does not claim durable Fact Stream/read-model persistence and does not introduce a new database, queue, event bus or runtime credential.
- A durable sink may replace/augment this projection later while preserving the fact schema and domain ownership boundaries.

## Segunda vertical real: repertório da próxima escala

O Core agora reconhece pedidos de repertório em PT/EN/ES e usa uma segunda boundary read-only:

1. Connect resolve o mesmo contexto canônico do Hub.
2. `get_next_schedule_repertoire` chama `GET /api/v1/connect/next-schedule/repertoire`.
3. O MusicScale revalida Firebase bearer + tenant e exige `scales.read` e `songs.read`.
4. Apenas a próxima escala atribuída ao próprio usuário é elegível.
5. O retorno é uma projeção mínima do repertório em ordem: título, artista, tonalidade de origem/programada, BPM efetivo e flags de disponibilidade de cifra/letra.
6. Connect valida novamente o tenant, preserva o `auditId` do MusicScale e produz fatos `TOOL_ACTION_REQUESTED/COMPLETED` com `toolId=musicscale.get_next_schedule_repertoire`.

Esta fatia não retorna cifra/letra crua. O deep link abre a escala canônica no MusicScale, evitando que o Connect represente cifra em tonalidade incorreta antes da vertical específica de charts/transposição.

## Terceira vertical real: presença da próxima escala

O Core também reconhece perguntas de presença/confirmação em PT/EN/ES e chama `GET /api/v1/connect/next-schedule/presence`.

- O MusicScale revalida bearer e tenant independentemente.
- A consulta só é executada para uma escala futura atribuída ao próprio usuário.
- O MusicScale exige leitura de escalas e a capability de resposta própria, e consulta somente respostas cujo `userId` é o usuário autenticado.
- O estado retornado é explícito: `pending`, `accepted`, `maybe`, `declined` ou `mixed`; ausência de resposta nunca é inferida como aceitação.
- O Connect valida novamente o tenant, preserva `auditId`/deep link e produz fatos com `toolId=musicscale.get_next_schedule_presence`.
- Nenhuma resposta de presença de terceiros faz parte do payload.

## Quarta vertical real: cifra no tom programado da próxima escala

O Core reconhece pedidos determinísticos como `cifra de <música>`, `chords for <song>` e equivalentes em espanhol.

- O título é extraído no Connect sem IA e enviado apenas para a boundary autenticada do MusicScale.
- O MusicScale resolve a música exclusivamente dentro do repertório da próxima escala atribuída ao usuário.
- Esta primeira fatia de conteúdo integral é limitada ao canal autenticado `inapp`; canais externos continuam bloqueados até existir política específica de entrega/rights.
- A transposição **não ocorre no Connect**. O MusicScale usa seu motor canônico e só transpõe quando `metadata.chordContentKey` confirma o tom real do conteúdo.
- Sem fonte de tom verificada, a resposta é `requires_source_key_confirmation` e não contém cifra.
- Falha na validação da transposição também remove a cifra do payload.
- Letras não fazem parte desta fatia.
- O Fact Stream registra apenas tool/intent/evidence; o título da música e o conteúdo da cifra não são persistidos no fato canônico.

## Inbox real — fundação canônica de threads e handoff

A UI histórica de Inbox ainda opera em `DEMO_MODE`, mas o Core passa a ter uma state machine canônica e independente da UI para a futura Inbox real.

Estados canônicos: `new`, `in_progress`, `waiting_person`, `waiting_team`, `resolved` e `archived`.

Eventos iniciais: `CONVERSATION_OPENED`, `MESSAGE_REPLIED`, `THREAD_ASSIGNED`, `HANDOFF_CREATED`, `THREAD_WAITING_PERSON`, `THREAD_RESOLVED`, `THREAD_REOPENED` e `THREAD_ARCHIVED`.

A projeção em `src/core/inbox/threadDomain.ts` é:
- tenant/thread pinned;
- idempotente por `eventId`;
- rebuildable e determinística;
- PII-minimal (sem corpo de mensagem, telefone, nome de contato ou nota pastoral livre);
- fail-closed para mistura de tenant/thread e transições inválidas;
- human-first: reply de pessoa pausa automação; handoff/assignment entra em modo humano; arquivamento exige resolução anterior.

Esta fatia **não declara persistência durável nem Inbox live**. Ela congela o contrato de estado/evento antes de ligar provider, armazenamento Connect-owned e a UI real.

