export const LIVE_OVERVIEW_ROUTE = 'overview' as const;
export const LIVE_RADAR_ROUTE = 'radar' as const;
export const LIVE_CONTACTS_ROUTE = 'contacts' as const;

export function getLiveNavigationRouteIds(showRadar: boolean): string[] {
  return showRadar
    ? [LIVE_OVERVIEW_ROUTE, LIVE_RADAR_ROUTE, LIVE_CONTACTS_ROUTE]
    : [LIVE_OVERVIEW_ROUTE];
}

export function isLiveRouteEnabled(route: string, showRadar: boolean): boolean {
  return getLiveNavigationRouteIds(showRadar).includes(route);
}
