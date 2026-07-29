import { LanguageCode } from '../types';

export interface MenuUxStrings {
  pageTitle: string;
  pageDesc: string;
  demoMode: string;
  scenarioLegend: string;
  scenarioUnlinked: string;
  scenarioUnlinkedDesc: string;
  scenarioLinked: string;
  scenarioLinkedDesc: string;
  authNotice: string;
  triggersTitle: string;
  triggersDesc: string;
  inputLabel: string;
  inputPlaceholder: string;
  triggerBtn: string;
  tabConfigure: string;
  tabPreview: string;
  btnBack: string;
  channelLegend: string;
  channelWhatsapp: string;
  channelInstagram: string;
  channelInapp: string;
  channelNotConnected: string;
  localPreviewNote: string;
  publicOptionsHeader: string;
  protectedOptionsHeader: string;
  noMatchTitle: string;
  noMatchDesc: string;
  menuTitle: string;
  subtitleUnlinked: string;
  subtitleLinked: string;
  footerNote: string;
  selectedActionTitle: string;
  selectedActionPayload: string;
  noExternalAction: string;
  humanTransferTitle: string;
  humanTransferDesc: string;
  reasonUnlinked: string;
  reasonMembershipMissing: string;
  reasonMembershipInactive: string;
  reasonAppAccessMissing: string;
  reasonAppAccessDisabled: string;
  reasonToolMissing: string;
  reasonPermissionMissing: string;
  reasonContextIncomplete: string;
  projectionStatusTitle: string;
  projectionStatusAllowed: string;
  projectionStatusBlocked: string;
  optionDisabledLabel: string;
  worshipLeadTransferTitle: string;
  worshipLeadTransferDesc: string;
  triggerExamples: readonly string[];
  organizationLabel: string;
  channelSelectorLabel: string;
  appLabel: string;
  toolLabel: string;
  technicalIdLabel: string;
  notApplicable: string;
  localPreviewHeader: string;
  contractMissingReason: string;
  reasonGlobalPolicyUnavailable: string;
  actionNotExecuted: string;
  menuPreviewLabel: string;
}

