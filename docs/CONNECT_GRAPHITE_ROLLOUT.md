# Connect Graphite — implantação controlada

Data: 2026-10-05  
Escopo: UX/UI, shell, navegação e composição visual do MillionsNest Connect.

## Regra de autoridade

- Hub continua autoridade para identidade, organizações, memberships, RBAC, app access e billing.
- MusicScale, NestJourney, NestFinance e demais apps continuam donos das próprias regras de negócio.
- Connect comunica e orquestra por contratos e ferramentas existentes.
- Nenhuma feature visual concede capability, altera tenant ou substitui validação server-side.
- Nenhum mock/fixture pode aparecer como integração real em ambiente live.

## Direção visual aplicada

A linguagem **Connect Graphite** usa um sistema único de tokens compartilhados:

- canvas: `#0B1018`
- surface: `#111A27`
- surfaceRaised: `#182433`
- petroleum: `#163442`
- textPrimary: `#F2F5FA`
- textSecondary: `#AAB8C9`
- accent: `#66D9EF`
- onAccent: `#08131B`
- border: `#2B3A4D`
- success: `#7CDEB3`
- warning: `#F1C77A`
- danger: `#FF9AA7`

Blur é reservado a sobreposições. Superfícies operacionais usam fundos sólidos, bordas discretas e densidade baixa a moderada. Movimento respeita `prefers-reduced-motion`.

## Superfícies migradas nesta fatia

| Área | Estado nesta branch | Observação |
|---|---|---|
| Shell desktop | Aplicado | Organização, busca, visão, idioma e navegação por grupos |
| Shell mobile | Aplicado | Header, drawer e bottom navigation |
| Seu dia | Aplicado | Pendências reais de Inbox/Radar/saúde operacional; sem métricas inventadas |
| Atendimento | Aplicado | Lista + conversa + contexto; composer apenas quando backend permite |
| Assist | Aplicado | Consulta real do ecossistema e resultados estruturados preservados |
| Pessoas | Aplicado | Fluxos existentes preservados; direção visual unificada |
| Radar | Aplicado | Evidência, próxima ação e importação continuam explícitas |
| Comercial | Aplicado | MusicScale como contexto; Oportunidades, Follow-ups, Playbooks e Composer |
| Canais | Aplicado | Readiness real e bloqueios continuam vindos do backend |
| Agentes | Destino aplicado / ativação controlada | Nenhum agente é simulado como ativo |
| Automações | Aplicado | Contratos/readiness reais; execução permanece bloqueada quando não disponível |
| Execuções | Planejado | Tab visível como indisponível; nenhuma execução é inventada |
| Meu espaço / Fontes | Aplicado | Escopo privado e importação incremental preservados |
| Governança / Auditoria | Aplicado | Diagnóstico técnico fica fora da Inbox |
| Central do desenvolvedor | Aplicado | Preview visual sem mudança de permissão |

## Cobertura de produto e limites

A migração visual não cria serviços de backend ausentes. Recursos cujo contrato real ainda não está disponível continuam:
1. identificados como planejados, controlados ou indisponíveis;
2. sem CTA que finja executar uma ação;
3. fora de estados de sucesso;
4. sem fallback silencioso para dados demo.

A lista de rotas visíveis continua filtrada pelo modelo de acesso que já existe. Esta branch não amplia permissões para cumprir um layout.

## Responsividade

- 320–767 px: uma tarefa por tela; lista → conversa; contexto em sheet; bottom navigation.
- 768–1199 px: master-detail quando útil; inspector sobreposto.
- 1200 px ou mais: sidebar e painéis; terceiro painel somente quando a conversa mantém largura útil.
- Inputs de mensagem usam 16 px no mobile.
- No Assist mobile, Enter quebra linha; envio usa botão explícito. No desktop, Enter envia e Shift+Enter quebra linha.
- Safe areas e `100dvh` continuam respeitados pelo shell.

## Gate desta PR

Antes de merge:

- [ ] lint
- [ ] testes
- [ ] build
- [ ] revisão visual desktop 1440/1920
- [ ] revisão tablet 768/1024
- [ ] revisão mobile 320/390/430
- [ ] PT-BR / EN / ES
- [ ] teclado e foco
- [ ] sem regressão de Hub/RBAC/multi-tenant
- [ ] sem mock aparecendo como integração real
- [ ] sem deploy automático como efeito desta PR

## Próximos gates do roadmap

Esta branch materializa a direção visual e as superfícies que já possuem destino seguro. Os gates funcionais do roadmap (paridade de mensagens, Tool Gateway, automações, importações, segurança, E2E e rollout gradual) continuam sendo critérios de liberação. A interface nova só deve chegar a produção por coorte/flag depois que a evidência correspondente estiver aprovada.
