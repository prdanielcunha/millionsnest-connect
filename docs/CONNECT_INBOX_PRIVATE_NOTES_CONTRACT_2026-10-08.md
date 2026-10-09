# Connect Inbox — Notas internas
**Data:** 08/10/2026  
**Estado:** desenvolvimento; desativado por padrão; nenhuma migração em produção.

## Objetivo

Registrar observações da equipe dentro da conversa **sem jamais enviá-las por WhatsApp** e sem contaminar o event store canônico (que é PII-minimal). A API de mensagens ao cliente e a de notas internas são separadas.

## Implementação

- Persistência isolada: `connectSensitiveOrganizations/{organizationId}/inboxInternalNotes/{conversationId}/notes/{noteId}`.
- Nota contém autor `actorUid` resolvido **no servidor**, corpo de até 2000 caracteres, data do registro, referência de conversa e `expiresAt` (30 dias). Não contém número de WhatsApp, provider ID ou acesso externo.
- `noteId` é determinístico a partir de organização + conversa + ator + `requestId`; Firestore grava com precondition create-only e verifica colisão/retry. Alterar texto mantendo requestId falha.
- Rota `GET /api/core/inbox/threads/:conversationId/notes`: Hub `inbox.read` + thread existente; retorna só notas autorizadas.
- Rota `POST /api/core/inbox/threads/:conversationId/notes`: Hub `inbox.manage` + thread existente; ator nunca é recebido da interface.
- Sem integração com Meta, Outbound Delivery, sugestões do NestAI, automações ou eventos canônicos. É impossível usar esta rota para emitir mensagem ao contato.
- Interface no inspector de Atendimento, com cabeçalho e aviso persistentes «Notas internas — Visível apenas para a equipe. Nunca enviada ao cliente.»; botão «Salvar nota», editor independente de resposta externa, PT/EN/ES.
- Sinalização `internalNotesEnabled` no endpoint de readiness; toda ação real segue RBAC no servidor, e a UI só mostra o editor após sinal positivo.

## Ativação e política de retenção

As duas condições precisam estar explicitamente verdadeiras:

- `CONNECT_INBOX_INTERNAL_NOTES_ENABLED=true`
- `CONNECT_INBOX_INTERNAL_NOTES_TTL_CONFIRMED=true`

**A segunda flag NÃO deve ser ligada sem configurar e comprovar o Firestore TTL na collection group `notes`, campo `expiresAt`, além de revisar escopo e outros possíveis usos da collection group no projeto.** Como nomes de coleção `notes` podem colidir com módulos existentes, o recomendado antes da implantação é dar à coleção um ID globalmente único ou comprovar com auditoria que o TTL pretendido não afetará nenhuma coleção de terceiros. Se não for possível comprovar, manter desativado. Verificar também IAM, custos, LGPD e exclusão física.

A consulta omite notas expiradas imediatamente; exclusão física depende do TTL. Não há importação automática nem retroatividade.

## Critérios

1. Suites CI e build passam (incluindo RBAC, colisão, alteração de texto, tenant cruzado e nenhuma emissão WhatsApp).
2. Conferir Firestore TTL e autorização com equipe real em homologação.
3. QA visual mobile/tablet/desktop, teclado, foco e estado offline.
4. Provar que o botão salvar nota nunca chama `sendReply`, `outbound` ou Meta.
5. Habilitar por coorte somente após prontidão/backup/rollback, sem impacto em clientes.

**Pendente fora desta entrega:** handoff com diretório de atendentes validado pelo Hub, Magic Moment real MusicScale/WhatsApp, qualidade visual global e release em production.
