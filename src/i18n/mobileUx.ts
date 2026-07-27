import { LanguageCode } from '../types';

export type MobileUxTranslations = {
  navigation: {
    overview: string;
    inbox: string;
    tools: string;
    contacts: string;
    agents: string;
    knowledge: string;
    automations: string;
    channels: string;
    analytics: string;
    audit: string;
    settings: string;
  };
  header: {
    openMenu: string;
    closeMenu: string;
    openSearch: string;
    notificationsPlanned: string;
    activeOrganization: string;
    organizations: string;
    active: string;
    brandAuth: string;
  };
  drawer: {
    title: string;
    close: string;
    demoMode: string;
    noSystemRole: string;
    demoVersion: string;
  };
  demoBanner: {
    summary: string;
    details: string;
    hideDetails: string;
    description: string;
    noApiOrDatabase: string;
    noExternalIntegration: string;
    serverSideAuthorization: string;
    localMocks: string;
    simulatedRbac: string;
    simulatedToolGateway: string;
    activeLabel: string;
  };
  overview: {
    titlePrefix: string;
    subtitle: string;
    headerTag: string;
    openInbox: string;
    createAgent: string;
    reviewAudit: string;
    demoDataBadge: string;
    kpiOpenConversations: string;
    kpiWaiting: string;
    kpiAHT: string;
    kpiAiResolution: string;
    kpiPlannedChannels: string;
    needsAttention: string;
    viewAll: string;
    demoVolume: string;
    demoVolumeDesc: string;
    simulatedGateway: string;
    viewFullLog: string;
    channels: string;
    manageChannels: string;
    demoContact1: string;
    demoContact2: string;
    refundRequest: string;
    planQuestion: string;
    waitingApproval: string;
    agentEscalated: string;
    time12m: string;
    time28m: string;
    todayPlus12: string;
    requiresAttention: string;
    less30s: string;
    fullyAutonomous: string;
    noActiveIntegrations: string;
    simulatedSuccess: string;
    demoBlocked: string;
    pendingConfirmation: string;
    demoBlockedDetail: string;
    pendingDetail: string;
    officialWhatsApp: string;
    proInstagram: string;
    contextualChat: string;
    planned: string;
    toConfigure: string;
    coexistenceCloudApi: string;
    futureIntegration: string;
  };
};

