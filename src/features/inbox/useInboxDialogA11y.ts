import { useEffect, useRef } from 'react';
import { getNextFocusIndex, getPreviousFocusIndex, isElementFocusable, ElementFocusDescriptor } from './inboxDomain';

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const result: HTMLElement[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];
    
    let disabled = false;
    if (
      el instanceof HTMLButtonElement ||
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
    ) {
      disabled = el.disabled;
    }

    let display = 'block';
    let visibility = 'visible';
    if (typeof window !== 'undefined') {
      const style = window.getComputedStyle(el);
      display = style.display;
      visibility = style.visibility;
    }

    const hasClientRects = el.getClientRects && el.getClientRects().length > 0;

    const descriptor: ElementFocusDescriptor = {
      tagName: el.tagName,
      disabled,
      hasDisabledAttribute: el.hasAttribute('disabled'),
      ariaHidden: el.getAttribute('aria-hidden'),
      inert: el.hasAttribute('inert'),
      hidden: el.hasAttribute('hidden'),
      tabIndex: el.tabIndex,
      display,
      visibility,
      hasClientRects,
    };

    if (isElementFocusable(descriptor)) {
      result.push(el);
    }
  }
  return result;
}

export function useInboxDialogA11y(isOpen: boolean, onClose: () => void) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // Capture the trigger focus point exactly once on open
    previousFocusRef.current = document.activeElement as HTMLElement;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus to container or first focusable element
    if (containerRef.current) {
      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else {
        containerRef.current.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && containerRef.current) {
        const focusableElements = getFocusableElements(containerRef.current);
        
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const activeEl = document.activeElement as HTMLElement;
        const currentIndex = focusableElements.indexOf(activeEl);

        if (e.shiftKey) {
          if (currentIndex === 0 || currentIndex === -1) {
            const prevIdx = getPreviousFocusIndex(currentIndex === -1 ? 0 : currentIndex, focusableElements.length);
            focusableElements[prevIdx].focus();
            e.preventDefault();
          }
        } else {
          if (currentIndex === focusableElements.length - 1 || currentIndex === -1) {
            const nextIdx = getNextFocusIndex(currentIndex === -1 ? focusableElements.length - 1 : currentIndex, focusableElements.length);
            focusableElements[nextIdx].focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  return { containerRef };
}
