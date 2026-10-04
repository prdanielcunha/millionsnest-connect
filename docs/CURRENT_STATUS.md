# MillionsNest Connect — Estado atual

**Atualizado em:** 2026-10-04  
**Fonte de verdade operacional:** código + GitHub Actions + Blueprint v4.

## Resumo executivo

O Connect **não está 100% concluído**. A base principal e várias superfícies reais já foram implantadas, mas o último grande gate da Fase A — **ativar o WhatsApp Business Platform oficial em produção e provar receive/reply real** — ainda depende de configuração externa da Meta/GitHub Actions.

A tentativa de ativação em produção de 2026-10-03 falhou **antes de alterar o Cloud Run**, exatamente como o desenho fail-closed exige. A revisão anterior permaneceu servindo, sem regressão provocada pela tentativa.

## Branches verificadas

- `main`: `2c021d3be607f79f8c26c8f7612e7f014907fd7c`
- `production`: `6e1def8d14006c2343691ecfc67af6d6ad0f78d5`
- `production` está à frente de `main` apenas pelos commits operacionais de promoção/release.

## O que já está implantado no código e certificado

| Área | Estado | Evidência principal |
|---|---|---|
| Home adaptativa por papel | Real | PR/commit #157 |
| Preview seguro para CEO/ecosystem owner | Real | #157 |
| Radar leader-first / abordagem por perfil | Real | #157 |
| Developer Center seguro / preview avançado | Real | #158 |
| Oportunidades, Playbooks e Composer | Real | #160 |
| Entrada Google nativa + troca de organização | Real | release após #160 |
| Canais live / readiness | Real | #162 |
| Fundação oficial WhatsApp | Implementada, gated | #162 |
| Control plane de Automações | Real | #163 |
| Operações, auditoria e saúde | Real | #165 |
| Inbox durável + ingestão tenant-safe | Real, provider gated | #166 |
| Inbox lista/timeline reais | Real | #167 |
| Boundary de resposta humana + outbox | Implementada, dispatch gated | #168 |
| Workflow de ativação WhatsApp com rollback | Implementado | #169 / #170 |

## Último gate: WhatsApp oficial em produção

Workflow: **Connect WhatsApp Production Activation**  
Run: `37136918765`  
Resultado: **failure no preflight** — sem mudança de runtime.

Configurações ausentes detectadas:

### GitHub Actions variables
- `CONNECT_WHATSAPP_PHONE_NUMBER_ID`
- `CONNECT_WHATSAPP_WABA_ID`
- `CONNECT_WHATSAPP_GRAPH_API_VERSION`
- `CONNECT_WHATSAPP_ORGANIZATION_ID`

### GitHub Actions secrets
- `CONNECT_WHATSAPP_APP_SECRET`
- `CONNECT_WHATSAPP_ACCESS_TOKEN`
- `CONNECT_WHATSAPP_WEBHOOK_VERIFY_TOKEN`

O `CONNECT_WHATSAPP_CONNECTION_REF` já possui fallback seguro `primary`.

## O que o workflow fará quando a configuração existir

1. valida intenção explícita de ativação;
2. confirma que todas as variáveis/segredos estão presentes;
3. autentica no GCP via WIF;
4. exige storage `read_write_confirmed`;
5. valida que o Phone Number ID pertence ao WABA;
6. inscreve o app no WABA via `subscribed_apps`;
7. cria o binding server-side `phoneNumberId -> organizationId`;
8. liga webhook, ingestão, resposta humana e provider dispatch;
9. executa smoke real do challenge do webhook;
10. executa smoke de assinatura `X-Hub-Signature-256`;
11. revalida storage;
12. em qualquer falha após a mudança, faz rollback de tráfego para a revisão anterior.

## Funcionalidades propositalmente ainda não tratadas como concluídas

- ativação real do WhatsApp oficial;
- prova end-to-end de mensagem externa recebida e resposta oficial entregue;
- Agentes com autonomia progressiva;
- Conhecimento contextual completo;
- Configurações/Preferências avançadas;
- expansão de adapters/canais adicionais conforme roadmap.

## Próximo passo obrigatório

**Não expandir o escopo antes de fechar o fluxo vertical real do WhatsApp.**

Assim que os quatro valores não secretos e os três segredos da Meta forem configurados, reexecutar o workflow com o acknowledgement `CONNECT_WHATSAPP_PRODUCTION_READY`, validar o receive/reply real e registrar a evidência de conclusão da Fase A.
