# WhatsApp oficial — Runbook de ativação em produção

**Última revisão:** 2026-10-04  
**Objetivo:** concluir a única etapa que exige acesso humano às contas Meta/GitHub sem colocar credenciais em código, issue, chat ou commit.

## O que já está pronto do lado do Connect

O Connect já possui webhook oficial, validação de assinatura, registry de conexão, ingestão para Inbox, persistência durável, outbox de resposta humana, provider Meta e workflow fail-closed de ativação. O release normal deixa o provider desligado até este runbook ser concluído.

Callback de produção:

```text
https://connect.millionsnest.com/api/channels/whatsapp/webhook
```

O Verify Token é um segredo que você cria; ele **não vem da Meta**. Use um valor aleatório forte e armazene somente em GitHub Actions Secret e no campo correspondente do webhook da Meta.

## Valores necessários

| GitHub | Tipo | Origem |
|---|---|---|
| `CONNECT_WHATSAPP_PHONE_NUMBER_ID` | Variable | Meta for Developers → WhatsApp → API Setup / Configuração da API |
| `CONNECT_WHATSAPP_WABA_ID` | Variable | Meta for Developers → WhatsApp → API Setup / Configuração da API |
| `CONNECT_WHATSAPP_GRAPH_API_VERSION` | Variable | versão Graph atualmente selecionada/suportada no app Meta, no formato `vN.N` |
| `CONNECT_WHATSAPP_ORGANIZATION_ID` | Variable | Connect → Central do Desenvolvedor → organização real → “ID efetivo da organização” |
| `CONNECT_WHATSAPP_CONNECTION_REF` | Variable opcional | deixe ausente para usar `primary` |
| `CONNECT_WHATSAPP_APP_SECRET` | Secret | Meta for Developers → App Settings → Basic → App Secret |
| `CONNECT_WHATSAPP_ACCESS_TOKEN` | Secret | Meta Business Settings → System Users → token para o app/WABA |
| `CONNECT_WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Secret | valor aleatório forte criado pelo operador |

## Meta — preparação

1. Abra o app correto no **Meta for Developers** e confirme que o produto WhatsApp está adicionado.
2. Em **WhatsApp → API Setup / Configuração da API**, confirme o número que será usado em produção e copie **Phone Number ID** e **WhatsApp Business Account ID (WABA ID)**.
3. Em **App Settings → Basic**, revele e copie o **App Secret** somente quando for salvar como secret. Não cole em issue/chat/documentação.
4. Em **Meta Business Settings → Users → System Users**, use/crie um System User para produção.
5. Atribua ao System User o app e a conta WhatsApp/WABA necessários.
6. Gere um token do System User para o app com as permissões necessárias à Cloud API, incluindo `whatsapp_business_messaging` e `whatsapp_business_management`.
7. Crie um Verify Token forte e aleatório. O mesmo valor será usado no GitHub Secret e na configuração do webhook Meta.

## GitHub — cadastrar configuração

No repositório `prdanielcunha/millionsnest-connect`:

**Settings → Secrets and variables → Actions**

Na aba **Variables**, cadastre:
- `CONNECT_WHATSAPP_PHONE_NUMBER_ID`
- `CONNECT_WHATSAPP_WABA_ID`
- `CONNECT_WHATSAPP_GRAPH_API_VERSION`
- `CONNECT_WHATSAPP_ORGANIZATION_ID`

Na aba **Secrets**, cadastre:
- `CONNECT_WHATSAPP_APP_SECRET`
- `CONNECT_WHATSAPP_ACCESS_TOKEN`
- `CONNECT_WHATSAPP_WEBHOOK_VERIFY_TOKEN`

Não inclua aspas nos valores.

## Preflight sem ativação

Depois de cadastrar os 7 valores:

1. GitHub → **Actions**.
2. Abra **Connect WhatsApp Production Preflight**.
3. **Run workflow**.
4. Branch: **production**.
5. Execute.

Só avance quando aparecer `CONNECT_WHATSAPP_PRODUCTION_PREFLIGHT_OK`.

Esse preflight valida presença/formato, WIF, storage real, token Meta, WABA e se o Phone Number ID realmente pertence ao WABA. Ele **não** inscreve o app, não muda Cloud Run e não liga dispatch.

## Webhook Meta

No app Meta, configure o webhook do WhatsApp com:

- Callback URL: `https://connect.millionsnest.com/api/channels/whatsapp/webhook`
- Verify Token: exatamente o mesmo valor salvo em `CONNECT_WHATSAPP_WEBHOOK_VERIFY_TOKEN`

A ativação do Connect também executa o challenge real e valida webhook assinado. O workflow faz `subscribed_apps` do WABA durante a ativação; não é necessário executar esse POST manualmente.

## Ativação

1. GitHub → **Actions**.
2. Abra **Connect WhatsApp Production Activation**.
3. **Run workflow**.
4. Branch: **production**.
5. No campo `activation_ack`, digite exatamente:
   `CONNECT_WHATSAPP_PRODUCTION_READY`
6. Execute.

O workflow só altera o runtime depois de passar pelos gates. Após a alteração, valida webhook e storage; se falhar, retorna o tráfego para a revisão anterior.

## Prova end-to-end obrigatória

Depois do workflow verde:

1. De um telefone externo, envie uma mensagem real para o número oficial.
2. Abra Connect → Inbox e confirme que a conversa apareceu na organização correta.
3. Responda pela Inbox.
4. Confirme no WhatsApp do telefone externo que a resposta foi entregue.
5. Em Canais, confirme WhatsApp como ativo/receive/send ready.
6. Em Operações/Auditoria, confirme o evento sem vazamento indevido de PII.
7. Repita um teste negativo com usuário/organização sem permissão suficiente para confirmar isolamento tenant.

Somente depois dessa prova a Fase A deve ser marcada como concluída.

## Segurança

Nunca:
- cole App Secret ou Access Token em ChatGPT, issue, commit, documento ou screenshot;
- use token temporário para produção;
- desative o fail-closed para “fazer funcionar”;
- registre entrega apenas porque uma mensagem entrou na outbox;
- reutilize um número/WABA sem confirmar o binding da organização.
