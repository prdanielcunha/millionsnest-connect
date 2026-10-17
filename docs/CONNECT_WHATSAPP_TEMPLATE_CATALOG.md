# WhatsApp — catálogo humanizado por aplicativo

Versão 2026-10-17.1. Fonte única: `config/whatsapp-template-catalog.v1.json`.

27 variantes, nove situações, PT-BR/en-US/espanhol. Payloads de criação de modelos, não comandos de envio. A publicação de código não significa aprovação Meta nem ativa mensagens. Os nomes e categorias precisam coincidir exatamente com o modelo aprovado; nenhuma substituição silenciosa por `hello_world`.

## Uso e privacidade

- Alertas `scale.published`, `scale.presence_pending` e `document.pending` são destinados ao operador previamente autorizado do outbox existente. Não transformam eventos de operador em disparos para membros/clientes.
- `followup.due` destina-se exclusivamente ao cuidador atualmente responsável. Revalidar consentimento, organização, igreja, responsável e solicitação ativa imediatamente antes de entregar; revogação cancela.
- Primeiro contato NestJourney exige pedido real e consentimento WhatsApp explícito vigente. Categoria MARKETING conservadora para acolhimento/reengajamento; classificação final pertence à Meta. Não é autorização para campanha. A flag de envio comercial continua OFF.
- Atualização de suporte exige solicitação real aberta pelo destinatário e autoridade na organização correta. Modelo de suporte não é aviso de escala, notificação financeira nem substituto de autenticação.
- Sem variáveis livres, nomes de pessoas/igrejas, valores, anexos financeiros, informações bancárias ou conteúdo pastoral. Botões estáticos abrem o app canônico, onde login e autorização continuam obrigatórios. Não abrem uma conversa específica nem concedem acesso.
- A conta de suporte MillionsNest e a organização do cliente são contextos distintos. Escolher um produto ou receber por WhatsApp nunca autoriza ler os dados de outra organização.
- Consentimento e opt-out continuam obrigatórios. Pedidos SAIR/STOP/SALIR devem bloquear novos envios no contrato de opt-out existente; o catálogo, isoladamente, não implementa essa persistência nem ativa a automação.
- Aprovação de modelo não dispensa consentimento, checagens de custo/janela, deduplicação durável, status de provider e tratamento de aceitação ambígua. Não há promessa de custo zero.

## Submissão protegida e idempotência

`meta-reviewed-template-catalog.yml` pode criar somente estes modelos revisados na conta fornecida pelo proprietário, após provar o SHA/imagem/identidade/flags atuais e a associação entre telefone e conta via GET. Usa somente o token Meta já configurado. Sem usuário/destinatário nos payloads, sem registro de telefone, webhook, envio, mudança de flags, IAM, assinatura, dado de cliente ou RBAC. A promoção deste workflow é uma ação de **criação de metadados de templates** autorizada pelo pedido explícito do proprietário nesta missão; não habilita entrega.

Antes da primeira criação, inventaria no máximo três páginas de 100 modelos na conta aprovada. Não segue `paging.next`; constrói o cursor no endpoint fixo. Mesmo nome/idioma/conteúdo/categoria em APPROVED/PENDING é reutilizado. Divergência, rejeição, duplicidade ou inventário incompleto bloqueiam antes de criar. Timeout/erro após POST interrompe, sem retry automático: reconciliar por GET antes de repetir. Jamais editar/excluir modelos existentes. Resultado `SUBMITTED_FOR_META_REVIEW` significa enviado à análise, não aprovado.

Prévia integral abaixo. Os três idiomas do mesmo nome são variantes separadas na Meta.

### mn_musicscale_scale_published_v1 — pt_BR

Produto: musicscale; evento: `scale.published`; destinatário: `operator`; categoria solicitada: **UTILITY**.

Olá! Há uma nova escala publicada no MusicScale. Abra o aplicativo para conferir os detalhes e acompanhar sua equipe. Se precisar de ajuda, responda por aqui.

Botão: **Abrir aplicativo** → https://musicscale.millionsnest.com/

### mn_musicscale_scale_published_v1 — en_US

Produto: musicscale; evento: `scale.published`; destinatário: `operator`; categoria solicitada: **UTILITY**.

Hi! A new schedule has been published in MusicScale. Open the app to check the details and follow up with your team. If you need help, reply here.

Botão: **Open app** → https://musicscale.millionsnest.com/

### mn_musicscale_scale_published_v1 — es

Produto: musicscale; evento: `scale.published`; destinatário: `operator`; categoria solicitada: **UTILITY**.

¡Hola! Hay una nueva programación publicada en MusicScale. Abre la aplicación para revisar los detalles y acompañar a tu equipo. Si necesitas ayuda, responde por aquí.

Botão: **Abrir aplicación** → https://musicscale.millionsnest.com/

### mn_musicscale_presence_pending_v1 — pt_BR

Produto: musicscale; evento: `scale.presence_pending`; destinatário: `operator`; categoria solicitada: **UTILITY**.

