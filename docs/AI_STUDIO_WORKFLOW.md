# MillionsNest Connect - AI Studio Workflow Guidelines

## 1. Diretrizes de Desenvolvimento no Google AI Studio
- **Modo DEMO_MODE:** Mantenha o aplicativo com mocks locais totalmente isolados sem dependências externas pagas ou credenciais reais.
- **Porta do Servidor:** O servidor opera na porta 3000 (configuração padrão da infraestrutura do container Cloud Run).
- **Compilação e Linting:** Execute `tsc --noEmit` e `vite build` para garantir sanidade de compilação a cada alteração.
