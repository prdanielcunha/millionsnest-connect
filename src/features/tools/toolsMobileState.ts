export type ToolsMobileView = 'catalog' | 'detail';

export type ToolsMobileState = {
  view: ToolsMobileView;
};

export type ToolsMobileAction =
  | { type: 'OPEN_CATALOG' }
  | { type: 'OPEN_DETAIL' }
  | { type: 'CHANGE_ORG' };

export function toolsMobileReducer(
  state: ToolsMobileState,
  action: ToolsMobileAction
): ToolsMobileState {
  switch (action.type) {
    case 'OPEN_CATALOG':
      return { ...state, view: 'catalog' };
    case 'OPEN_DETAIL':
      return { ...state, view: 'detail' };
    case 'CHANGE_ORG':
      return { ...state, view: 'catalog' };
    default:
      return state;
  }
}
