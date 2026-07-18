import { DestroyRef, inject, signal, type Signal } from '@angular/core';

/** Breakpoint compartido para tratar el viewport como mobile. */
export const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)';

/**
 * Signal reactiva que indica si el viewport es mobile.
 * Debe llamarse en contexto de inyección (inicializador de campo o constructor).
 */
export function injectIsMobileViewport(): Signal<boolean> {
  const query = window.matchMedia(MOBILE_VIEWPORT_QUERY);
  const isMobile = signal(query.matches);
  const onChange = (event: MediaQueryListEvent) => isMobile.set(event.matches);
  query.addEventListener('change', onChange);
  inject(DestroyRef).onDestroy(() =>
    query.removeEventListener('change', onChange),
  );
  return isMobile.asReadonly();
}
