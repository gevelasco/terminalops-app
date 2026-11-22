import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import type { RouteTollPlazaRow } from '@core/services/api/routing';
import { latLonFromTollPlazaRow } from '@features/clients/utils/destination-rate-inegi-point.util';
import {
  tollPlazaRowsWithInferredMunicipality,
  tollPlazaRowsWithStateFromGeo,
} from '@features/clients/utils/destination-rate-toll-plaza-place.util';
import { enrichTollPlazaRowForMap } from '@features/clients/utils/destination-rate-route-toll-plazas.util';
import { MexicoGeoStateService } from '@shared/services/mexico-geo-state.service';

/**
 * Estado MX de casetas por coordenadas + `mexico-states.json` (local, sin red salvo el GeoJSON).
 */
@Injectable({ providedIn: 'root' })
export class TollPlazaPlaceLabelService {
  private readonly mexicoGeo = inject(MexicoGeoStateService);

  preloadMexicoGeo(): void {
    this.mexicoGeo.preload();
  }

  withStateFromGeo(rows: readonly RouteTollPlazaRow[]): RouteTollPlazaRow[] {
    const normalized = rows.map((row) => enrichTollPlazaRowForMap(row));
    const geo = this.mexicoGeo.cachedGeoJson();
    const withState = geo
      ? tollPlazaRowsWithStateFromGeo(normalized, geo)
      : normalized;
    return tollPlazaRowsWithInferredMunicipality(withState);
  }

  enrichPlazas(rows: readonly RouteTollPlazaRow[]): Observable<RouteTollPlazaRow[]> {
    if (rows.length === 0) {
      return of([]);
    }
    return this.mexicoGeo.whenReady().pipe(
      map(() => this.withStateFromGeo(rows)),
    );
  }

  rowsNeedStateFromGeo(rows: readonly RouteTollPlazaRow[]): boolean {
    return rows.some((row) => {
      if (row.state?.trim()) {
        return false;
      }
      return latLonFromTollPlazaRow(enrichTollPlazaRowForMap(row)) != null;
    });
  }
}