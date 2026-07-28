export type MenuMobileView = 'configure' | 'preview';

export interface MenuMobileState {
  activeView: MenuMobileView;
}

export type MenuMobileAction =
  | { type: 'OPEN_CONFIGURE' }
  | { type: 'OPEN_PREVIEW' }
  | { type: 'CHANGE_ORG' };

export const initialMobileState: MenuMobileState = {
  activeView: 'configure',
};

export function menuMobileReducer(
  state: MenuMobileState,
  action: MenuMobileAction
): MenuMobileState {
  switch (action.type) {
    case 'OPEN_CONFIGURE':
      return {
        ...state,
        activeView: 'configure',
      };
    case 'OPEN_PREVIEW':
      return {
        ...state,
        activeView: 'preview',
      };
    case 'CHANGE_ORG':
      return {
        ...state,
        activeView: 'configure',
      };
    default:
      return state;
  }
}
