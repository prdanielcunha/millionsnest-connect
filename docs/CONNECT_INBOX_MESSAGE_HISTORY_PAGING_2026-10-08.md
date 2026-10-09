# MillionsNest Connect — Histórico completo da Inbox

**Status:** incremento de desenvolvimento, exige CI e homologação real antes de produção.  
**Data:** 2026-10-08.

## Problema

A lista de mensagens antiga solicitava uma coleção do Firestore com `pageSize=100` e só ordenava o lote retornado na memória. Em conversas longas isso não garante que as últimas 100 mensagens serão mostradas; o atendente também não tinha como recuperar os registros anteriores.

## Solução construída

- Contrato opcional `listHistoryPage` no `ConnectMessageContentStore` para não quebrar os adaptadores existentes.
- Consulta `runQuery` restrita ao caminho sensível `connectSensitiveOrganizations/{org}/inboxMessageContent/{conversation}/messages`, ordenada por `occurredAt DESC` e `__name__ DESC`. O backend reordena os itens recebidos cronologicamente para exibição.
- Token de cursor versionado vinculado à organização, conversa, timestamp e ID opaco da mensagem; limite máximo de 200 por consulta, page size real `limit+1` para detectar próxima página.
- A API exige token Hub e permissão de leitura da Inbox, confirma a existência da thread e minimiza a resposta: **sem senderRef/recipientRef/providerMessageId**. Retorna `olderCursor` opcional e mantém `messages[]`.
- A UI utiliza `listMessagesPage`, botão `Ver mensagens anteriores` de pelo menos 44px, estado de loading, deduplicação e proteção contra resultados obsoletos ao mudar de organização ou conversa.
- O refresh após resposta humana mantém o envio idempotente e atualiza o conjunto recente de mensagens.
- Homologar com mais de 500 mensagens, timestamps iguais, eventos concorrentes e mensagens falhadas para conferir ordenação, entrega e UI.

## Observações

- Cursor não é credencial: sempre revalidar Hub/tenant/thread no servidor.
- Nenhuma migração nem remoção de mensagens armazenadas foi feita.
- É necessário verificar o índice real do Firestore na homologação; os testes automáticos usam adaptador de rede simulado.
- O contrato antigo `listConversation` permanece compatível e agora usa a primeira página em ordem correta no adaptador Firestore.
- Dados de conversa podem estar sujeitos a políticas próprias de retenção; este incremento não altera tais políticas nem ativa armazenamento adicional de PII.

## Critérios para liberar

1. CI: lint, Core, provider Meta, tenant, Inbox, build e testes de paginação passam.
2. Teste humano mobile/desktop com scroll, datas e respostas na tela real.
3. Contas com e sem autorização, troca de organização, cursor da conversa A aplicado em B deve falhar.
4. Meta/Hub/MusicScale end-to-end comprovado independentemente.
5. Gate de release `production` com rollback e observabilidade; nunca interpretar merge em `main` como produção.

O diretório de atendentes, transferência de equipe, notas internas, automações e QA visual global permanecem separadamente pendentes.
