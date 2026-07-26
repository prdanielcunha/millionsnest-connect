# MillionsNest Connect - Protocolo do Tool Gateway

## 1. Níveis de Risco Demonstrativos
- **R0_PUBLIC:** Leitura de informações públicas sem necessidade de autenticação (e.g. `searchLivingLibrary`).
- **R1_AUTH_READ:** Leitura de dados privados restrita a usuários autenticados da organização (e.g. `listSchedules`, `listMembers`).
- **R2_REVERSIBLE_WRITE:** Escrita reversível que exige confirmação prévia (e.g. `createScheduleDraft`, `addMember`).
- **R3_PRIVILEGED:** Ação sensível ou de escopo global (e.g. `addSongToLivingLibrary` com `livingLibrary.manage`).
- **R4_CRITICAL:** Ações críticas financeiras ou de exclusão de dados com confirmação forte.

## 2. Contrato de Invocação
Toda ferramenta deve obrigatoriamente definir:
- `appId`, `name`, `version`, `title`, `description`
- `inputSchema` e `outputSchema`
- `requiredPermissions` e `organizationScoped`
- `riskLevel` e `confirmationPolicy`
- `auditEventType`
