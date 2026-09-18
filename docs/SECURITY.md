# MillionsNest Connect - Security Guidelines

## Zero Trust Client e Limitações do Frontend
- **O frontend nunca é uma autoridade final** para permissões e acesso.
- No momento atua como simulação demonstrativa. O backend real deve ser fonte canônica para dados e acesso.

## Isolamento Multi-Tenant e Ausência de Bypass
- O ecossistema é compartimentado por organizações (isolamento multi-tenant). Acesso cross-tenant é estritamente negado.
- **Ausência de bypass**: Nenhum papel (`owner`, `support`, `ceo`, `founder`) ignora checagens de `appAccess`, `capabilities` e `requiredPermissions`. Todos estão sujeitos à governança global e local.

## App Access e Capabilities
- O acesso a aplicativos é gerido pelo `appAccess` efetivo da organização.
- Ferramentas exigem *capabilities* específicas (ex: `livingLibrary.manage`), as quais devem estar presentes no ecossistema e ser transferidas em cada invocação. A invocação não pode injetar novas capabilities que não existam na fonte canônica.

## Confirmação por Risco
- A confirmação nunca pode ser inferida pelo frontend no fluxo automático.
- Ferramentas R2 e R3 exigem uma evidência de confirmação (`DemoConfirmationEvidence`) com cliques simples ou explícitos (`simple_click`, `explicit_click`).
- Em `DEMO_MODE`, a evidência é vinculada ao intent confirmado (ator, request, ferramenta, organização, argumentos e chave de idempotência); ela não pode autorizar outro payload, outra chave ou outro ator, enquanto retries idênticos continuam compatíveis com a reutilização idempotente.

## Idempotência Demonstrativa
- No modo demonstração (DEMO_MODE), a idempotência é mantida baseada em representações ofuscadas da chave (`idempotencyKeyFingerprint`). Em produção, previne falhas de rede de executar transações repetidas sem vazar a chave original aos analistas.
- Chaves brutas nunca aparecem na auditoria.

## LGPD
- O ator é identificado de forma anonimizada e unificada pelo `uid`. E-mails ou detalhes PII (telefone) não devem constar nos logs base da auditoria para mitigar riscos de vazamento.
