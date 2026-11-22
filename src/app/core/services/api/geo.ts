import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import type { LatLon } from '@shared/services/osrm-driving-route.service';
import { isValidLatLon } from '@shared/services/lat-lon';

export type MxSettlementGeocodeQuery = {
  postalCode: string;
  settlement?: string;
  municipality?: string;
  state?: string;
};

@Injectable({ providedIn: 'root' })
export class GeoApiService {
  private readonly http = inject(HttpClient);

  /** Coordenadas por CP + asentamiento (API propia; no depende de Photon). */
  settlementCoordinates(query: MxSettlementGeocodeQuery): Observable<LatLon | null> {
    const cp = query.postalCode.replace(/\D/g, '').slice(0, 5);
    if (cp.length !== 5) {
      return of(null);
    }
    let params = new HttpParams().set('postalCode', cp);
    const settlement = query.settlement?.trim();
    const municipality = query.municipality?.trim();
    const state = query.state?.trim();
    if (settlement) {
      params = params.set('settlement', settlement);
    }
    if (municipality) {
      params = params.set('municipality', municipality);
    }
    if (state) {
      params = params.set('state', state);
    }
    return this.http
      .get<{ lat: number | null; lon: number | null }>(
        `${environment.apiUrl}/geo/mx/settlement-coordinates`,
        { params },
      )
      .pipe(
        map((body) => {
          const lat = Number(body?.lat);
          const lon = Number(body?.lon);
          const point = { lat, lon };
          return isValidLatLon(point) ? point : null;
        }),
        catchError(() => of(null)),
      );
  }
}