export const LIVE_OVERVIEW_ROUTE = 'overview' as const;
export const LIVE_ASSIST_ROUTE = 'assist' as const;
export const LIVE_RADAR_ROUTE = 'radar' as const;
export const LIVE_SOURCES_ROUTE = 'sources' as const;
export const LIVE_CONTACTS_ROUTE = 'contacts' as const;
export const LIVE_INTELLIGENCE_ROUTE = 'intelligence' as const;

export type ExperienceProfile =
  | 'ceo'
  | 'musician'
  | 'worship_leader'
  | 'pastor_leader'
  | 'support'
  | 'commercial'
  | 'organization_admin';

export type ExperienceView = 'real' | ExperienceProfile;

export const EXPERIENCE_PREVIEW_OPTIONS: ExperienceView[] = [
  'real',
  'musician',
  'worship_leader',
  'pastor_leader',
  'support',
  'commercial',
  'organization_admin',
];

const RELATIONSHIP_ROUTES = [
  LIVE_RADAR_ROUTE,
  LIVE_SOURCES_ROUTE,
  LIVE_INTELLIGENCE_ROUTE,
  'opportunities',
  'playbooks',
  'composer',
] as const;

export function resolveRealExperienceProfile(systemRole: unknown, organizationRole?: unknown): ExperienceProfile {
  const system = String(systemRole || '').trim().toLocaleLowerCase('pt-BR');
  if (['ceo', 'global_admin', 'ecosystem_owner', 'founder'].includes(system)) return 'ceo';
  if (system === 'support' || system === 'suporte') return 'support';

  const organization = String(organizationRole || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/admin|administrador|administrator/.test(organization)) return 'organization_admin';
  if (/louvor|worship|ministro|minister|lider.*louvor|worship.*leader/.test(organization)) return 'worship_leader';
  if (/pastor|lider|leader/.test(organization)) return 'pastor_leader';
  return 'musician';
}

export function resolveExperienceProfile(view: ExperienceView, realProfile: ExperienceProfile): ExperienceProfile {
  return view === 'real' ? realProfile : view;
}

/**
 * Routes with a real live surface today. This is deliberately narrower than
 * the visible product navigation: staged modules can be discoverable without
 * pretending that their backend is already activated.
 */
export function getLiveNavigationRouteIds(showRadar: boolean): string[] {
  return showRadar
    ? [
        LIVE_OVERVIEW_ROUTE,
        LIVE_ASSIST_ROUTE,
        LIVE_RADAR_ROUTE,
        LIVE_SOURCES_ROUTE,
        LIVE_CONTACTS_ROUTE,
        LIVE_INTELLIGENCE_ROUTE,
      ]
    : [LIVE_OVERVIEW_ROUTE, LIVE_ASSIST_ROUTE];
}

/**
 * Product navigation is adaptive by job-to-be-done. Visibility never grants
 * authority: App/backend guards still decide which actions are executable.
 */
export function getExperienceNavigationRouteIds(
  profile: ExperienceProfile,
  showRadar: boolean,
): string[] {
  let routes: string[];

  switch (profile) {
    case 'musician':
      routes = ['overview', 'assist'];
      break;
    case 'worship_leader':
    case 'pastor_leader':
      routes = ['overview', 'inbox', 'contacts', 'assist'];
      break;
    case 'support':
      routes = ['overview', 'inbox', 'contacts', 'assist', 'knowledge'];
      break;
    case 'commercial':
      routes = [
        'overview',
        'contacts',
        'assist',
        'radar',
        'opportunities',
        'playbooks',
        'composer',
        'intelligence',
        'sources',
      ];
      break;
    case 'organization_admin':
      routes = [
        'overview',
        'inbox',
        'contacts',
        'assist',
        'automations',
        'channels',
        'agents',
        'knowledge',
        'audit',
        'settings',
        'sources',
        'imports',
        'preferences',
      ];
      break;
    case 'ceo':
    default:
      routes = [
        'overview',
        'inbox',
        'contacts',
        'assist',
        'radar',
        'opportunities',
        'playbooks',
        'composer',
        'intelligence',
        'automations',
        'channels',
        'agents',
        'knowledge',
        'audit',
        'settings',
        'sources',
        'imports',
        'preferences',
      ];
      break;
  }

  if (!showRadar) {
    const relationshipRoutes = new Set<string>(RELATIONSHIP_ROUTES);
    routes = routes.filter(route => !relationshipRoutes.has(route));
  }

  return routes;
}

export function isLiveRouteEnabled(route: string, showRadar: boolean): boolean {
  return getLiveNavigationRouteIds(showRadar).includes(route);
}
