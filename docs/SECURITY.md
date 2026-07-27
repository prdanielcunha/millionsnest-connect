# MillionsNest Connect - Security Guidelines

- Support não é administrador global; apenas executa ferramentas sob restrição explícita (tenant-scoped).
- O frontend nunca é uma autoridade final para permissões.
- Confirmação não pode ser inferida. Ferramentas R2+ exigem registro explícito `confirmedAt` no ToolInvocationContext antes da execução.
- Idempotência: no modo demonstração (DEMO_MODE), a idempotência é mantida em memória baseada em `idempotencyKey`. Em produção, requer armazenamento durável para evitar execuções repetidas.
- Minimização da auditoria: O ator é identificado primariamente pelo `uid`. E-mails ou detalhes de conexão não devem constar nos logs base da auditoria.
