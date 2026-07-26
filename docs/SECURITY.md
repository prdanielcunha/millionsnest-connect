# MillionsNest Connect - Diretrizes de Segurança e Governança

## 1. Princípios de Segurança
- **Secrets Server-Only:** Chaves de API, tokens Meta/WhatsApp e segredos de webhook nunca são expostos no cliente.
- **Isolamento de Tenants:** Operações tenant-scoped exigem validação rigorosa de `organizationId` no servidor. Tentativas de acesso cross-tenant são bloqueadas imediatamente pelo Policy Engine.
- **Zero Trust Client:** Telefone e IDs de redes sociais são identificadores de canal, não provas de autorização.
- **Proteção da Biblioteca Viva:** Ferramentas de impacto global (R3/R4) exigem a capability `livingLibrary.manage`.
