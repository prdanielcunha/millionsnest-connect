import { LanguageCode, EffectiveEcosystemContext, ToolDefinition } from '../../types';

export type DemoIdentityScenario = 'unlinked_demo' | 'linked_demo';

export type MenuTriggerMatch = {
  locale: LanguageCode;
  canonicalTrigger: string;
  normalizedInput: string;
};

export type MenuOptionCategory = 'public' | 'protected';

export interface MenuOptionDefinition {
  id: string;
  numberKey: string;
  category: MenuOptionCategory;
  actionPayload: string;
  toolName?: string;
  appId?: string;
  requiresActiveMembership?: boolean;
}

export interface ProjectedMenuOption extends MenuOptionDefinition {
  title: string;
  description: string;
  badge?: string;
  allowed: boolean;
  reason?: string;
}

export interface ConversationalMenuResponse {
  isTriggerMatch: boolean;
  matchedTrigger?: string;
  menuTitle: string;
  subtitle: string;
  publicOptions: ProjectedMenuOption[];
  musicscaleAuthOptions: ProjectedMenuOption[];
  footerNote: string;
}

// Normalized triggers mapping to their canonical trigger and primary language locale
const MENU_TRIGGERS_BY_LOCALE: Readonly<Record<LanguageCode, Readonly<Record<string, string>>>> = {
  'pt-BR': {
    'menu': 'menu',
    'ajuda': 'ajuda',
    'opcoes': 'opções',
    'comecar': 'começar',
    'inicio': 'início',
    '0': '0',
    '#': '#'
  },
  'en-US': {
    'menu': 'menu',
    'help': 'help',
    'options': 'options',
    'start': 'start',
    '0': '0',
    '#': '#'
  },
  'es-ES': {
    'menu': 'menu',
    'ayuda': 'ayuda',
    'opciones': 'opciones',
    'comenzar': 'comenzar',
    'inicio': 'inicio',
    '0': '0',
    '#': '#'
  }
};

