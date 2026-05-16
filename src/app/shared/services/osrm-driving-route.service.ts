import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface LatLon {
  lat: number;
  lon: number;
}

interface OsrmRouteResponse {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    legs?: Array<{ distance?: number; duration?: number }>;
  }>;
}

/**
 * Distancia por carretera usando la demo pública **OSRM** (Open Source Routing Machine).
 * Sin API key; uso razonable · servidor demo sin SLA.
 * @see https://project-osrm.org/
 */
@Injectable({ providedIn: 'root' })
export class OsrmDrivingRouteService {
  private readonly http = inject(HttpClient);

  /** Instancia pública (coordenadas lon,lat en el path según especificación OSRM). */
  private readonly base =
    'https://router.project-osrm.org/route/v1/driving';

  /**
   * Devuelve kilómetros aproximados por la red vial modelada (camión/auto según perfil del servidor).
   * `null` si no hay ruta o error de red.
   */
  drivingKm(from: LatLon, to: LatLon): Observable<number | null> {
    const path = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    const url = `${this.base}/${path}`;
    const params = new HttpParams().set('overview', 'false');
    return this.http.get<OsrmRouteResponse>(url, { params }).pipe(
      map((res) => {
        const code = (res.code ?? '').trim();
        if (code.toLowerCase() !== 'ok' || !res.routes?.[0]) {
          return null;
        }
        const route = res.routes[0];
        const rawMeters =
          typeof route.distance === 'number'
            ? route.distance
            : typeof route.legs?.[0]?.distance === 'number'
              ? route.legs[0].distance
              : Number(route.distance ?? route.legs?.[0]?.distance);
        if (!Number.isFinite(rawMeters)) {
          return null;
        }
        const km = rawMeters / 1000;
        return Math.round(km * 10) / 10;
      }),
      catchError(() => of(null)),
    );
  }
}
