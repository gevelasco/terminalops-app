import { type Observable, of, timer } from 'rxjs';
import { distinctUntilChanged, map, switchMap } from 'rxjs';

/** Espera al escribir; al borrar aplica el filtro al instante. */
export const EXPENSES_SEARCH_DEBOUNCE_MS = 500;

export function debouncedTrimmedSearchQuery(
  source: Observable<string>,
  debounceMs = EXPENSES_SEARCH_DEBOUNCE_MS,
): Observable<string> {
  return source.pipe(
    map((q) => q.trim()),
    distinctUntilChanged(),
    switchMap((q) => (q === '' ? of('') : timer(debounceMs).pipe(map(() => q)))),
  );
}
