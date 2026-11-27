import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { normalizePlaceKey } from '@shared/models/destination-rate-scope';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

type MunicipalitiesByState = Readonly<Record<string, readonly string[]>>;

/** Alias geo (`mexico-states.json`) → clave del catálogo INEGI. */
const STATE_CATALOG_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['distrito federal', 'ciudad de mexico'],
  ['ciudad de mexico', 'ciudad de mexico'],
  ['mexico', 'mexico'],
  ['estado de mexico', 'mexico'],
  ['queretaro de arteaga', 'queretaro'],
  ['queretaro', 'queretaro'],
  ['michoacan de ocampo', 'michoacan de ocampo'],
  ['veracruz de ignacio de la llave', 'veracruz de ignacio de la llave'],
  ['coahuila de zaragoza', 'coahuila de zaragoza'],
];

/**
 * Catálogo estático de municipios por estado (INEGI).
 * Fuente: public/geo/mexico-municipalities-by-state.json
 */
@Injectable({ providedIn: 'root' })
export class MexicoMunicipalitiesService {
  private readonly http = inject(HttpClient);

  private readonly catalog$: Observable<MunicipalitiesByState> = this.http
    .get<MunicipalitiesByState>('/geo/mexico-municipalities-by-state.json')
    .pipe(
      map((body) => (body && typeof body === 'object' ? body : {})),
      catchError(() => of({} as MunicipalitiesByState)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

  preload(): void {
    void this.catalog$.subscribe();
  }

  municipalitiesForState(stateLabel: string): Observable<readonly string[]> {
    const wanted = normalizePlaceKey(stateLabel);
    if (!wanted) {
      return of([]);
    }
    return this.catalog$.pipe(
      map((catalog) => {
        const key = this.resolveCatalogStateKey(wanted, catalog);
        if (!key) {
          return [];
        }
        const rows = catalog[key] ?? [];
        return [...rows].sort((a, b) => a.localeCompare(b, 'es'));
      }),
    );
  }

  municipalityOptionsForState(stateLabel: string): Observable<ToSelectOption[]> {
    return this.municipalitiesForState(stateLabel).pipe(
      map((rows) => rows.map((name) => ({ value: name, label: name }))),
    );
  }

  private resolveCatalogStateKey(
    wantedNorm: string,
    catalog: MunicipalitiesByState,
  ): string | null {
    const aliasTarget =
      STATE_CATALOG_ALIASES.find(([from]) => from === wantedNorm)?.[1] ??
      wantedNorm;

    for (const key of Object.keys(catalog)) {
      if (normalizePlaceKey(key) === aliasTarget) {
        return key;
      }
    }
    for (const key of Object.keys(catalog)) {
      const n = normalizePlaceKey(key);
      if (n.includes(aliasTarget) || aliasTarget.includes(n)) {
        return key;
      }
    }
    return null;
  }
}
