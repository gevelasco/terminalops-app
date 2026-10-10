import { finalize, shareReplay, type Observable } from 'rxjs';

/**
 * Reutiliza un GET en vuelo para la misma operación (p. ej. refresh encadenados).
 * El slot se limpia al completar o fallar el observable.
 */
export function coalesceInFlightRequest<T>(
  slot: { current: Observable<T> | null },
  factory: () => Observable<T>,
): Observable<T> {
  if (!slot.current) {
    slot.current = factory().pipe(
      finalize(() => {
        slot.current = null;
      }),
      shareReplay(1),
    );
  }
  return slot.current;
}
