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
