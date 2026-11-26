import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type RouteTollPlazaRow = {
  order: number;
  plazaKey: string;
  plazaKeySource?: 'catalog' | 'inegi' | 'fallback';
  inegiPoint?: string;
  name: string;
  section?: string | null;
  costMxn: number | null;
  /** Costos por ejes (2–9) para recalcular al cambiar ejes. */
  costsByAxle?: Record<string, number | null>;
  lat?: number;
  lng?: number;
  kmAlongRoute?: number;
  municipality?: string;
  state?: string;
};

export type TollPlazaSearchHit = {
  plazaKey: string;
  name: string;
  section: string | null;
  lat: number;
  lng: number;
  inegiPoint: string;
  costMxn: number | null;
  costsByAxle: Record<string, number | null>;
};

export type RouteWaypointQuery = {
  lat: number;
  lon: number;
  label: string;
  searchLabel?: string;
};

/** Contexto geográfico origen/destino (mapa Ver ruta). */
export type RouteTollContext = {
  originLat: number;
  originLon: number;
  destinationLat: number;
  destinationLon: number;
  originSearch?: string;
  destinationSearch?: string;
  waypoints?: RouteWaypointQuery[];
};

@Injectable({ providedIn: 'root' })
export class RoutingApiService {
  private readonly http = inject(HttpClient);

  searchTollPlazas(params: {
    q: string;
    axleCount?: number;
    limit?: number;
  }): Observable<TollPlazaSearchHit[]> {
    let httpParams = new HttpParams().set('q', params.q.trim());
    if (params.axleCount != null) {
      httpParams = httpParams.set('axleCount', String(params.axleCount));
    }
    if (params.limit != null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http
      .get<{ items: TollPlazaSearchHit[] }>(
        `${environment.apiUrl}/routing/toll-plazas/search`,
        { params: httpParams },
      )
      .pipe(map((res) => res.items ?? []));
  }
}
