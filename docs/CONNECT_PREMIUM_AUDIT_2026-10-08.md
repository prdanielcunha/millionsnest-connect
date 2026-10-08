# MillionsNest Connect — Auditoria de produto, engenharia e experiência premium
**Data:** 08/10/2026  
**Âmbito:** código da branch main consultado nesta data + Blueprint Mestre v4.0 + decisões de UX 05/10.  
**Natureza:** diagnóstico de código e plano de execução. Não é aprovação de produção nem teste de navegação real.

## 1. Decisão de produto preservada

Hub governa identidade, organizações, acessos, RBAC e billing. Apps governam seus domínios. Connect comunica, contextualiza, encaminha e orquestra por contratos e Tool Gateway.

Os módulos Core, Assist, Inbox, Automations, Channels, Radar, Comercial, Pessoas e Cofre Pessoal são partes de um Connect único; Radar não é sua home universal. O usuário comum pode aproveitar o produto pelo canal/in-app sem abrir um painel administrativo. A home e a navegação mudam por tarefa, capability e organização, sem conceder permissões extras.

O momento mágico continua sendo uma pergunta real no WhatsApp: «Qual é minha próxima escala?» -> vínculo autenticado com Hub -> organização válida -> MusicScale via ferramenta permitida -> resposta real no canal. Nenhum redesign pode adiar indefinidamente esta prova de produção.

## 2. Evidência observada, sem confundir código com produção

| Domínio | Evidência no repositório | Leitura honesta |
|---|---|---|
| Meta / Inbox oficial | docs/CURRENT_STATUS.md (05/10) registra entrada e resposta humana reais; handlers do Inbox presentes | Relato operacional documentado, não reteste de produção nesta auditoria |
| Magic Moment WhatsApp + MusicScale | docs/CURRENT_STATUS.md o mantém como gate de ativação; existe composição de Core/Tool Gateway | Não declarar completo até prova E2E com conta/organização real e identidade segura |
| Live Inbox | src/features/inbox/LiveInboxPage.tsx, liveInboxClient.ts e handler de consulta | Lista, histórico, envio humano, sugestão NestAI e inspector reais, mas UX e operação incompletas |
| Privacidade | Query handler omite senderRef/recipientRef/provider IDs do browser; Thread Domain usa ID opaco | Boa fronteira de dados; não “corrigir” exibindo telefone diretamente |
| UI Graphite | src/index.css e docs/CONNECT_GRAPHITE_ROLLOUT.md | Já existe um design system inicial; aperfeiçoar, não criar outro paralelo |
| Perfis | src/core/client/liveSurfacePolicy.ts e Shell.tsx | Visualização por perfil e filtros de navegação existem; a autoridade continua no servidor |
| Demonstração | App.tsx mantém superfícies DEMO isoladas do modo live | Necessário não misturar exemplos com dados reais |

## 3. Defeitos e lacunas identificados

### P0 — confiabilidade e integridade

- Envio na LiveInbox gerava novo requestId por tentativa. Em timeout com resultado desconhecido, o usuário podia tentar de novo com outra identidade de envio. Corrigido inicialmente na PR desta auditoria, mantendo o identificador para o mesmo texto/conversa/organização; o backend já possui registro idempotente. Exigir teste de timeout e retorno duplicado.
- Requisições assíncronas antigas de listagem podiam atualizar a interface após troca de contexto. A fatia atual cancela resultados obsoletos de leitura; ainda testar todas as rotas que fazem fetch ao trocar organização.
- Uma falha na atualização posterior ao envio não deveria aparecer como «falha ao enviar». Separar aceitação de envio, falha de refresh e status real de entrega.
- Não alterar provider secrets, webhooks, tool grants, permissões ou dados dos clientes em tarefa de UX.

### P1 — Inbox que um atendente realmente entende

