import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface LatLon {
  lat: number;
  lon: number;
}

interface OsrmRouteResponse {
  code: string;
  routes?: Array<{ distance: number; duration: number }>;
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
        if (res.code !== 'Ok' || !res.routes?.[0]) {
          return null;
        }
        const meters = res.routes[0].distance;
        if (typeof meters !== 'number' || !Number.isFinite(meters)) {
          return null;
        }
        const km = meters / 1000;
        return Math.round(km * 10) / 10;
      }),
      catchError(() => of(null)),
    );
  }
}