export function normalizeMenuTrigger(input: string): string {
  let normalized = input.trim().toLowerCase();
  // String normalize NFD & remove diacritics
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Replace punctuation/special chars with space, preserving alphanumeric and #
  normalized = normalized.replace(/[^a-z0-9#]/g, ' ');
  // Collapse spaces and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

export function matchMenuTrigger(input: string, preferredLocale: LanguageCode): MenuTriggerMatch | null {
  const normalizedInput = normalizeMenuTrigger(input);
  if (!normalizedInput) {
    return null;
  }

  // Prefer the preferredLocale first
  const preferredMap = MENU_TRIGGERS_BY_LOCALE[preferredLocale];
  if (preferredMap && preferredMap[normalizedInput]) {
    return {
      locale: preferredLocale,
      canonicalTrigger: preferredMap[normalizedInput],
      normalizedInput
    };
  }

  // Fallback to other locales
  for (const locale of Object.keys(MENU_TRIGGERS_BY_LOCALE) as LanguageCode[]) {
    if (locale === preferredLocale) continue;
    const map = MENU_TRIGGERS_BY_LOCALE[locale];
    if (map[normalizedInput]) {
      return {
        locale,
        canonicalTrigger: map[normalizedInput],
        normalizedInput
      };
    }
  }

  return null;
}

export function hasCompleteProtectedMenuContract(option: MenuOptionDefinition): boolean {
  if (option.category === 'protected') {
    return option.requiresActiveMembership === true && !!option.appId && !!option.toolName;
  }
  return true; // Public options don't need this contract
}

export const staticOptionDefinitions: MenuOptionDefinition[] = [
  // Public
  {
    id: 'opt_pub_1',
    numberKey: '1',
    category: 'public',
    actionPayload: 'ACTION_EXPLORE_APPS',
  },
  {
    id: 'opt_pub_2',
    numberKey: '2',
    category: 'public',
    actionPayload: 'ACTION_TECH_SUPPORT',
  },
  {
    id: 'opt_pub_3',
    numberKey: '3',
    category: 'public',
    actionPayload: 'ACTION_ACCOUNT_ORG',
  },
  {
    id: 'opt_pub_4',
    numberKey: '4',
    category: 'public',
    actionPayload: 'ACTION_MUSICSCALE_INFO',
  },
  {
    id: 'opt_pub_5',
    numberKey: '5',
    category: 'public',
    actionPayload: 'ACTION_TRANSFER_HUMAN',
  },
  {
    id: 'opt_pub_6',
    numberKey: '6',
    category: 'public',
    actionPayload: 'ACTION_PRIVACY_TERMS',
  },
  // Protected (Auth)
  {
    id: 'opt_ms_1',
    numberKey: '7',
    category: 'protected',
    actionPayload: 'TOOL_CALL_LIST_SCHEDULES',
    toolName: 'listSchedules',
    appId: 'musicscale',
    requiresActiveMembership: true,
  },
  {
    id: 'opt_ms_2',
    numberKey: '8',
    category: 'protected',
    actionPayload: 'TOOL_CALL_GET_SCHEDULE',
    toolName: 'getSchedule',
    appId: 'musicscale',
    requiresActiveMembership: true,
  },
  {
    id: 'opt_ms_3',
    numberKey: '9',
    category: 'protected',
    actionPayload: 'TOOL_CALL_CREATE_DRAFT',
    toolName: 'createScheduleDraft',
    appId: 'musicscale',
    requiresActiveMembership: true,
  },
  {
    id: 'opt_ms_4',
    numberKey: '10',
    category: 'protected',
    actionPayload: 'TOOL_CALL_CLONE_SCHEDULE',
    toolName: 'cloneSchedule',
    appId: 'musicscale',
    requiresActiveMembership: true,
  },
  {
    id: 'opt_ms_5',
    numberKey: '11',
    category: 'protected',
    actionPayload: 'TOOL_CALL_LIST_MEMBERS',
    toolName: 'listMembers',
    appId: 'musicscale',
    requiresActiveMembership: true,
  },
  {
    id: 'opt_ms_6',
    numberKey: '12',
    category: 'protected',
    actionPayload: 'TOOL_CALL_MANAGE_REPERTOIRE',
    toolName: 'addSongToRepertoire',
    appId: 'musicscale',
    requiresActiveMembership: true,
  },
  {
    id: 'opt_ms_7',
    numberKey: '13',
    category: 'protected',
    actionPayload: 'TOOL_CALL_SEARCH_LIVING_LIBRARY',
    toolName: 'searchLivingLibrary',
    appId: 'musicscale',
    requiresActiveMembership: true,
  },
  {
    id: 'opt_ms_8',
    numberKey: '14',
    category: 'protected',
    actionPayload: 'ACTION_TRANSFER_WORSHIP_LEAD',
    requiresActiveMembership: true,
  },
];

export interface OptionText {
  title: string;
  description: string;
  badge?: string;
}

export const optionsLocalizedCatalog: Record<LanguageCode, Record<string, OptionText>> = {
  'pt-BR': {
    opt_pub_1: {
      title: 'Conhecer os aplicativos',
      description: 'Explore o ecossistema MillionsNest: MusicScale e NestFinance.',
    },
    opt_pub_2: {
      title: 'Suporte técnico',
      description: 'Dúvidas sobre uso, erros, instalação ou sincronização.',
    },
    opt_pub_3: {
      title: 'Minha conta e organização',
      description: 'Verifique seu status de membro ou vincule sua conta.',
    },
    opt_pub_4: {
      title: 'MusicScale (Louvor & Escalas)',
      description: 'Acesse escalas, cifras e voluntários do seu ministério.',
      badge: 'Popular',
    },
    opt_pub_5: {
      title: 'Falar com atendente',
      description: 'Simula a solicitação de transferência para atendimento humano.',
      badge: 'Humano',
    },
    opt_pub_6: {
      title: 'Privacidade e segurança',
      description: 'Consulte políticas de privacidade, LGPD e consentimento.',
    },
    opt_ms_1: {
      title: 'Ver próximas escalas',
      description: 'Consulte datas, horários e instrumentos em que você está escalado.',
      badge: 'Membro Vinculado',
    },
    opt_ms_2: {
      title: 'Ver detalhes de uma escala',
      description: 'Lista de músicas, tons, horários de ensaio e confirmações.',
      badge: 'Membro Vinculado',
    },
    opt_ms_3: {
      title: 'Criar rascunho de escala',
      description: 'Montagem prévia de culto para validação do líder.',
      badge: 'Líder',
    },
    opt_ms_4: {
      title: 'Clonar escala anterior',
      description: 'Duplica voluntários e repertório de um culto passado.',
      badge: 'Líder',
    },
    opt_ms_5: {
      title: 'Gerenciar membros',
      description: 'Consulte a lista de voluntários e instrumentos da igreja.',
    },
    opt_ms_6: {
      title: 'Gerenciar repertório local',
      description: 'Consulte ou adicione músicas cadastradas na igreja.',
    },
    opt_ms_7: {
      title: 'Pesquisar Biblioteca Viva',
      description: 'Acervo global de cifras e arranjos homologados.',
      badge: 'Global',
    },
    opt_ms_8: {
      title: 'Falar com Suporte Específico',
      description: 'Simula o encaminhamento para a liderança direta do seu departamento.',
    },
  },
  'en-US': {
    opt_pub_1: {
      title: 'Explore Applications',
      description: 'Explore the MillionsNest ecosystem: MusicScale and NestFinance.',
    },
    opt_pub_2: {
      title: 'Technical Support',
      description: 'Questions about usage, errors, installation, or sync.',
    },
    opt_pub_3: {
      title: 'My Account & Organization',
      description: 'Verify your membership status or link your account.',
    },
    opt_pub_4: {
      title: 'MusicScale (Worship & Schedules)',
      description: 'Access schedules, chords, and volunteers of your ministry.',
      badge: 'Popular',
    },
    opt_pub_5: {
      title: 'Talk to an Agent',
      description: 'Simulates a request to transfer to human support.',
      badge: 'Human',
    },
    opt_pub_6: {
      title: 'Privacy & Security',
      description: 'Consult privacy policies, GDPR, and consent.',
    },
    opt_ms_1: {
      title: 'View Upcoming Schedules',
      description: 'Check dates, times, and instruments for your scheduled worships.',
      badge: 'Linked Member',
    },
    opt_ms_2: {
      title: 'View Schedule Details',
      description: 'List of songs, keys, rehearsal times, and confirmations.',
      badge: 'Linked Member',
    },
    opt_ms_3: {
      title: 'Create Schedule Draft',
      description: 'Previous setup of service schedules for leader validation.',
      badge: 'Leader',
    },
    opt_ms_4: {
      title: 'Clone Past Schedule',
      description: 'Duplicates volunteers and repertoire from a previous service.',
      badge: 'Leader',
    },
    opt_ms_5: {
      title: 'Manage Members',
      description: 'View the list of volunteers and instruments in the church.',
    },
    opt_ms_6: {
      title: 'Manage Local Repertoire',
      description: 'Consult or add registered songs in the local church.',
    },
    opt_ms_7: {
      title: 'Search Living Library',
      description: 'Global collection of approved chords and arrangements.',
      badge: 'Global',
    },
    opt_ms_8: {
      title: 'Talk to Specific Support',
      description: 'Simulates forwarding to the direct leadership of your department.',
    },
  },
  'es-ES': {
    opt_pub_1: {
      title: 'Conocer las aplicaciones',
      description: 'Explore el ecosistema MillionsNest: MusicScale y NestFinance.',
    },
    opt_pub_2: {
      title: 'Soporte técnico',
      description: 'Dudas sobre uso, errores, instalación o sincronización.',
    },
    opt_pub_3: {
      title: 'Mi cuenta y organización',
      description: 'Verifique su estado de miembro o vincule su cuenta.',
    },
    opt_pub_4: {
      title: 'MusicScale (Alabanza y Escalas)',
      description: 'Acceda a escalas, acordes y voluntarios de su ministerio.',
      badge: 'Popular',
    },
    opt_pub_5: {
      title: 'Hablar con un agente',
      description: 'Simula la solicitud de transferencia a atención humana.',
      badge: 'Humano',
    },
    opt_pub_6: {
      title: 'Privacidad y seguridad',
      description: 'Consulte políticas de privacidad, RGPD y consentimiento.',
    },
    opt_ms_1: {
      title: 'Ver próximas escalas',
      description: 'Consulte fechas, horarios e instrumentos en los que está programado.',
      badge: 'Miembro Vinculado',
    },
    opt_ms_2: {
      title: 'Ver detalles de una escala',
      description: 'Lista de canciones, tonos, horarios de ensayo y confirmaciones.',
      badge: 'Miembro Vinculado',
    },
    opt_ms_3: {
      title: 'Crear borrador de escala',
      description: 'Montaje previo de servicios para validación del líder.',
      badge: 'Líder',
    },
    opt_ms_4: {
      title: 'Clonar escala anterior',
      description: 'Duplica voluntarios y repertorio de un servicio anterior.',
      badge: 'Líder',
    },
    opt_ms_5: {
      title: 'Gestionar miembros',
      description: 'Consulte la lista de voluntarios e instrumentos de la iglesia.',
    },
    opt_ms_6: {
      title: 'Gestionar repertorio local',
      description: 'Consulte o añada canciones registradas en la iglesia.',
    },
    opt_ms_7: {
      title: 'Buscar Biblioteca Viva',
      description: 'Colección global de acordes y arreglos homologados.',
      badge: 'Global',
    },
    opt_ms_8: {
      title: 'Hablar con soporte específico',
      description: 'Simula la redirección al liderazgo directo de su departamento.',
    },
  },
};

export function resolveDemoMenuProjection(
  context: EffectiveEcosystemContext,
  scenario: DemoIdentityScenario,
  optionDefinitions: MenuOptionDefinition[],
  tools: ToolDefinition[]
): Record<string, { optionId: string; allowed: boolean; reason?: string }> {
  const results: Record<string, { optionId: string; allowed: boolean; reason?: string }> = {};

  for (const opt of optionDefinitions) {
    if (opt.category === 'public') {
      results[opt.id] = { optionId: opt.id, allowed: true };
      continue;
    }

    if (!hasCompleteProtectedMenuContract(opt)) {
      results[opt.id] = { optionId: opt.id, allowed: false, reason: 'contract_missing' };
      continue;
    }

    // Protected rules are cumulative:
    // 1. scenario === 'linked_demo'
    if (scenario !== 'linked_demo') {
      results[opt.id] = { optionId: opt.id, allowed: false, reason: 'unlinked' };
      continue;
    }

    const uid = context.user.uid;
    const activeOrg = context.activeOrganization;

    if (!uid || !activeOrg?.id) {
      results[opt.id] = { optionId: opt.id, allowed: false, reason: 'context_incomplete' };
      continue;
    }

    // 2. membership do context.user.uid
    // 3. membership.organizationId === context.activeOrganization.id
    const membership = context.memberships.find(
      (m) => m.uid === uid && m.organizationId === activeOrg.id
    );

    if (!membership) {
      results[opt.id] = { optionId: opt.id, allowed: false, reason: 'membership_missing' };
      continue;
    }

    // 4. membership.status === 'active'
    if (membership.status !== 'active') {
      results[opt.id] = { optionId: opt.id, allowed: false, reason: 'membership_inactive' };
      continue;
    }

    // 5. appAccess correspondente existe, 6. appAccess.access === true
    if (opt.appId) {
      const appAccess = context.appAccess.find((a) => a.appId === opt.appId);
      if (!appAccess) {
        results[opt.id] = { optionId: opt.id, allowed: false, reason: 'app_access_missing' };
        continue;
      }
      if (appAccess.access !== true) {
        results[opt.id] = { optionId: opt.id, allowed: false, reason: 'app_access_disabled' };
        continue;
      }
    }

    // 7. ToolDefinition correspondente existe se toolName declarado
    if (opt.toolName) {
      const tool = tools.find((t) => t.name === opt.toolName && t.appId === opt.appId);
      if (!tool) {
        results[opt.id] = { optionId: opt.id, allowed: false, reason: 'tool_missing' };
        continue;
      }

      // 8. requiredPermissions da ferramenta atendidas exatamente por:
      // - membership.permissions ou appAccess.capabilities
      const required = tool.requiredPermissions || [];
      if (required.length > 0) {
        const userPerms = membership.permissions || [];
        
        let userCaps: string[] = [];
        if (opt.appId) {
          const appAccess = context.appAccess.find((a) => a.appId === opt.appId);
          if (appAccess) {
            userCaps = appAccess.capabilities || [];
          }
        }

        const hasAll = required.every(
          (p) => userPerms.includes(p) || userCaps.includes(p)
        );

        if (!hasAll) {
          results[opt.id] = { optionId: opt.id, allowed: false, reason: 'permission_missing' };
          continue;
        }
      }
    }

    // 9. organizationScoped respeitado
    // (Already satisfied by membership scope validation above!)

    results[opt.id] = { optionId: opt.id, allowed: true };
  }

  return results;
}
