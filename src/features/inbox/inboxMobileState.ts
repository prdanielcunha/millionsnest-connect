export type InboxMobileView = 'list' | 'chat' | 'context';

export type InboxMobileUiState = {
  view: InboxMobileView;
  filtersOpen: boolean;
  quickToolsOpen: boolean;
};

export type InboxMobileUiAction =
  | { type: 'OPEN_LIST' }
  | { type: 'OPEN_CHAT' }
  | { type: 'OPEN_CONTEXT' }
  | { type: 'OPEN_FILTERS' }
  | { type: 'CLOSE_FILTERS' }
  | { type: 'OPEN_QUICK_TOOLS' }
  | { type: 'CLOSE_QUICK_TOOLS' }
  | { type: 'RESET_OVERLAYS' }
  | { type: 'CHANGE_ORG' };

export function inboxMobileUiReducer(state: InboxMobileUiState, action: InboxMobileUiAction): InboxMobileUiState {
  switch (action.type) {
    case 'OPEN_LIST':
      return { ...state, view: 'list', filtersOpen: false, quickToolsOpen: false };
    case 'OPEN_CHAT':
      return { ...state, view: 'chat', filtersOpen: false, quickToolsOpen: false };
    case 'OPEN_CONTEXT':
      return { ...state, view: 'context', filtersOpen: false, quickToolsOpen: false };
    case 'OPEN_FILTERS':
      return { ...state, filtersOpen: true, quickToolsOpen: false };
    case 'CLOSE_FILTERS':
      return { ...state, filtersOpen: false };
    case 'OPEN_QUICK_TOOLS':
      return { ...state, quickToolsOpen: true, filtersOpen: false };
    case 'CLOSE_QUICK_TOOLS':
      return { ...state, quickToolsOpen: false };
    case 'RESET_OVERLAYS':
      return { ...state, filtersOpen: false, quickToolsOpen: false };
    case 'CHANGE_ORG':
      return { ...state, view: 'list', filtersOpen: false, quickToolsOpen: false };
    default:
      return state;
  }
}
