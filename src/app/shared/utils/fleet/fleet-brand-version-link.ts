import { DestroyRef, effect, inject, type WritableSignal } from '@angular/core';

/** Limpia la versión cuando el usuario cambia la marca (evita p. ej. Toyota + Versa). */
export function registerFleetVersionResetOnBrandChange(opts: {
  brandName: () => string;
  versionName: WritableSignal<string>;
}): void {
  const destroyRef = inject(DestroyRef);
  let previous = opts.brandName().trim();

  const ref = effect(
    () => {
      const next = opts.brandName().trim();
      if (previous && previous !== next) {
        opts.versionName.set('');
      }
      previous = next;
    },
    { allowSignalWrites: true },
  );

  destroyRef.onDestroy(() => ref.destroy());
}