export const menuUxCatalog: Record<LanguageCode, MenuUxStrings> = {
  'pt-BR': {
    triggerExamples: ['menu', 'ajuda', 'opções', 'começar', 'início', '0', '#'],
    organizationLabel: 'Organização',
    channelSelectorLabel: 'Seletor de Canal',
    appLabel: 'App',
    toolLabel: 'Ferramenta',
    technicalIdLabel: 'ID Técnico',
    notApplicable: 'N/A',
    localPreviewHeader: 'Prévia Local Simulada',
    contractMissingReason: 'Bloqueado: Contrato de opção protegida incompleto.',
    reasonGlobalPolicyUnavailable: 'Bloqueado: a política global canônica da Biblioteca Viva não está disponível nesta projeção local.',
    actionNotExecuted: 'Nenhuma ação foi executada',
    menuPreviewLabel: 'Prévia do Menu',
    scenarioLinked: 'Cenário de vínculo demonstrativo',
    scenarioLinkedDesc: 'Simula uma identidade relacionada a uma conta, sem autenticação ou autorização real.',
    authNotice: 'O vínculo apenas relaciona identidades. Esta projeção local considera membership, appAccess e permissions, mas a autorização final ocorre no backend.',
    subtitleLinked: 'Cenário vinculado demonstrativo. As opções abaixo dependem da projeção local do contexto.',
    pageTitle: 'Menu Conversacional Omnichannel',
    pageDesc: 'Configure e simule o comportamento do menu determinístico e a projeção de permissões no celular.',
    demoMode: 'MODO DE DEMONSTRAÇÃO (DEMO_MODE)',
    scenarioLegend: 'Cenário de Identidade',
    scenarioUnlinked: 'Visitante Não Vinculado',
    scenarioUnlinkedDesc: 'Simula contato desconhecido (apenas opções públicas disponíveis).',
    triggersTitle: 'Gatilhos Ativos',
    triggersDesc: 'Clique em um gatilho para preencher o simulador:',
    inputLabel: 'Mensagem do Usuário',
    inputPlaceholder: 'Digite "menu", "ajuda", "opções", "começar", "início", "0" ou "#"...',
    triggerBtn: 'Enviar',
    tabConfigure: 'Configurar',
    tabPreview: 'Visualizar',
    btnBack: 'Voltar',
    channelLegend: 'Canal de Preview',
    channelWhatsapp: 'WhatsApp',
    channelInstagram: 'Instagram',
    channelInapp: 'In-app (Connect)',
    channelNotConnected: 'Canal não conectado. Nenhuma chamada externa ou webhook ativo.',
    localPreviewNote: 'Esta é uma prévia local simulada baseada em dados locais.',
    publicOptionsHeader: '📌 Opções Públicas',
    protectedOptionsHeader: '🎵 Opções protegidas projetadas (MusicScale)',
    noMatchTitle: '⚠️ Nenhuma Opção Reconhecida',
    noMatchDesc: 'A entrada não corresponde a nenhum gatilho cadastrado. O menu completo não foi disparado.',
    menuTitle: '🤖 Menu MillionsNest Connect',
    subtitleUnlinked: 'Olá! Como podemos te ajudar hoje no ecossistema MillionsNest?',
    footerNote: 'Responda com o número ou digite "Menu" a qualquer momento.',
    selectedActionTitle: 'Ação Selecionada Localmente',
    selectedActionPayload: 'Payload técnico da ação:',
    noExternalAction: 'Nenhuma ação externa foi disparada por este simulador.',
    humanTransferTitle: 'Transferência para Atendente Humano',
    humanTransferDesc: 'Em produção, este comando pausará integralmente a automação de IA para este contato.',
    reasonUnlinked: 'Bloqueado: Exige o cenário de vínculo demonstrativo.',
    reasonMembershipMissing: 'Bloqueado: Usuário não possui membership na organização ativa.',
    reasonMembershipInactive: 'Bloqueado: A membership do usuário na organização ativa está inativa.',
    reasonAppAccessMissing: 'Bloqueado: Acesso ao aplicativo MusicScale não configurado.',
    reasonAppAccessDisabled: 'Bloqueado: Acesso desativado no plano ou faturamento da organização.',
    reasonToolMissing: 'Bloqueado: Ferramenta correspondente ausente no ecossistema local.',
    reasonPermissionMissing: 'Bloqueado: Permissão exata em falta na membership ou capabilities.',
    reasonContextIncomplete: 'Bloqueado: Contexto do usuário ou organização ativa ausente.',
    projectionStatusTitle: 'Análise de Projeção Visual',
    projectionStatusAllowed: 'Exibida e Disponível',
    projectionStatusBlocked: 'Omitida no Menu',
    optionDisabledLabel: 'Indisponível no momento',
    worshipLeadTransferTitle: 'Suporte do Louvor',
    worshipLeadTransferDesc: 'Simula transferência para a liderança direta do ministério local.',
  },
  'en-US': {
    triggerExamples: ['menu', 'help', 'options', 'start', '0', '#'],
    organizationLabel: 'Organization',
    channelSelectorLabel: 'Channel Selector',
    appLabel: 'App',
    toolLabel: 'Tool',
    technicalIdLabel: 'Technical ID',
    notApplicable: 'N/A',
    localPreviewHeader: 'Simulated Local Preview',
    contractMissingReason: 'Blocked: Protected option contract incomplete.',
    reasonGlobalPolicyUnavailable: 'Blocked: the canonical Living Library global policy is unavailable in this local projection.',
    actionNotExecuted: 'No action was executed',
    menuPreviewLabel: 'Menu Preview',
    scenarioLinked: 'Demonstrative linked scenario',
    scenarioLinkedDesc: 'Simulates an identity related to an account, without real authentication or authorization.',
    authNotice: 'Linking only relates identities. This local projection considers membership, appAccess and permissions, but final authorization occurs in the backend.',
    subtitleLinked: 'Demonstrative linked scenario. The options below depend on local context projection.',
    pageTitle: 'Omnichannel Conversational Menu',
    pageDesc: 'Configure and simulate deterministic menu behavior and permission projection on mobile.',
    demoMode: 'DEMONSTRATION MODE (DEMO_MODE)',
    scenarioLegend: 'Identity Scenario',
    scenarioUnlinked: 'Unlinked Visitor',
    scenarioUnlinkedDesc: 'Simulates unknown contact (only public options available).',
    triggersTitle: 'Active Triggers',
    triggersDesc: 'Click a trigger to fill the simulator:',
    inputLabel: 'User Message',
    inputPlaceholder: 'Type "menu", "help", "options", "start", "0" or "#"...',
    triggerBtn: 'Send',
    tabConfigure: 'Configure',
    tabPreview: 'Preview',
    btnBack: 'Back',
    channelLegend: 'Preview Channel',
    channelWhatsapp: 'WhatsApp',
    channelInstagram: 'Instagram',
    channelInapp: 'In-app (Connect)',
    channelNotConnected: 'Channel not connected. No external calls or active webhooks.',
    localPreviewNote: 'This is a simulated local preview based on local data.',
    publicOptionsHeader: '📌 Public Options',
    protectedOptionsHeader: '🎵 Projected protected options (MusicScale)',
    noMatchTitle: '⚠️ No Matching Trigger Recognized',
    noMatchDesc: 'Input does not match any registered trigger. The menu response was not triggered.',
    menuTitle: '🤖 MillionsNest Connect Menu',
    subtitleUnlinked: 'Hello! How can we help you today in the MillionsNest ecosystem?',
    footerNote: 'Reply with the option number or type "Menu" at any time.',
    selectedActionTitle: 'Action Selected Locally',
    selectedActionPayload: 'Technical action payload:',
    noExternalAction: 'No external action was triggered by this simulator.',
    humanTransferTitle: 'Transfer to Human Agent',
    humanTransferDesc: 'In production, this command will fully pause AI automation for this contact.',
    reasonUnlinked: 'Blocked: Requires linked projection scenario.',
    reasonMembershipMissing: 'Blocked: User has no membership in the active organization.',
    reasonMembershipInactive: 'Blocked: User membership in the active organization is inactive.',
    reasonAppAccessMissing: 'Blocked: Access to MusicScale app is not configured.',
    reasonAppAccessDisabled: 'Blocked: Access disabled in organization plan or billing.',
    reasonToolMissing: 'Blocked: Corresponding tool is missing in the local ecosystem.',
    reasonPermissionMissing: 'Blocked: Exact permission missing from membership or capabilities.',
    reasonContextIncomplete: 'Blocked: User context or active organization is missing.',
    projectionStatusTitle: 'Visual Projection Analysis',
    projectionStatusAllowed: 'Displayed and Available',
    projectionStatusBlocked: 'Hidden from Menu',
    optionDisabledLabel: 'Currently unavailable',
    worshipLeadTransferTitle: 'Worship Lead Support',
    worshipLeadTransferDesc: 'Simulates transfer to direct leadership of the local ministry.',
  },
  'es-ES': {
    triggerExamples: ['menu', 'ayuda', 'opciones', 'comenzar', 'inicio', '0', '#'],
    organizationLabel: 'Organización',
    channelSelectorLabel: 'Selector de Canal',
    appLabel: 'Aplicación',
    toolLabel: 'Herramienta',
    technicalIdLabel: 'ID Técnico',
    notApplicable: 'N/A',
    localPreviewHeader: 'Vista Previa Local Simulada',
    contractMissingReason: 'Bloqueado: Contrato de opción protegida incompleto.',
    reasonGlobalPolicyUnavailable: 'Bloqueado: la política global canónica de la Biblioteca Viva no está disponible en esta proyección local.',
    actionNotExecuted: 'No se ejecutó ninguna acción',
    menuPreviewLabel: 'Vista Previa del Menú',
    scenarioLinked: 'Escenario de vínculo demostrativo',
    scenarioLinkedDesc: 'Simula una identidad relacionada a una cuenta, sin autenticación o autorización real.',
    authNotice: 'El vínculo solo relaciona identidades. Esta proyección local considera membresía, appAccess y permisos, pero la autorización final ocurre en el backend.',
    subtitleLinked: 'Escenario vinculado demostrativo. Las opciones abajo dependen de la proyección del contexto local.',
    pageTitle: 'Menú Conversacional Omnicanal',
    pageDesc: 'Configure y simule el comportamiento del menú determinista y la proyección de permisos en el móvil.',
    demoMode: 'MODO DE DEMOSTRACIÓN (DEMO_MODE)',
    scenarioLegend: 'Escenario de Identidad',
    scenarioUnlinked: 'Visitante No Vinculado',
    scenarioUnlinkedDesc: 'Simula contacto desconocido (solo opciones públicas disponibles).',
    triggersTitle: 'Gatillos Activos',
    triggersDesc: 'Haga clic en un gatillo para completar el simulador:',
    inputLabel: 'Mensaje del Usuario',
    inputPlaceholder: 'Escriba "menu", "ayuda", "opciones", "comenzar", "inicio", "0" o "#"...',
    triggerBtn: 'Enviar',
    tabConfigure: 'Configurar',
    tabPreview: 'Visualizar',
    btnBack: 'Volver',
    channelLegend: 'Canal de Vista Previa',
    channelWhatsapp: 'WhatsApp',
    channelInstagram: 'Instagram',
    channelInapp: 'In-app (Connect)',
    channelNotConnected: 'Canal no conectado. Sin llamadas externas ni webhooks activos.',
    localPreviewNote: 'Esta es una vista previa local simulada basada en datos locales.',
    publicOptionsHeader: '📌 Opciones Públicas',
    protectedOptionsHeader: '🎵 Opciones protegidas proyectadas (MusicScale)',
    noMatchTitle: '⚠️ Ningún Gatillo Reconocido',
    noMatchDesc: 'La entrada no coincide con ningún gatillo registrado. El menú completo no se activó.',
    menuTitle: '🤖 Menú MillionsNest Connect',
    subtitleUnlinked: '¡Hola! ¿Cómo podemos ayudarte hoy en el ecosistema MillionsNest?',
    footerNote: 'Responda con el número o escriba "Menú" en cualquier momento.',
    selectedActionTitle: 'Acción Seleccionada Localmente',
    selectedActionPayload: 'Datos técnicos de la acción:',
    noExternalAction: 'Este simulador no ha activado ninguna acción externa.',
    humanTransferTitle: 'Transferencia a Agente Humano',
    humanTransferDesc: 'En producción, este comando pausará por completo la automatización de IA para este contacto.',
    reasonUnlinked: 'Bloqueado: Requiere el escenario de proyección vinculada.',
    reasonMembershipMissing: 'Bloqueado: El usuario no tiene membresía en la organización activa.',
    reasonMembershipInactive: 'Bloqueado: La membresía del usuario en la organización activa está inactiva.',
    reasonAppAccessMissing: 'Bloqueado: El acceso a la aplicación MusicScale no está configurado.',
    reasonAppAccessDisabled: 'Bloqueado: Acceso desactivado en el plan o facturación de la organización.',
    reasonToolMissing: 'Bloqueado: Falta la herramienta correspondiente en el ecosistema local.',
    reasonPermissionMissing: 'Bloqueado: Falta el permiso exacto en la membresía o capacidades.',
    reasonContextIncomplete: 'Bloqueado: Falta el contexto del usuario o la organización activa.',
    projectionStatusTitle: 'Análisis de Proyección Visual',
    projectionStatusAllowed: 'Mostrada y Disponible',
    projectionStatusBlocked: 'Omitida en el Menú',
    optionDisabledLabel: 'No disponible actualmente',
    worshipLeadTransferTitle: 'Soporte Específico',
    worshipLeadTransferDesc: 'Simula la transferencia al liderazgo directo del ministerio local.',
  },
};
