# Architecture - Demo Mode

O Connect possui um simulador local (DemoPolicySimulator) focado em projetar os contratos antes da integração real.

- Diferença entre o DemoPolicySimulator e a Policy Engine real: O simulador executa controles client/local, nunca concedendo autorização em produção real. Todas as avaliações no DEMO_MODE têm status simulado e devem ser revalidadas no backend futuramente.
- Fluxo de Execução:
  UI/Canal -> ToolInvocationContext -> DemoPolicySimulator -> Controle de Confirmação -> Idempotência -> Execução Simulada -> Registro na Auditoria.
- AVISO: Nenhuma parte dessa infraestrutura frontend fornece autorização ou validação de escopo para ambiente de produção real.
