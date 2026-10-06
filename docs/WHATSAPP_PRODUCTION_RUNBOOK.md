# WhatsApp oficial — Runbook de ativação em produção

**Última revisão:** 2026-10-05  
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

## Ativação do runtime

1. GitHub → **Actions**.
2. Abra **Connect WhatsApp Production Activation**.
3. **Run workflow**.
4. Branch: **production**.
5. No campo `activation_ack`, digite exatamente:
   `CONNECT_WHATSAPP_PRODUCTION_READY`
6. Execute.

O workflow valida WABA/número, faz `subscribed_apps`, instala as credenciais no runtime, habilita a boundary oficial e executa smoke do challenge/assinatura/storage. Se qualquer verificação falhar depois da alteração, retorna o tráfego para a revisão anterior.

**Importante:** o endpoint de verificação do webhook fica deliberadamente indisponível antes desta etapa. Portanto, não tente clicar em “Verify and save” na Meta antes de o workflow terminar verde.

## Webhook Meta — depois do workflow verde

No app Meta, configure o webhook do WhatsApp com:

- Callback URL: `https://connect.millionsnest.com/api/channels/whatsapp/webhook`
- Verify Token: exatamente o mesmo valor salvo em `CONNECT_WHATSAPP_WEBHOOK_VERIFY_TOKEN`

Clique para verificar/salvar. Depois, na assinatura de campos do webhook do WhatsApp, habilite pelo menos o campo de **messages** para a primeira vertical de produção. O `subscribed_apps` do WABA já é executado pelo workflow do Connect; não faça chamadas manuais à Graph API para repetir essa etapa.

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


## Magic Moment do Assist — ativação final

Depois de a Inbox oficial e a resposta humana terem sido comprovadas, a ativação final também liga `CONNECT_WHATSAPP_ASSIST_ENABLED=true`.

Antes de alterar o runtime, o workflow exige que o Hub publicado prove as novas boundaries de identidade de canal. Depois do deploy, também exige que o endpoint de confirmação de vínculo do Connect exista e permaneça protegido por autenticação.

Primeiro uso esperado para um número ainda não vinculado:

1. usuário envia uma intenção suportada, por exemplo **“Qual é minha próxima escala?”**;
2. Connect persiste a mensagem na Inbox antes de qualquer automação;
3. Connect responde com um link assinado e expirável em `https://connect.millionsnest.com/link/whatsapp`;
4. usuário autentica sua conta MillionsNest e escolhe uma organização à qual realmente possui acesso;
5. Hub revalida identidade + organização + membership/global access e cria o grant;
6. Connect armazena a credencial do grant criptografada;
7. o pedido original é retomado automaticamente;
8. Hub revalida novamente o grant e emite identidade de curta duração;
9. Connect Core e MusicScale executam suas validações normais;
10. resposta real volta pelo provider oficial.

Nos usos seguintes, enquanto o grant permanecer válido e autorizado, o usuário não precisa repetir a vinculação.

Se membership/acesso for revogado, o Hub bloqueia a próxima troca do grant. Se o intent não for suportado, a conversa continua disponível na Inbox para atendimento humano.

### Ordem de publicação

Não ativar Assist antes do Hub. A ordem canônica é:

1. Hub channel-grants/channel-session verde em produção;
2. Connect Core verde em produção;
3. Connect WhatsApp Production Activation verde;
4. smoke real pelo WhatsApp.

Um release normal do Core não deve mais desligar as gates já ativadas do WhatsApp; a política de release preserva as configurações de provider e deixa a mudança dessas gates para o workflow específico de ativação.
