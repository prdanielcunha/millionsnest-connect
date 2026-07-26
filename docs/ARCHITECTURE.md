# MillionsNest Connect - Arquitetura do Sistema

## 1. Fluxo de Execução E2E
```
[ Canal (WhatsApp/Instagram/In-App) ]
                  │
                  ▼
         [ Webhook Gateway ]
                  │
                  ▼
          [ Event Intake ]
                  │
                  ▼
     [ Conversation Processor ]
                  │
                  ▼
          [ Policy Engine ] ◄── Validacao RBAC & Tenant Scoping
                  │
                  ▼
       [ Agent Orchestrator ]
                  │
                  ▼
          [ Tool Gateway ] ◄── Executa ferramentas autorizadas
                  │
                  ├───────────────────────┐
                  ▼                       ▼
       [ App Responsável ]        [ Trilha de Auditoria ]
     (MusicScale/NestFinance)         (Imutavel)
                  │
                  ▼
         [ Response Renderer ]
```

## 2. Componentes Principais
- **Webhook Gateway:** Recebe eventos dos canais e valida assinaturas de segurança.
- **Policy Engine:** Aplica regras de autorização verificando `organizationId` validado no servidor e capabilities globais (e.g. `livingLibrary.manage`).
- **Tool Gateway:** Barramento de execução de ferramentas com suporte a pre visualização, confirmação humana e níveis de risco (R0 a R4).
- **Audit Log:** Trilha imutável de eventos de auditoria registrando requestId, correlationId, ator e resultado.
