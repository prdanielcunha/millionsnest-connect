# MillionsNest Connect — Release tracker para implantação integral
**Consolidação:** 08/10/2026  
**Referências:** `docs/CONNECT_PREMIUM_AUDIT_2026-10-08.md`, Blueprint Mestre v4, `docs/CURRENT_STATUS.md` e políticas de release existentes.

## Estado verificado via GitHub

- Branch `main` (desenvolvimento): `2f08932e30dcebba02bf4be08bce232ca8fd9df1`.
- PR #214: suite Connect Quality aprovada em https://github.com/prdanielcunha/millionsnest-connect/actions/runs/37863899762. HEAD de `main` após merge #214 está sob CI; verificar conclusão antes de release.
- Branch `production` ainda no commit `573d7d043ea2f3180a0edc20cd30cb70a85856b4` quando conferida. Portanto, **as novas features não estão publicadas aos clientes**.
- `main` aciona Connect Quality; release Cloud Run é ligado a `production`, e deploy Firebase Hosting requer acionamento manual em `production`.

## Mudanças implementadas e integradas à main

| PR | Entrega | Estado |
|---|---|---|
| #208 | Envio idempotente da Inbox, revisão humana de sugestões NestAI, timeline e legibilidade | Merge `main`; Quality passou |
| #209 | Transições reais de atendimento (assumir, aguardar, resolver, reabrir, arquivar); retry sem colisão temporal | Merge `main`; Quality passou |
| #210 | Read model PII separado com nome autodeclarado do WhatsApp, por tenant, expiração e gate de ativação | Merge `main`; Quality passou |
| #211 | Índice de prefixo, busca server-side autorizada de nomes, revalidação de threads, fallback local | Merge `main`; Quality passou |
| #212 | Listagem newest-first via Firestore runQuery, cursor org-bound e carregamento incremental | Merge `main`; Quality individual passou |
| #213 | Timeline newest-first com paginação por cursor org/thread, carregamento de mensagens anteriores | Merge `main`; Quality individual passou |
| #214 | Notas internas com API separada do WhatsApp, RBAC, TTL 30 dias e flag default-off | Merge `main`; Quality individual passou |

### Gating da identidade e busca

Estas duas features só são montadas se **ambas** as flags abaixo estiverem ativas:

- `CONNECT_INBOX_CONTACT_PROFILE_ENABLED=true`
- `CONNECT_INBOX_CONTACT_TTL_CONFIRMED=true`

Não ativar sem verificação real da política Firestore TTL no campo `expiresAt` da collection group `inboxContactProfiles`, IAM, auditoria de retenção e observabilidade/custo. Nenhum backfill foi executado.

## Próximos incrementos ainda não implementados

### A — Diretório autorizável e handoff

Criar no Hub um contrato read-only, autenticado e filtrado para operadores/equipes reais da organização. Implementar um seletor no Connect, validar alvo **no servidor** antes de `handoff` e não aceitar referências inventadas. QA em múltiplas organizações e papéis, no browser real.

### B — Notas internas e histórico completo

Notas internas já foram implementadas e mantidas **desligadas por padrão** na #214, com contrato `CONNECT_INBOX_PRIVATE_NOTES_CONTRACT_2026-10-08.md`. Precisa validar em homologação o TTL da collection group exclusiva `inboxOperatorNotes` (campo `expiresAt`) e as flags:
`CONNECT_INBOX_INTERNAL_NOTES_ENABLED=true` e `CONNECT_INBOX_INTERNAL_NOTES_TTL_CONFIRMED=true`.
Ainda falta integrar a nota, o handoff e as ações de IA em uma timeline colaborativa auditável, sem confundir notas internas com mensagens externas.

### C — Paginação e fila operacional

A paginação de **conversas** (#212) e **histórico de mensagens** (#213) já foi implementada. Validar ambas com datasets reais grandes, índices e cursors concorrentes no Firestore de homologação. Implementar filas por responsável, status, data e prioridade baseada em dados, sem IA fictícia. Adicionar indicadores de novas mensagens e preservação de posição do scroll. Buscar conteúdo somente com índice e política LGPD adequados.

### D — Magic Moment WhatsApp × Hub × MusicScale

Executar prova autenticada de extremo a extremo com conta e WhatsApp autorizados: vínculo seguro, organização ativa, consulta da próxima escala e resposta entregue. Repetir repertório/presença, testando troca de tenant, falhas temporárias, identidade expirada, idempotência, links profundos e fallback humano. **Não existe evidência nova nesta rodada de prova real; logo, o gate segue aberto.**

### E — Premium SaaS 2026/27 em todo o Connect

Executar QA visual e de interação em `320,390,430,768,1024,1440,1920` px; navegação, busca, Assist, Inbox, Radar MusicScale, Comercial, Pessoas, Agentes, Automações, Canais e Governança. Usar linguagem Graphite consolidada e perfis; nenhum mock aparece como dado real. PT/EN/ES, WCAG teclado/foco/contraste, touch target, scroll, feedbacks e estados vazios.

### F — Implantação controlada

Somente depois dos gates funcionais e visuais, obter baseline e backup para rollback, publicar por coorte/flag, confirmar Cloud Run+Firebase smoke do domínio, acompanhar telemetria sem PII e preservar todos os tenants/clientes. A branch `production` e os workflows de deploy são fronteiras distintas do merge na `main`.

## Definição de concluído

Não marcar Connect como «implantado integralmente» porque algumas superfícies continuam controladas e não houve QA visual real, prova completa de WhatsApp Assist nem liberação de produção das PRs #208–#214. O merge para desenvolvimento e testes automatizados são **marcos reais**, não sinônimos de publicação.

Estas etapas devem ser executadas com branches isoladas, testes de contrato/tenant, PR, CI e acompanhamento até o release seguro.