Olá! Há uma confirmação de presença pendente no MusicScale. Confira a escala no aplicativo antes de entrar em contato com a pessoa responsável. Estamos por aqui se precisar.

Botão: **Abrir aplicativo** → https://musicscale.millionsnest.com/

### mn_musicscale_presence_pending_v1 — en_US

Produto: musicscale; evento: `scale.presence_pending`; destinatário: `operator`; categoria solicitada: **UTILITY**.

Hi! An attendance confirmation is pending in MusicScale. Check the schedule in the app before contacting the person responsible. We are here if you need help.

Botão: **Open app** → https://musicscale.millionsnest.com/

### mn_musicscale_presence_pending_v1 — es

Produto: musicscale; evento: `scale.presence_pending`; destinatário: `operator`; categoria solicitada: **UTILITY**.

¡Hola! Hay una confirmación de asistencia pendiente en MusicScale. Revisa la programación en la aplicación antes de contactar a la persona responsable. Estamos aquí para ayudarte.

Botão: **Abrir aplicación** → https://musicscale.millionsnest.com/

### mn_nestfinance_document_pending_v1 — pt_BR

Produto: nestfinance; evento: `document.pending`; destinatário: `operator`; categoria solicitada: **UTILITY**.

Olá! Há uma revisão pendente no NestFinance. Abra sua área autorizada no aplicativo para conferir com segurança. Se precisar de ajuda com o sistema, responda aqui, sem enviar valores ou comprovantes.

Botão: **Abrir aplicativo** → https://nestfinance.millionsnest.com/

### mn_nestfinance_document_pending_v1 — en_US

Produto: nestfinance; evento: `document.pending`; destinatário: `operator`; categoria solicitada: **UTILITY**.

Hi! A review is pending in NestFinance. Open your authorized area in the app to check it securely. If you need help using the system, reply here without sending amounts or documents.

Botão: **Open app** → https://nestfinance.millionsnest.com/

### mn_nestfinance_document_pending_v1 — es

Produto: nestfinance; evento: `document.pending`; destinatário: `operator`; categoria solicitada: **UTILITY**.

¡Hola! Hay una revisión pendiente en NestFinance. Abre tu área autorizada en la aplicación para revisarla de forma segura. Si necesitas ayuda con el sistema, responde aquí sin enviar importes ni comprobantes.

Botão: **Abrir aplicación** → https://nestfinance.millionsnest.com/

### mn_nestjourney_followup_due_v1 — pt_BR

Produto: nestjourney; evento: `followup.due`; destinatário: `caregiver`; categoria solicitada: **UTILITY**.

Olá! Um contato sob sua responsabilidade está previsto no NestJourney. Confira no aplicativo se o pedido continua ativo e autorizado antes de prosseguir. Os detalhes ficam disponíveis apenas na sua área de acesso.

Botão: **Abrir aplicativo** → https://nestjourney.millionsnest.com/

### mn_nestjourney_followup_due_v1 — en_US

Produto: nestjourney; evento: `followup.due`; destinatário: `caregiver`; categoria solicitada: **UTILITY**.

Hi! A contact assigned to you is due in NestJourney. Check in the app that the request is still active and authorized before proceeding. Details are available only in your authorized area.

Botão: **Open app** → https://nestjourney.millionsnest.com/

### mn_nestjourney_followup_due_v1 — es

Produto: nestjourney; evento: `followup.due`; destinatário: `caregiver`; categoria solicitada: **UTILITY**.

¡Hola! Hay un contacto a tu cargo previsto en NestJourney. Comprueba en la aplicación que la solicitud siga activa y autorizada antes de continuar. Los detalles están disponibles solo en tu área de acceso.

Botão: **Abrir aplicación** → https://nestjourney.millionsnest.com/

### mn_nestjourney_requested_contact_v1 — pt_BR

Produto: nestjourney; evento: `requested_contact`; destinatário: `consented_person`; categoria solicitada: **MARKETING**.

Olá! Somos da equipe de acolhimento com quem você pediu para conversar. Podemos continuar seu atendimento por aqui? Responda quando for um bom momento para você. Se preferir não receber novos contatos, responda SAIR.

### mn_nestjourney_requested_contact_v1 — en_US

Produto: nestjourney; evento: `requested_contact`; destinatário: `consented_person`; categoria solicitada: **MARKETING**.

Hi! We are the welcome team you asked to speak with. May we continue your conversation here? Reply whenever it is a good time for you. If you prefer not to receive further contact, reply STOP.

### mn_nestjourney_requested_contact_v1 — es

Produto: nestjourney; evento: `requested_contact`; destinatário: `consented_person`; categoria solicitada: **MARKETING**.

¡Hola! Somos el equipo de acogida con el que pediste conversar. ¿Podemos continuar tu atención por aquí? Responde cuando sea un buen momento para ti. Si prefieres no recibir más contactos, responde SALIR.

### mn_musicscale_support_update_v1 — pt_BR

Produto: musicscale; evento: `support.request_updated`; destinatário: `support_requester`; categoria solicitada: **UTILITY**.

