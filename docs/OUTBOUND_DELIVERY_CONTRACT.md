# Outbound Delivery Contract

## Objetivo

Definir a boundary server-side pela qual aplicativos do ecossistema, como o NestLocal, poderão pedir ao MillionsNest Connect a entrega de uma mensagem por um canal oficial.

Esta fatia **não envia mensagens** e não publica um endpoint novo. Ela congela o contrato de segurança, autoridade, custo e auditoria antes da integração com um provedor.

## Separação de responsabilidades

### Aplicativo de origem — exemplo: NestLocal

O aplicativo de origem continua sendo dono de:

- regra de negócio que determinou a comunicação;
- consentimento e sua evidência;
- categoria da mensagem;
- template aprovado escolhido;
- dados necessários para preencher o template;
- idempotency key de negócio.

### MillionsNest Connect

O Connect é dono de:

- validação da boundary server-side;
- tenant efetivo;
- capability para o canal;
- política de custo/provedor;
- normalização do destino;
- auditoria PII-minimized;
- adaptação futura para o provedor;
- processamento futuro de webhooks de entrega/falha.

O Connect não deve reimplementar as regras operacionais do NestLocal.

## Envelope

`OutboundDeliveryRequest` contém:

- `requestId`;
- `organizationId`;
- `sourceApp`;
- canal;
- categoria;
- destino;
- `templateName`;
- idioma;
- `consentEvidenceRef`;
- `idempotencyKey`;
- variáveis limitadas do template.

Categorias iniciais:

- `service_update`;
- `maintenance_reminder`.

Idiomas iniciais:

- `pt_BR`;
- `en_US`;
- `es`.

## Autoridade

`OutboundDeliveryAuthority` deve ser construído exclusivamente numa boundary autenticada server-side.

Uma requisição não pode:

- escolher outro tenant;
- declarar outro aplicativo de origem;
- inventar a capability `channels.whatsapp.send`.

Roles e capabilities enviadas pelo navegador nunca constituem autoridade.

## Consentimento

O Connect exige uma referência de evidência válida, mas não tenta recriar o consentimento de domínio.

Exemplo de referência produzida pelo NestLocal:

`nestlocal-consent:req_123:service_updates`

A futura boundary HTTP deverá resolver ou revalidar essa evidência antes do envio quando o contrato server-to-server definitivo for implementado.

## Templates

Entrega iniciada pelo negócio exige um nome de template explícito e previamente aprovado.

O contrato aceita somente nomes normalizados `[a-z0-9_]`.

Texto livre não substitui template aprovado neste fluxo.

## Idempotência

Toda entrega exige `idempotencyKey`.

A camada de provider futura deverá persistir a chave junto ao provider message ID para impedir duplicação em retries.

## Política de custo

A decisão passa obrigatoriamente por `evaluateZeroCostPolicy('meta.whatsapp')`.

No estado atual do Connect:

- `meta.whatsapp` é classificado como recurso pago;
- `billingAllowed=false`;
- a decisão é `PROVIDER_POLICY_BLOCKED`;
- nenhum custo é incorrido;
- nenhuma mensagem é enviada.

Ativar envio real exige uma decisão deliberada de produto/operação e não pode acontecer por efeito colateral de um deploy.

## Auditoria e PII

`buildOutboundDeliveryAuditRecord` não inclui:

- telefone completo;
- variáveis do template;
- corpo da mensagem;
- tokens/segredos.

O telefone é reduzido a `***1234`.

A auditoria preserva tenant, app de origem, categoria, template, evidência, idempotência e decisão.

## Próxima fase

A ativação real deve ser uma fatia separada:

1. publicar uma boundary autenticada do Connect;
2. resolver autoridade canônica via Hub;
3. persistir idempotência;
4. configurar provider/segredo somente server-side;
5. enviar somente requests `eligible`;
6. persistir provider message ID;
7. validar assinatura dos webhooks;
8. reconciliar sent/delivered/read/failed;
9. oferecer escalonamento humano;
10. manter opt-out e política do canal como gates obrigatórios.


## Boundary HTTP de validação

O Connect agora pode expor, quando o Hub está configurado:

`POST /api/core/outbound/validate`

Esta rota é **validation-only**.

Ela nunca chama Meta, WhatsApp Cloud API ou qualquer outro provider e sempre devolve:

`dispatch = not_implemented`

### Autoridade

A requisição precisa trazer um Firebase Bearer válido.

O Connect:

1. envia o `organizationId` solicitado ao endpoint canônico do Hub;
2. exige que o Hub resolva exatamente o mesmo tenant;
3. exige `appAccess.nestlocal = granted`;
4. constrói `OutboundDeliveryAuthority` server-side;
5. não aceita roles, capabilities ou acesso ao app declarados no body.

O protocolo do Hub trata ausência de `appAccess.nestlocal` como falta de acesso. A migração portanto é fail-closed.

### Tenant pinning

`HubSessionContextHttpProvider` passa o `requestedOrganizationId` como query para o próprio Hub.

O Hub revalida membership/global role e app access para esse tenant antes de o Connect aceitar o contexto.

Uma divergência entre tenant solicitado e tenant canônico é bloqueada.

### Flag de validação

A variável server-side:

`CONNECT_WHATSAPP_OUTBOUND_VALIDATION_ENABLED=true`

permite que a boundary construa a capability interna `channels.whatsapp.send` **somente para atravessar o gate de validação**.

Ela não:

- habilita dispatch;
- configura provider;
- cria secret;
- muda `billingAllowed`;
- altera a Zero Cost Policy.

Com a política atual, mesmo com essa flag ligada, `meta.whatsapp` termina em:

`PROVIDER_POLICY_BLOCKED`

e `financialCostBrl = 0`.

### Resposta

A resposta não ecoa:

- telefone completo;
- variáveis do template;
- Bearer;
- secrets.

Ela retorna somente a decisão, provider policy e uma projeção segura do envelope.

### Auditoria

O log `CONNECT_OUTBOUND_VALIDATION` usa `buildOutboundDeliveryAuditRecord`:

- telefone mascarado;
- ator mascarado;
- sem conteúdo/variáveis;
- tenant, source app, categoria, template, evidence ref e idempotency key preservados.

## O que ainda falta para dispatch real

Uma fase futura e separada deverá introduzir autoridade de serviço para execução assíncrona, porque um outbox não pode depender de manter o Firebase Bearer de um operador.

Antes de qualquer envio real ainda são necessários:

1. identidade server-to-server do aplicativo/worker;
2. revalidação do tenant e da evidência de consentimento no momento do dispatch;
3. persistência durável da idempotency key;
4. provider configurado somente server-side;
5. decisão deliberada sobre billing/custo;
6. provider message ID;
7. assinatura e reconciliação de webhooks;
8. retry policy;
9. opt-out;
10. escalonamento humano.

A boundary atual existe para provar segurança e contrato sem antecipar esses passos.
