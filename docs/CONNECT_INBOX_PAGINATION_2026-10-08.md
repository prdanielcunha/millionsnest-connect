# Connect Inbox — paginação canônica de conversas (08/10/2026)

## Problema anterior

A implementação inicial de `FirestoreConnectThreadStore.listByOrganization` solicitava um `pageSize` arbitrário ao Firestore e **ordenava somente os documentos daquele lote** por `updatedAt` após a leitura. Portanto, as conversas mais recentes de uma organização com mais documentos poderiam não estar na primeira página. O limite de 50 não era paginação real.

## Implementado nesta fatia

- `ConnectThreadStore.listPageByOrganization` é um contrato opcional, compatível com adaptadores existentes.
- `FirestoreConnectThreadStore` usa `runQuery` restrito ao caminho `connectOrganizations/{organizationId}`, ordenado por `updatedAt DESC` e `__name__ DESC`.
- Usa `limit+1` para determinar existência de próxima página, retornando cursor opaco e versionado com timestamp, organização e ID canônico de conversa. Nenhum telefone ou corpo de mensagem entra no cursor.
- A validação do cursor falha com `INBOX_CURSOR_INVALID` para token malformado ou pertencente a outra organização.
- O wrapper de readiness continua a negar acesso quando o armazenamento não foi comprovado. Adaptadores legados sem paginação entregam apenas a primeira página e recusam um cursor, em vez de ignorá-lo silenciosamente.
- A API preserva `conversations[]` do contrato anterior e acrescenta `nextCursor`; nenhuma migração é necessária.
- A Inbox apresenta um botão de 44px **Carregar mais conversas** em PT-BR, inglês e espanhol; carrega páginas incrementalmente e cancela resultados obsoletos quando o usuário troca contexto/atualiza.
- Perfis de contato continuam opcionais e ligados somente aos IDs das conversas da página autorizada.

## Limitações explícitas

- Cursores ordenam eventos por atualização; uma conversa pode mudar de posição entre páginas se novas mensagens chegarem. A UI remove duplicatas por conversationId; não promete snapshot imutável entre consultas.
- Contatos antigos sem nome permanecem com rótulo neutro até receberem dados autorizados, caso a camada PII esteja ativada.
- Histórico de **mensagens** ainda é limitado pelo contrato atual; paginação dessa coleção será um incremento separado.
- Buscar por conteúdo de mensagens ainda exige índice separado, retenção e autorização; não está incluído aqui.
- A transição para esse método deve ser testada em Firestore com índices reais e muitos atendimentos antes do release.

## Gates

1. Lint e testes de cursor, ordem, isolamento multi-tenant, HTTP e adaptador legado.
2. Simular quantidade maior que 50/100 conversas e atualização simultânea no Firebase real de homologação.
3. QA visual desktop/mobile/teclado, estados loading/empty e PT/EN/ES.
4. Nenhuma publicação na branch production sem smoke/rollback e sem validar a execução real do Assist pelo WhatsApp.