Olá! A equipe MillionsNest tem uma atualização sobre sua solicitação de ajuda com o MusicScale. Podemos continuar por aqui? Responda para retomar o atendimento.

Botão: **Abrir aplicativo** → https://musicscale.millionsnest.com/

### mn_musicscale_support_update_v1 — en_US

Produto: musicscale; evento: `support.request_updated`; destinatário: `support_requester`; categoria solicitada: **UTILITY**.

Hi! The MillionsNest team has an update on your MusicScale support request. May we continue here? Reply to resume your conversation.

Botão: **Open app** → https://musicscale.millionsnest.com/

### mn_musicscale_support_update_v1 — es

Produto: musicscale; evento: `support.request_updated`; destinatário: `support_requester`; categoria solicitada: **UTILITY**.

¡Hola! El equipo de MillionsNest tiene una actualización sobre tu solicitud de ayuda con MusicScale. ¿Podemos continuar por aquí? Responde para retomar la atención.

Botão: **Abrir aplicación** → https://musicscale.millionsnest.com/

### mn_nestfinance_support_update_v1 — pt_BR

Produto: nestfinance; evento: `support.request_updated`; destinatário: `support_requester`; categoria solicitada: **UTILITY**.

Olá! A equipe MillionsNest tem uma atualização sobre sua solicitação de ajuda com o NestFinance. Responda para continuarmos. Para proteger seus dados, não envie valores, comprovantes ou informações bancárias nesta conversa.

Botão: **Abrir aplicativo** → https://nestfinance.millionsnest.com/

### mn_nestfinance_support_update_v1 — en_US

Produto: nestfinance; evento: `support.request_updated`; destinatário: `support_requester`; categoria solicitada: **UTILITY**.

Hi! The MillionsNest team has an update on your NestFinance support request. Reply so we can continue. To protect your data, do not send amounts, documents or banking information in this conversation.

Botão: **Open app** → https://nestfinance.millionsnest.com/

### mn_nestfinance_support_update_v1 — es

Produto: nestfinance; evento: `support.request_updated`; destinatário: `support_requester`; categoria solicitada: **UTILITY**.

¡Hola! El equipo de MillionsNest tiene una actualización sobre tu solicitud de ayuda con NestFinance. Responde para continuar. Para proteger tus datos, no envíes importes, comprobantes ni información bancaria en esta conversación.

Botão: **Abrir aplicación** → https://nestfinance.millionsnest.com/

### mn_nestjourney_support_update_v1 — pt_BR

Produto: nestjourney; evento: `support.request_updated`; destinatário: `support_requester`; categoria solicitada: **UTILITY**.

Olá! A equipe MillionsNest tem uma atualização sobre sua solicitação de ajuda com o NestJourney. Responda para retomarmos. Os detalhes de pessoas e acompanhamentos devem permanecer na área protegida do aplicativo.

Botão: **Abrir aplicativo** → https://nestjourney.millionsnest.com/

### mn_nestjourney_support_update_v1 — en_US

Produto: nestjourney; evento: `support.request_updated`; destinatário: `support_requester`; categoria solicitada: **UTILITY**.

Hi! The MillionsNest team has an update on your NestJourney support request. Reply to resume. Details about people and follow-ups should remain in the protected area of the app.

Botão: **Open app** → https://nestjourney.millionsnest.com/

### mn_nestjourney_support_update_v1 — es

Produto: nestjourney; evento: `support.request_updated`; destinatário: `support_requester`; categoria solicitada: **UTILITY**.

¡Hola! El equipo de MillionsNest tiene una actualización sobre tu solicitud de ayuda con NestJourney. Responde para retomar la atención. Los detalles de personas y seguimientos deben permanecer en el área protegida de la aplicación.

Botão: **Abrir aplicación** → https://nestjourney.millionsnest.com/

### mn_hub_support_update_v1 — pt_BR

Produto: hub; evento: `support.request_updated`; destinatário: `support_requester`; categoria solicitada: **UTILITY**.

Olá! A equipe MillionsNest tem uma atualização sobre seu pedido de ajuda com acesso ou uso dos aplicativos. Responda para continuarmos o atendimento. Nunca precisamos da sua senha ou de códigos de verificação por WhatsApp.

Botão: **Abrir aplicativo** → https://www.millionsnest.com/

### mn_hub_support_update_v1 — en_US

Produto: hub; evento: `support.request_updated`; destinatário: `support_requester`; categoria solicitada: **UTILITY**.

Hi! The MillionsNest team has an update on your request for help accessing or using the apps. Reply so we can continue. We never need your password or verification codes over WhatsApp.

Botão: **Open app** → https://www.millionsnest.com/

### mn_hub_support_update_v1 — es

Produto: hub; evento: `support.request_updated`; destinatário: `support_requester`; categoria solicitada: **UTILITY**.

¡Hola! El equipo de MillionsNest tiene una actualización sobre tu solicitud de ayuda para acceder o usar las aplicaciones. Responde para continuar. Nunca necesitamos tu contraseña ni códigos de verificación por WhatsApp.

Botão: **Abrir aplicación** → https://www.millionsnest.com/
