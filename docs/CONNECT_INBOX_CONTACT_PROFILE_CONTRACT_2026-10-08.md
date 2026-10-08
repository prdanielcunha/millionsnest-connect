# Connect Inbox — identificação do contato (fatia P1)
**Data:** 08/10/2026  
**Status:** código em revisão; desativado por padrão; não é autorização de deploy.

## Problema

A Inbox real lista a projeção do evento canônico por `conversationId`. Esse ID é opaco para proteger a identidade do canal. Não deve ser transformado em nome e tampouco substituído por número de WhatsApp.

## Contrato implementado

1. Um webhook **verificado pela assinatura Meta** é normalizado e só recebe `senderDisplayName` quando `contacts[].wa_id` corresponde ao autor da mensagem.
2. O registro é associado à organização pela conexão oficial definida **no servidor** e à conversa derivada por hash. Nenhuma organização indicada pelo webhook ou pela interface é confiável.
3. O nome informado no perfil é uma **autodeclaração, não identidade verificada**. É saneado, limitado a 80 caracteres e rejeita telefones disfarçados. Nunca entra no stream canônico de eventos, mensagem persistida, Cofre Pessoal ou histórico de auditoria.
4. O read model reside em `connectSensitiveOrganizations/{organizationId}/inboxContactProfiles/{conversationId}`, distinto de `inboxThreads` e `inboxMessageContent`.
5. O endpoint de lista já exige identidade Hub e capacidade `inbox.read`. Só consulta perfis de IDs de conversas que o servidor acabou de autorizar para a organização ativa. Responde apenas com `contact: {displayName, source}`. Não retorna número, wa_id, provider message ID, senderRef, perfil completo ou dados do Cofre Pessoal.
6. No frontend a lista mostra o nome opcional com a indicação «Nome do perfil do WhatsApp». Sem dado válido, mostra «Pessoa sem identificação», sem atribuir nome falso; o código técnico permanece apenas como detalhe secundário de diferenciação.
7. Em falha da camada de nome, a mensagem continua chegando: identidade visual é **enriquecimento opcional**, não requisito de entrega ou de recebimento.

## Ativação e retenção

O sistema permanece DESATIVADO até haver, simultaneamente:

- `CONNECT_INBOX_CONTACT_PROFILE_ENABLED=true`
- `CONNECT_INBOX_CONTACT_TTL_CONFIRMED=true`

**A segunda flag somente pode ser aplicada depois de configurar e verificar uma política Firestore TTL na collection group `inboxContactProfiles`, campo timestamp `expiresAt`, e os requisitos legais/operacionais de retenção.** A aplicação calcula expiração em no máximo 90 dias e omite imediatamente registros expirados da leitura. A exclusão física é responsabilidade da política TTL, cuja existência não é deduzida apenas pela flag. Monitorar quantidade de expirações e exclusões, sem registrar nomes em logs.

A escrita pode gerar cobrança Firestore. Medir custo por conversa, especialmente com alto volume de inbound, antes da ativação. Os novos perfis surgem apenas a partir de eventos oficiais recebidos depois da ativação; não fazer backfill de mensagens ou leitura massiva para estimar nomes sem contrato e autorização específicos.

## Testes e gates

- Testes automatizados: normalização correta da pessoa, rejeição de telefones, escopo organizacional, expiração, ausência de nomes no thread stream, ausência de número no browser e origem confiável.
- Homologação: capturar webhook real com perfil, verificar permissões Hub e org isolada, simular timeout, nome ausente, colisão e alteração de nome.
- Segurança: revisar a IAM da service account, política de retenção, direito de exclusão e os eventuais índices sensíveis.
- UX: revisão responsiva de lista/contexto e acessibilidade PT-BR, EN, ES.
- Nenhuma liberação em produção antes das PRs #208 e #209 e sua QA serem aprovadas.

## Próximo incremento

Busca org-scoped com paginação/cursor server-side, transferência a equipe com catálogo de alvos autorizado, notas internas em store separado e prova do Magic Moment WhatsApp → Hub → MusicScale. Evitar promover contatos privados do Radar para a organização automaticamente.