export const translations: Record<LanguageCode, MobileUxTranslations> = {
  'pt-BR': {
    navigation: {
      overview: 'Visão Geral',
      inbox: 'Caixa de Entrada',
      tools: 'Tool Gateway',
      contacts: 'Contatos',
      agents: 'Agentes IA',
      knowledge: 'Conhecimento',
      automations: 'Automações',
      channels: 'Canais',
      analytics: 'Métricas',
      audit: 'Auditoria',
      settings: 'Configurações',
    },
    header: {
      openMenu: 'Abrir menu',
      closeMenu: 'Fechar menu',
      openSearch: 'Buscar páginas, ferramentas, contatos (Cmd+K)...',
      notificationsPlanned: 'Notificações planejadas',
      activeOrganization: 'Organização Ativa',
      organizations: 'Organizações (Simuladas)',
      active: 'Ativa',
      brandAuth: 'Contexto demonstrativo | Autoridade: MillionsNest',
    },
    drawer: {
      title: 'Menu principal',
      close: 'Fechar menu',
      demoMode: 'DEMO_MODE • Simulador Ativo',
      noSystemRole: 'Sem papel sistêmico',
      demoVersion: 'Versão demonstrativa',
    },
    demoBanner: {
      summary: 'DEMO_MODE • Dados simulados',
      details: 'Detalhes',
      hideDetails: 'Ocultar',
      description: 'Ambiente de simulação visual e arquitetônica. Dados isolados em memória. Nenhuma chave API, banco real ou integração externa conectada.',
      noApiOrDatabase: 'Nenhuma API ou banco real conectado.',
      noExternalIntegration: 'Nenhuma integração externa ativa.',
      serverSideAuthorization: 'Autorização real futura será server-side.',
      localMocks: 'Mocks Locais',
      simulatedRbac: 'RBAC Simulado',
      simulatedToolGateway: 'Tool Gateway simulado',
      activeLabel: 'DEMO_MODE ATIVO:',
    },
    overview: {
      titlePrefix: 'Olá, ',
      subtitle: 'Central inteligente de conversas, agentes de IA e ações no ecossistema MillionsNest.',
      headerTag: 'Visão Geral do Atendimento Omnichannel',
      openInbox: 'Abrir Caixa de Entrada',
      createAgent: 'Criar Agente',
      reviewAudit: 'Revisar Auditoria',
      demoDataBadge: 'Dados demonstrativos',
      kpiOpenConversations: 'Conversas Abertas',
      kpiWaiting: 'Aguardando',
      kpiAHT: 'TMA (Média)',
      kpiAiResolution: 'Resolução por IA',
      kpiPlannedChannels: 'Canais Planejados',
      needsAttention: 'Precisa da sua atenção',
      viewAll: 'Ver Todas',
      demoVolume: 'Volume demonstrativo de atendimento',
      demoVolumeDesc: 'Dados locais de demonstração. Não representam tráfego real.',
      simulatedGateway: 'Simulações recentes do Tool Gateway',
      viewFullLog: 'Ver log completo',
      channels: 'Canais de Atendimento',
      manageChannels: 'Gerenciar Canais',
      demoContact1: 'Contato Demo 01',
      demoContact2: 'Contato Demo 02',
      refundRequest: 'Solicitação de Reembolso',
      planQuestion: 'Dúvida sobre Planos',
      waitingApproval: 'Aguardando aprovação',
      agentEscalated: 'Escalado pelo Agente',
      time12m: 'Há 12 min',
      time28m: 'Há 28 min',
      todayPlus12: '+12% hoje',
      requiresAttention: 'Requer atenção',
      less30s: '-30s vs última semana',
      fullyAutonomous: 'Totalmente autônomo',
      noActiveIntegrations: '0 integrações reais ativas',
      simulatedSuccess: 'Sucesso simulado',
      demoBlocked: 'Bloqueio demonstrativo',
      pendingConfirmation: 'Confirmação pendente',
      demoBlockedDetail: 'Simulação bloqueada pela política demonstrativa. Nenhuma alteração externa foi executada.',
      pendingDetail: 'A confirmação exigida não foi concluída.',
      officialWhatsApp: 'WhatsApp oficial',
      proInstagram: 'Instagram profissional',
      contextualChat: 'Chat contextual',
      planned: 'PLANEJADO',
      toConfigure: 'A CONFIGURAR',
      coexistenceCloudApi: 'Coexistência oficial com Cloud API',
      futureIntegration: 'Integração futura com os aplicativos MillionsNest',
    },
  },
  'en-US': {
    navigation: {
      overview: 'Overview',
      inbox: 'Inbox',
      tools: 'Tool Gateway',
      contacts: 'Contacts',
      agents: 'AI Agents',
      knowledge: 'Knowledge',
      automations: 'Automations',
      channels: 'Channels',
      analytics: 'Analytics',
      audit: 'Audit',
      settings: 'Settings',
    },
    header: {
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      openSearch: 'Search pages, tools, contacts (Cmd+K)...',
      notificationsPlanned: 'Notifications planned',
      activeOrganization: 'Active Organization',
      organizations: 'Organizations (Simulated)',
      active: 'Active',
      brandAuth: 'Demo Context | Authority: MillionsNest',
    },
    drawer: {
      title: 'Main menu',
      close: 'Close menu',
      demoMode: 'DEMO_MODE • Active Simulator',
      noSystemRole: 'No system role',
      demoVersion: 'Demo version',
    },
    demoBanner: {
      summary: 'DEMO_MODE • Simulated data',
      details: 'Details',
      hideDetails: 'Hide',
      description: 'Visual and architectural simulation environment. Data isolated in memory. No API keys, real database, or external integration connected.',
      noApiOrDatabase: 'No API or real database connected.',
      noExternalIntegration: 'No external integration active.',
      serverSideAuthorization: 'Future real authorization will be server-side.',
      localMocks: 'Local Mocks',
      simulatedRbac: 'Simulated RBAC',
      simulatedToolGateway: 'Simulated Tool Gateway',
      activeLabel: 'DEMO_MODE ACTIVE:',
    },
    overview: {
      titlePrefix: 'Hello, ',
      subtitle: 'Intelligent hub for conversations, AI agents, and actions in the MillionsNest ecosystem.',
      headerTag: 'Omnichannel Service Overview',
      openInbox: 'Open Inbox',
      createAgent: 'Create Agent',
      reviewAudit: 'Review Audit',
      demoDataBadge: 'Demonstration data',
      kpiOpenConversations: 'Open Conversations',
      kpiWaiting: 'Waiting',
      kpiAHT: 'AHT (Average)',
      kpiAiResolution: 'AI Resolution',
      kpiPlannedChannels: 'Planned Channels',
      needsAttention: 'Needs your attention',
      viewAll: 'View All',
      demoVolume: 'Demonstrative service volume',
      demoVolumeDesc: 'Local demo data. Does not represent real traffic.',
      simulatedGateway: 'Recent Tool Gateway simulations',
      viewFullLog: 'View full log',
      channels: 'Service Channels',
      manageChannels: 'Manage Channels',
      demoContact1: 'Demo Contact 01',
      demoContact2: 'Demo Contact 02',
      refundRequest: 'Refund Request',
      planQuestion: 'Plan Question',
      waitingApproval: 'Waiting approval',
      agentEscalated: 'Escalated by Agent',
      time12m: '12 min ago',
      time28m: '28 min ago',
      todayPlus12: '+12% today',
      requiresAttention: 'Requires attention',
      less30s: '-30s vs last week',
      fullyAutonomous: 'Fully autonomous',
      noActiveIntegrations: '0 real active integrations',
      simulatedSuccess: 'Simulated success',
      demoBlocked: 'Demonstrative block',
      pendingConfirmation: 'Pending confirmation',
      demoBlockedDetail: 'Simulation blocked by demonstrative policy. No external changes executed.',
      pendingDetail: 'Required confirmation not completed.',
      officialWhatsApp: 'Official WhatsApp',
      proInstagram: 'Professional Instagram',
      contextualChat: 'Contextual Chat',
      planned: 'PLANNED',
      toConfigure: 'TO CONFIGURE',
      coexistenceCloudApi: 'Official coexistence with Cloud API',
      futureIntegration: 'Future integration with MillionsNest apps',
    },
  },
  'es-ES': {
    navigation: {
      overview: 'Visión General',
      inbox: 'Bandeja de Entrada',
      tools: 'Tool Gateway',
      contacts: 'Contactos',
      agents: 'Agentes IA',
      knowledge: 'Conocimiento',
      automations: 'Automatizaciones',
      channels: 'Canales',
      analytics: 'Analíticas',
      audit: 'Auditoría',
      settings: 'Ajustes',
    },
    header: {
      openMenu: 'Abrir menú',
      closeMenu: 'Cerrar menú',
      openSearch: 'Buscar páginas, herramientas, contactos (Cmd+K)...',
      notificationsPlanned: 'Notificaciones planeadas',
      activeOrganization: 'Organización Activa',
      organizations: 'Organizaciones (Simuladas)',
      active: 'Activa',
      brandAuth: 'Contexto demostrativo | Autoridad: MillionsNest',
    },
    drawer: {
      title: 'Menú principal',
      close: 'Cerrar menú',
      demoMode: 'DEMO_MODE • Simulador Activo',
      noSystemRole: 'Sin rol sistémico',
      demoVersion: 'Versión demostrativa',
    },
    demoBanner: {
      summary: 'DEMO_MODE • Datos simulados',
      details: 'Detalles',
      hideDetails: 'Ocultar',
      description: 'Entorno de simulación visual y arquitectónica. Datos aislados en memoria. Sin claves API, base de datos real o integración externa conectada.',
      noApiOrDatabase: 'Sin API o base de datos real conectada.',
      noExternalIntegration: 'Sin integración externa activa.',
      serverSideAuthorization: 'Autorización real futura será server-side.',
      localMocks: 'Mocks Locales',
      simulatedRbac: 'RBAC Simulado',
      simulatedToolGateway: 'Tool Gateway simulado',
      activeLabel: 'DEMO_MODE ACTIVO:',
    },
    overview: {
      titlePrefix: 'Hola, ',
      subtitle: 'Centro inteligente de conversaciones, agentes de IA y acciones en el ecosistema MillionsNest.',
      headerTag: 'Visión General de Atención Omnicanal',
      openInbox: 'Abrir Bandeja de Entrada',
      createAgent: 'Crear Agente',
      reviewAudit: 'Revisar Auditoría',
      demoDataBadge: 'Datos demostrativos',
      kpiOpenConversations: 'Conversaciones Abiertas',
      kpiWaiting: 'En espera',
      kpiAHT: 'TMO (Promedio)',
      kpiAiResolution: 'Resolución IA',
      kpiPlannedChannels: 'Canales Planeados',
      needsAttention: 'Necesita tu atención',
      viewAll: 'Ver Todas',
      demoVolume: 'Volumen demostrativo de atención',
      demoVolumeDesc: 'Datos locales de demostración. No representan tráfico real.',
      simulatedGateway: 'Simulaciones recientes de Tool Gateway',
      viewFullLog: 'Ver registro completo',
      channels: 'Canales de Atención',
      manageChannels: 'Gestionar Canales',
      demoContact1: 'Contacto Demo 01',
      demoContact2: 'Contacto Demo 02',
      refundRequest: 'Solicitud de Reembolso',
      planQuestion: 'Duda sobre Planes',
      waitingApproval: 'Esperando aprobación',
      agentEscalated: 'Escalado por Agente',
      time12m: 'Hace 12 min',
      time28m: 'Hace 28 min',
      todayPlus12: '+12% hoy',
      requiresAttention: 'Requiere atención',
      less30s: '-30s vs semana pasada',
      fullyAutonomous: 'Totalmente autónomo',
      noActiveIntegrations: '0 integraciones reales activas',
      simulatedSuccess: 'Éxito simulado',
      demoBlocked: 'Bloqueo demostrativo',
      pendingConfirmation: 'Confirmación pendiente',
      demoBlockedDetail: 'Simulación bloqueada por política demostrativa. No se ejecutó cambio externo.',
      pendingDetail: 'Confirmación requerida no completada.',
      officialWhatsApp: 'WhatsApp oficial',
      proInstagram: 'Instagram profesional',
      contextualChat: 'Chat contextual',
      planned: 'PLANEADO',
      toConfigure: 'A CONFIGURAR',
      coexistenceCloudApi: 'Coexistencia oficial con Cloud API',
      futureIntegration: 'Futura integración con apps MillionsNest',
    },
  },
};

export const getUxText = (lang: LanguageCode) => {
  return translations[lang] || translations['pt-BR'];
};
