# Tool Protocol

O Tool Protocol estabelece a definição formal das ferramentas e da comunicação com o Tool Gateway.

## Principais Contratos
- **ToolDefinition**: Contrato que estipula `id`, `name`, `riskLevel`, `confirmationPolicy`, `idempotencyPolicy` e `requiredPermissions`.
- **ToolInvocationContext**: Estrutura que informa os detalhes do ator (`uid`), organização (`id`), `appAccess` e a possível evidência de confirmação do usuário.
- **DemoConfirmationEvidence**: Entidade injetada após interação do usuário demonstrando consentimento. Possui `policy`, `method`, `confirmedAt`, atrelando-se ao `requestId`.

## Respostas
- **DemoPolicyDecision**: Resultado da avaliação do DemoPolicySimulator: `allowed`, `denied` ou `needs_confirmation`.
- **ToolInvocationResult**: Objeto padronizado retornado pela invocação da ferramenta contendo status restrito (`success`, `denied`, `needs_confirmation`, `conflict` ou `failed`), dados opcionalmente tipados genéricos e um ID de auditoria.
- **AuditEvent**: Registro de auditoria cobrindo o ciclo de vida. Tipos incluem: `policy_denied`, `confirmation_pending`, `tool_execution`, `idempotency_reuse` ou `tool_failed`.

## Riscos e Políticas
- Níveis de Risco: `R0_PUBLIC`, `R1_AUTH_READ`, `R2_AUTH_WRITE_LOW`, `R3_AUTH_WRITE_HIGH`, `R4_CRITICAL`.
- Políticas de Confirmação: `none`, `simple` (aceita cliques simples), `explicit` (exige `explicit_click`), `strong`, `human_approval`.

## Idempotência
Controlada pela política da ferramenta (`none`, `recommended`, `required`). Baseada no uso de um `idempotencyKey` mapeado internamente para prevenir repetições não intencionais e originar eventos de `idempotency_reuse`.
