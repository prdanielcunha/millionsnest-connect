# MillionsNest Connect — Release tracker para implantação integral
**Consolidação:** 08/10/2026  
**Referências:** `docs/CONNECT_PREMIUM_AUDIT_2026-10-08.md`, Blueprint Mestre v4, `docs/CURRENT_STATUS.md` e políticas de release existentes.

## Estado verificado via GitHub

- Branch `main` (desenvolvimento): `cedfef0f8f6db8c282c1dbb6987325955ba9d14e`.
- Connect Quality no HEAD de `main`: **success**, PR #212: workflow https://github.com/prdanielcunha/millionsnest-connect/actions/runs/37863014174. Executar novamente CI na main consolidada.
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

### Gating da identidade e busca

Estas duas features só são montadas se **ambas** as flags abaixo estiverem ativas:

- `CONNECT_INBOX_CONTACT_PROFILE_ENABLED=true`
- `CONNECT_INBOX_CONTACT_TTL_CONFIRMED=true`

Não ativar sem verificação real da política Firestore TTL no campo `expiresAt` da collection group `inboxContactProfiles`, IAM, auditoria de retenção e observabilidade/custo. Nenhum backfill foi executado.

## Próximos incrementos ainda não implementados

### A — Diretório autorizável e handoff

Criar no Hub um contrato read-only, autenticado e filtrado para operadores/equipes reais da organização. Implementar um seletor no Connect, validar alvo **no servidor** antes de `handoff` e não aceitar referências inventadas. QA em múltiplas organizações e papéis, no browser real.

### B — Notas internas e histórico completo

Definir modelo separado de mensagem enviada e evento canônico, autorização por organização, retenção, finalidade e auditoria. Nunca permitir que nota interna seja enviada ao provider ou usada automaticamente em IA sem política explícita. Projetar timeline unificada e estados claros (pessoa/equipe/IA).

### C — Paginação e fila operacional

A paginação de **conversas** já foi implementada na #212. Implementar agora paginação do **histórico de mensagens** (atualmente até 100/200) e testes com dataset grande. Filas por responsável, status, data e prioridade baseada em dados, sem IA fictícia. Adicionar indicadores de novas mensagens e preservação de posição do scroll. Buscar conteúdo somente com índice e política LGPD adequados.

### D — Magic Moment WhatsApp × Hub × MusicScale

Executar prova autenticada de extremo a extremo com conta e WhatsApp autorizados: vínculo seguro, organização ativa, consulta da próxima escala e resposta entregue. Repetir repertório/presença, testando troca de tenant, falhas temporárias, identidade expirada, idempotência, links profundos e fallback humano. **Não existe evidência nova nesta rodada de prova real; logo, o gate segue aberto.**

### E — Premium SaaS 2026/27 em todo o Connect

Executar QA visual e de interação em `320,390,430,768,1024,1440,1920` px; navegação, busca, Assist, Inbox, Radar MusicScale, Comercial, Pessoas, Agentes, Automações, Canais e Governança. Usar linguagem Graphite consolidada e perfis; nenhum mock aparece como dado real. PT/EN/ES, WCAG teclado/foco/contraste, touch target, scroll, feedbacks e estados vazios.

### F — Implantação controlada

Somente depois dos gates funcionais e visuais, obter baseline e backup para rollback, publicar por coorte/flag, confirmar Cloud Run+Firebase smoke do domínio, acompanhar telemetria sem PII e preservar todos os tenants/clientes. A branch `production` e os workflows de deploy são fronteiras distintas do merge na `main`.

## Definição de concluído

Não marcar Connect como «implantado integralmente» porque algumas superfícies continuam controladas e não houve QA visual real, prova completa de WhatsApp Assist nem liberação de produção das PRs #208–#212. O merge para desenvolvimento e testes automatizados são **marcos reais**, não sinônimos de publicação.

Estas etapas devem ser executadas com branches isoladas, testes de contrato/tenant, PR, CI e acompanhamento até o release seguro.