- A lista exibe hash abreviado da conversa porque o contrato LiveInboxConversation não contém nome autorizado, resumo nem identidade operável. NÃO inferir nome por hash, número ou perfil religioso. Criar um read model/contato organizacional autorizado com display label opcional, canal, metadados mínimos e origem, separado do thread/event store PII-minimal.
- Busca atual filtra conversationId, status, mode e assignee ref, não nomes nem conteúdo. Projetar busca server-side autenticada, limitada a tenant/capability, com paginação, critérios de retenção e resultados evidenciáveis.
- Completar listagem por fila, pendência, atribuição e prioridade. Exibir estado e última interação em linguagem humana; sem expor IDs técnicos na superfície principal.
- A API de lista usa limite padrão 50, e de mensagens 100; paginação ou cursor/scroll incremental devem ser planejados antes de escala.
- Tratar nova mensagem sem forçar scroll se o operador lê histórico; incluir indicador «novas mensagens», posições de leitura e retorno natural.
- Melhorar empty/error/refresh states separados. Disponibilidade técnica pertence a Operação/Governança, não ao cabeçalho de Atendimento.

### P1 — fluxo de atendimento completo

- Verificar e concluir ações reais de atribuição, transferência IA↔humano, resolver/reabrir, aguardando pessoa/equipe, notas internas e histórico auditável. Existem estruturas de domínio de thread, mas não assumir paridade da UI com todos os comandos.
- Composer oficial deve apresentar estado claro (resposta, nota interna, rascunho); nenhuma nota pode sair pelo canal externo.
- Gatilhos de assistente e ferramentas são ações internas antes da comunicação; não desenhar consulta ao MusicScale como bolha enviada ao contato.
- Reenvio após falha deve reconciliar a operação idempotente; jamais criar um novo request ID automaticamente para o mesmo envio incerto.
- Histórico de entrega: «em processamento», «aceita pelo provedor», «entregue», «lida», «falhou» apenas quando o backend realmente fornecer o estado.

### P2 — Assist e agentes úteis

- Validar fluxo completo WhatsApp -> vínculo -> Hub -> Tool Gateway -> MusicScale -> canal, com casos de negativa, tenant alternativo e desambiguação.
- Ampliar leitura de repertório/cifras e confirmação de presença com direito de acesso, links profundos, consentimento e confirmação em mutações.
- NestJourney: tarefas/follow-up autorizados; NestFinance: consultas estritamente RBAC, sem vazamento de valores sensíveis.
- NestAI atua como melhoria opcional, não alicerce do Core. Aplicar quota/custos/feature flags, contexto mínimo e fallback seguro; não prometer três variantes de IA antes da execução ser comprovada.
- Para funções mais sofisticadas, fornecer evidência de ferramenta e motivo da sugestão; distinguir simulado, planejado e ativo.

### P2 — Comercial/Radar MusicScale

- Comercial -> MusicScale -> Radar é contexto do módulo, não definição de todo o Connect.
- Priorizar contato legítimo com quem administra a rotina do louvor quando essa função estiver explicitamente conhecida; pastor pode ser via de encaminhamento, sem assumir que todos os pastores decidem sobre escalas.
- O radar deve explicar «por que apareceu?» com fonte; sem ranking fantasioso, segmentação por crença nem promoção automática de participantes de grupos.
- Playbook: abertura -> diagnóstico -> permissão -> demonstração -> teste/ativação -> acompanhamento. Preço/plano/entitlement devem vir do Hub/produto vigente.
- Cofre Pessoal permanece privado por uid e distinto do relacionamento organizacional; promoção manual com mínimo necessário e base legítima.

### P2 — linguagem visual e interação

- Evoluir Graphite pela legibilidade, hierarquia, espaço negativo, navegação e contexto; evitar excesso de cards, miniaturas, badges técnicos e efeito glass em texto.
- Desktop: lista ~300 px + conversa com largura prioritária + inspector colapsável quando houver espaço. Tablet: master-detail. Mobile: lista -> conversa, contexto em sheet e composer fixo, sem hover obrigatório.
- Lista da Inbox merece tipografia operacional ~13–14 px e horários de 11–12 px, não labels de 8–10 px. A fatia atual inicia esse ajuste.
- Timeline deve agrupar por dia real em vez de mostrar «Hoje» acima de qualquer histórico; implementado na PR inicial.
- Acessibilidade: foco visível, retorno de foco no diálogo, navegação de teclado, nomes acessíveis, contraste medido, zoom, reduced motion, touch targets 44 px, safe areas e 320 px.
- PT-BR, EN e ES em todo texto novo; verificar traduções de mensagens humanas, não apenas títulos.

