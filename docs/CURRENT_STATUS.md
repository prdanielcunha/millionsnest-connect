# MillionsNest Connect — Estado atual

**Atualizado em:** 2026-10-05  
**Fonte de verdade operacional:** código + GitHub Actions + Blueprint v4.

## Resumo executivo

A fronteira oficial do WhatsApp já foi comprovada em produção com tráfego real: mensagem externa recebida, persistida na Inbox durável e resposta humana enviada pela Inbox e entregue de volta no WhatsApp.

O próximo gate da Fase A é o **Magic Moment do Assist pelo WhatsApp**: uma pessoa autenticada/vinculada pergunta por dados do MusicScale e o Connect resolve identidade, organização e permissões pelo Hub, consulta o MusicScale pela boundary oficial e responde no próprio WhatsApp.

A implementação desse gate agora usa vinculação explícita e segura. Telefone **não** é tratado como identidade MillionsNest. O canal recebe um identificador opaco, o usuário autentica sua conta, escolhe uma organização autorizada e Hub/MusicScale continuam revalidando autoridade a cada consulta.

## Evidência já comprovada em produção

| Área | Estado |
|---|---|
| Meta WhatsApp Business Platform oficial | Ativada e validada |
| Webhook assinado | Validado |
| Binding Phone Number ID → organização do canal | Validado |
| Inbox durável | Leitura/gravação confirmadas |
| WhatsApp → Connect Inbox | Comprovado com mensagem real |
| Connect Inbox → WhatsApp | Comprovado com resposta real |
| Preflight e Production Activation | Verdes |
| Assist in-app → MusicScale | Vertical real existente |
| WhatsApp → Assist → MusicScale | Em promoção/ativação final |

## Magic Moment — arquitetura de identidade

Fluxo:

```text
WhatsApp
  → Meta webhook oficial
  → persistência durável na Inbox
  → intent conhecido?
      não → permanece para atendimento humano
      sim → identidade de canal opaca
             → existe vínculo seguro?
                 não → envia link curto de vinculação
                        → login MillionsNest
                        → seleção de organização autorizada
                        → Hub cria grant opaco
                        → pedido original continua automaticamente
                 sim → Hub revalida grant + usuário + organização
                        → token de identidade de curta duração
                        → Connect Core
                        → Hub session-context
                        → MusicScale Tool Gateway
                        → resposta oficial no WhatsApp
```

Princípios preservados:
- telefone não prova identidade;
- grant não carrega RBAC/tenant como autoridade;
- Hub revalida membership/global access em cada sessão de canal;
- MusicScale revalida seu próprio domínio;
- segredo do grant fica criptografado no storage sensível do Connect;
- intents desconhecidos não recebem automação inventada;
- conteúdo de cifra continua usando resposta segura/deep link quando a superfície rica é a escolha correta;
- resposta automática possui idempotência durável.

## Correção de regressão de release

Foi identificado um risco operacional: um release normal do Connect Core podia sobrescrever variáveis do Cloud Run e religar provider gates como `false`, mesmo após uma ativação WhatsApp bem-sucedida.

A política de release foi corrigida para usar atualização parcial de ambiente e **preservar** as gates do provider já ativadas. A ativação do WhatsApp/Assist permanece responsabilidade do workflow fail-closed específico.

## Próxima sequência de produção

1. publicar e provar no Hub as boundaries `channel-grants` e `channel-session`;
2. promover o Connect com a ponte WhatsApp Assist e a correção de release;
3. executar novamente **Connect WhatsApp Production Activation**;
4. provar o primeiro uso:
   - enviar “Qual é minha próxima escala?” pelo WhatsApp;
   - concluir a vinculação da conta na primeira vez;
   - receber automaticamente a resposta real do MusicScale no WhatsApp;
5. repetir repertório/presença e validar fallback humano para intent desconhecido.

A Fase A só deve ser marcada como concluída depois dessa prova final.
