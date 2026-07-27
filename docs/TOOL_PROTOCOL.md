# Tool Protocol

O Tool Protocol estabelece a definição formal das ferramentas integradas e da comunicação com o Tool Gateway.

- **ToolDefinition**: Contrato que estipula o nome, capacidades exigidas e comportamento de confirmação.
- **ToolInvocationContext**: Objeto passado pelo chamador que informa os detalhes do ator (uid), canal, organização e estado da confirmação.
- **DemoPolicyDecision**: O objeto resultante da avaliação do simulador de política. Pode ser `allowed`, `denied` ou `needs_confirmation`.
- **ToolInvocationResult**: Objeto padronizado de retorno da ferramenta invocada. Pode conter `status: 'success' | 'denied' | 'needs_confirmation' | 'conflict' | 'failed'`.
- **Confirmação por Risco**: R0 (none), R1 (none), R2 (simple), R3 (explicit/strong/human_approval), R4 (strong/human_approval).
- **Idempotência**: Controlada pela chave `idempotencyKey` no momento da requisição para prevenir replays de chamadas em R2+.
