/**
 * MillionsNest Connect - Internationalization (i18n) Engine
 * Language Catalog: PT-BR (default & full), EN-US, ES-ES
 */

import { LanguageCode } from '../types';

export const dictionaries = {
  'pt-BR': {
    appName: 'MillionsNest Connect',
    demoBadge: 'MODO DEMONSTRAÇÃO (DEMO_MODE)',
    tagline: 'Conecte conversas, equipes e ações em todo o ecossistema MillionsNest.',
    nav: {
      overview: 'Visão Geral',
      inbox: 'Caixa de Entrada',
      contacts: 'Contatos',
      agents: 'Agentes',
      knowledge: 'Conhecimento',
      automations: 'Automações',
      appsTools: 'Apps & Ferramentas',
      channels: 'Canais',
      analytics: 'Analytics',
      audit: 'Auditoria',
      settings: 'Configurações',
      docs: 'Documentação Técnica',
    },
    common: {
      search: 'Buscar...',
      filter: 'Filtrar',
      export: 'Exportar',
      refresh: 'Atualizar',
      active: 'Ativo',
      paused: 'Pausado',
      draft: 'Rascunho',
      status: 'Status',
      actions: 'Ações',
      close: 'Fechar',
      save: 'Salvar',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      details: 'Detalhes',
      organization: 'Organização',
      risk: 'Risco',
      version: 'Versão',
      updatedAt: 'Atualizado em',
      language: 'Idioma',
      warning: 'Aviso',
      success: 'Sucesso',
      denied: 'Negado',
      required: 'Obrigatório',
      loading: 'Carregando...',
      noData: 'Nenhum dado encontrado',
      demoNotice: 'Esta interface está operando em DEMO_MODE com dados de simulação locais. Nenhuma API real ou banco externo foi conectado.',
    },
    inbox: {
      all: 'Todas',
      mine: 'Minhas',
      unassigned: 'Não Atribuídas',
      waitingHuman: 'Aguardando Humano',
      automationActive: 'Automação Ativa',
      resolved: 'Resolvidas',
      mode: 'Modo de Atendimento',
      automatic: 'Automático',
      withApproval: 'Com Aprovação',
      human: 'Humano (Pausa Automação)',
      internalNote: 'Nota Interna',
      sendMessage: 'Enviar mensagem...',
      send: 'Enviar',
      contactContext: 'Contexto do Contato',
      millionsnestIdentity: 'Identidade MillionsNest',
      linked: 'Vinculado',
      notLinked: 'Não Vinculado',
      pending: 'Pendente',
      revoked: 'Revogado',
      sentimentNotice: 'Sinal de sentimento é um auxiliar estatístico e não representa prova factual nem autoridade de decisão.',
      executedTools: 'Histórico de Ferramentas Executadas',
    },
    tools: {
      livingLibraryManageWarning: 'A ferramenta "addSongToLivingLibrary" é de nível global R3/R4 e exige obrigatoriamente a capability "livingLibrary.manage". Administradores de organização local não possuem esse privilégio por padrão.',
      toolGatewayNotice: 'Toda execução passa pelo Tool Gateway com validação de token, RBAC, tenant-scoping e auditoria imutável.',
    },
  },
  'en-US': {
    appName: 'MillionsNest Connect',
    demoBadge: 'DEMO MODE (DEMO_MODE)',
    tagline: 'Connect conversations, teams, and actions across the MillionsNest ecosystem.',
    nav: {
      overview: 'Overview',
      inbox: 'Inbox',
      contacts: 'Contacts',
      agents: 'Agents',
      knowledge: 'Knowledge',
      automations: 'Automations',
      appsTools: 'Apps & Tools',
      channels: 'Channels',
      analytics: 'Analytics',
      audit: 'Audit Log',
      settings: 'Settings',
      docs: 'Technical Docs',
    },
    common: {
      search: 'Search...',
      filter: 'Filter',
      export: 'Export',
      refresh: 'Refresh',
      active: 'Active',
      paused: 'Paused',
      draft: 'Draft',
      status: 'Status',
      actions: 'Actions',
      close: 'Close',
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
      details: 'Details',
      organization: 'Organization',
      risk: 'Risk',
      version: 'Version',
      updatedAt: 'Updated at',
      language: 'Language',
      warning: 'Warning',
      success: 'Success',
      denied: 'Denied',
      required: 'Required',
      loading: 'Loading...',
      noData: 'No data found',
      demoNotice: 'This interface runs in DEMO_MODE with local simulated data. No real external APIs or databases connected.',
    },
    inbox: {
      all: 'All',
      mine: 'Mine',
      unassigned: 'Unassigned',
      waitingHuman: 'Waiting Human',
      automationActive: 'Automation Active',
      resolved: 'Resolved',
      mode: 'Service Mode',
      automatic: 'Automatic',
      withApproval: 'With Approval',
      human: 'Human (Pauses AI)',
      internalNote: 'Internal Note',
      sendMessage: 'Send message...',
      send: 'Send',
      contactContext: 'Contact Context',
      millionsnestIdentity: 'MillionsNest Identity',
      linked: 'Linked',
      notLinked: 'Not Linked',
      pending: 'Pending',
      revoked: 'Revoked',
      sentimentNotice: 'Sentiment signals are secondary statistical indicators, not factual truth or permission authority.',
      executedTools: 'Executed Tools History',
    },
    tools: {
      livingLibraryManageWarning: 'The tool "addSongToLivingLibrary" is global R3/R4 and requires the "livingLibrary.manage" capability. Local org admins do not possess this privilege by default.',
      toolGatewayNotice: 'All tool invocations pass through the Tool Gateway with token validation, RBAC, tenant scoping, and immutable auditing.',
    },
  },
  'es-ES': {
    appName: 'MillionsNest Connect',
    demoBadge: 'MODO DEMOSTRACIÓN (DEMO_MODE)',
    tagline: 'Conecte conversaciones, equipos y acciones en todo el ecosistema MillionsNest.',
    nav: {
      overview: 'Visión General',
      inbox: 'Bandeja de Entrada',
      contacts: 'Contactos',
      agents: 'Agentes',
      knowledge: 'Conocimiento',
      automations: 'Automatizaciones',
      appsTools: 'Apps y Herramientas',
      channels: 'Canales',
      analytics: 'Analítica',
      audit: 'Auditoría',
      settings: 'Configuración',
      docs: 'Documentación Técnica',
    },
    common: {
      search: 'Buscar...',
      filter: 'Filtrar',
      export: 'Exportar',
      refresh: 'Actualizar',
      active: 'Activo',
      paused: 'Pausado',
      draft: 'Borrador',
      status: 'Estado',
      actions: 'Acciones',
      close: 'Cerrar',
      save: 'Guardar',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      details: 'Detalles',
      organization: 'Organización',
      risk: 'Riesgo',
      version: 'Versión',
      updatedAt: 'Actualizado el',
      language: 'Idioma',
      warning: 'Advertencia',
      success: 'Éxito',
      denied: 'Denegado',
      required: 'Obligatorio',
      loading: 'Cargando...',
      noData: 'Sin datos encontrados',
      demoNotice: 'Esta interfaz opera en DEMO_MODE con datos simulados locales. No hay APIs o bases de datos reales conectadas.',
    },
    inbox: {
      all: 'Todas',
      mine: 'Mis conversaciones',
      unassigned: 'Sin asignar',
      waitingHuman: 'Esperando Humano',
      automationActive: 'Automatización Activa',
      resolved: 'Resueltas',
      mode: 'Modo de Atención',
      automatic: 'Automático',
      withApproval: 'Con Aprobación',
      human: 'Humano (Pausa IA)',
      internalNote: 'Nota Interna',
      sendMessage: 'Enviar mensaje...',
      send: 'Enviar',
      contactContext: 'Contexto del Contacto',
      millionsnestIdentity: 'Identidad MillionsNest',
      linked: 'Vinculado',
      notLinked: 'No Vinculado',
      pending: 'Pendiente',
      revoked: 'Revocado',
      sentimentNotice: 'Las señales de sentimiento son indicadores auxiliares estadísticos, no verdad factual ni autoridad de permiso.',
      executedTools: 'Historial de Herramientas Ejecutadas',
    },
    tools: {
      livingLibraryManageWarning: 'La herramienta "addSongToLivingLibrary" es global R3/R4 y requiere la capacidad "livingLibrary.manage". Los administradores locales no poseen este privilegio.',
      toolGatewayNotice: 'Toda ejecución pasa por el Tool Gateway con validación de tokens, RBAC, alcance por tenant y auditoría inmutable.',
    },
  },
};

export function getTranslation(lang: LanguageCode, keyPath: string): string {
  const catalog = dictionaries[lang] || dictionaries['pt-BR'];
  const keys = keyPath.split('.');
  let val: any = catalog;
  for (const k of keys) {
    if (val && typeof val === 'object' && k in val) {
      val = val[k];
    } else {
      return keyPath;
    }
  }
  return typeof val === 'string' ? val : keyPath;
}

export function formatDate(isoString: string, lang: LanguageCode = 'pt-BR'): string {
  try {
    const d = new Date(isoString);
    const localeMap = { 'pt-BR': 'pt-BR', 'en-US': 'en-US', 'es-ES': 'es-ES' };
    return new Intl.DateTimeFormat(localeMap[lang] || 'pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatCurrency(amount: number, lang: LanguageCode = 'pt-BR'): string {
  if (lang === 'pt-BR') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  } else {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
}