## 4. Ordem de implementação recomendada

| Marco | Entrega verificável | Condição para considerar pronto |
|---|---|---|
| 0 — Salvaguardas | Baseline do repo, branches de mudança, testes/CI, flags, contrato de retorno e rollback | Nenhum acesso alterado, sem deploy involuntário |
| 1 — Safety Inbox | requestId estável, proteção de resposta atrasada, datas reais, erro separado de refresh, legibilidade | Teste de timeout, troca de tenant, data, entrega |
| 2 — Identidade humana | Read model seguro de contato, nome/alias autorizados e origem; busca server-side | Nome correto, tenant isolado, sem vazamento de provider ID |
| 3 — Operação de ponta a ponta | Filas, responsável, status, notas, handoff, contexto, resolução, SLA condicional | Atendente fecha um caso real no desktop e celular |
| 4 — Magic Moment | WhatsApp oficial -> MusicScale via Hub/Tool Gateway -> resposta correta | Teste E2E real, negações corretas, duplicação zero |
| 5 — Produto adaptativo | Home por papel, Assist contextual, Comercial/Radar por produto, Meu Espaço isolado | Navegação por capability + visão CEO preview sem bypass |
| 6 — Polimento premium | Tokens/estados/componentes, transições e layouts em dispositivos, feedback de pessoas reais | QA 320/390/430/768/1024/1440, PT/EN/ES e a11y |
| 7 — Release gradual | Flag, telemetria mínima e rollback testado | Coorte homologada; nenhum cliente afetado por regressão |

Marcos 2–4 podem ser desenvolvidos em paralelo *apenas quando contratos, donos e tests de fronteira estiverem definidos*. O Magic Moment conserva prioridade de produto sobre Radar e relatórios.

## 5. Matriz de aceitação não negociável

1. Sem reescrever o Connect nem duplicar Hub, identidade, billing, permissões ou domínios dos apps.
2. Conservação de conversas reais e estados; nenhuma migração destrutiva de dados.
3. Quem manda uma resposta encontra feedback verdadeiro, sem disparar duplicado.
4. Busca e identificação não vazam dados de outro tenant.
5. Diferenciar mensagem enviada, entrega confirmada, nota interna e ação Assist pendente.
6. Data do histórico é a data da mensagem no locale do usuário.
7. Troca de organização invalida resultados e rascunhos antigos.
8. Sem canal DEMO fantasiado de canal ativo.
9. Navegação e componentes funcionam em mobile real; PT/EN/ES.
10. Comprovar o WhatsApp -> MusicScale e a transferência humana com dados/organizações autorizados.
11. Suite lint, testes de domínio/segurança, build, smoke do provider, revisão visual e rollout com rollback.
12. Preservar a marca oficial; variações visuais não podem sacrificar o funcionamento.

## 6. Trabalhos realizados nesta auditoria

Branch: fix/connect-inbox-safe-delivery-20261008  
PR draft: https://github.com/prdanielcunha/millionsnest-connect/pull/208

Arquivos alterados: LiveInboxPage.tsx, liveInboxPresentation.ts, liveInboxReplySafety.test.ts e package.json; documentação nesta pasta. Escopo intencionalmente limitado a uma fatia vertical real. O PR não autoriza merge nem deploy; seus gates continuam obrigatórios.

**Pendente de comprovação:** lint/build da aplicação completa, QA responsivo real, timeout do provider, revisão humana do visual, execução E2E do WhatsApp em homologação e ativação/observação em produção. Não declarar todas as capacidades completas porque há rotas e módulos em estágio controlado.
