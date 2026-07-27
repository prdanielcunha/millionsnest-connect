# Architecture - Demo Mode

O aplicativo opera atualmente no **DEMO_MODE**, que simula comportamentos que futuramente serão validados pelo backend do MillionsNest.

## Distinção entre Simulação e Backend Real
- **Frontend não é autoridade**: O Connect não cria autoridade paralela. A autorização futura e as validações de idempotência e políticas devem ser invariavelmente reavaliadas server-side (backend).
- **ToolGateway**: O *Tool Gateway* atua como uma fachada, roteando invocações de ferramentas simuladas, não havendo persistência em banco real no modo de demonstração.
- **DemoPolicySimulator**: O simulador (DemoPolicySimulator) processa contratos (appAccess, capabilities, membership) e regras de negócio para autorização localmente como prova de conceito.

## Fluxo de Confirmação e Execução
1. Ferramentas R2 ou R3 exigem que o usuário autorize e confirme.
2. A confirmação local gera uma `DemoConfirmationEvidence`.
3. O `ToolGatewayService` recebe a invocação via `invokeTool`.
4. O `DemoPolicySimulator` avalia o risco e as evidências.
5. Se autorizado, a execução passa por checagens de **idempotência** e produz logs de **auditoria** (AuditEvent).
