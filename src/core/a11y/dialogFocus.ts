export function getDialogFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const focusable: HTMLElement[] = [];
  
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    // Check for disabled attribute or disabled property
    if (el.hasAttribute('disabled')) continue;
    // Check for aria-hidden
    if (el.getAttribute('aria-hidden') === 'true') continue;
    // Check for inert
    if (el.hasAttribute('inert')) continue;
    // Check for visibility and display
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    // Check for bounding rect (rendered area)
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    
    focusable.push(el);
  }

  return focusable;
}
