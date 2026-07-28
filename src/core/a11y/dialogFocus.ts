export type DialogFocusableDescriptor = {
  disabled: boolean;
  ariaHidden: boolean;
  inert: boolean;
  hidden: boolean;
  displayNone: boolean;
  visibilityHidden: boolean;
  hasRenderedArea: boolean;
};

export function isDialogFocusableDescriptor(descriptor: DialogFocusableDescriptor): boolean {
  if (descriptor.disabled) return false;
  if (descriptor.ariaHidden) return false;
  if (descriptor.inert) return false;
  if (descriptor.hidden) return false;
  if (descriptor.displayNone) return false;
  if (descriptor.visibilityHidden) return false;
  if (!descriptor.hasRenderedArea) return false;
  return true;
}

export function getNextDialogFocusIndex(
  currentIndex: number,
  total: number
): number | null {
  if (total <= 0) return null;
  if (total === 1) return 0;
  if (currentIndex < 0 || currentIndex >= total) return 0;
  return (currentIndex + 1) % total;
}

export function getPreviousDialogFocusIndex(
  currentIndex: number,
  total: number
): number | null {
  if (total <= 0) return null;
  if (total === 1) return 0;
  if (currentIndex < 0 || currentIndex >= total) return total - 1;
  return (currentIndex - 1 + total) % total;
}

export function getDialogFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const focusable: HTMLElement[] = [];
  
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    
    // Check closest for ancestors
    if (el.closest('[hidden], [aria-hidden="true"], [inert]')) {
      continue;
    }
    
    // Check own attributes
    const isElDisabled = 'disabled' in el && (el as { disabled?: boolean }).disabled;
    if (el.hasAttribute('disabled') || isElDisabled) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    if (el.getAttribute('aria-disabled') === 'true') continue;
    if (el.hasAttribute('inert')) continue;
    if (el.hasAttribute('hidden')) continue;
    
    // Check visibility and display
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    
    // Check rendered area using getClientRects
    if (el.getClientRects().length === 0) continue;
    
    focusable.push(el);
  }

  return focusable;
}
