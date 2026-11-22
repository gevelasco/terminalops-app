import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { destinationRateRouteTollContextKey } from '@features/clients/utils/destination-rate-route-waypoints.util';

export type RouteTollPlazaRow = {
  order: number;
  plazaKey: string;
  plazaKeySource?: 'inegi' | 'fallback';
  inegiPoint?: string;
  name: string;
  costMxn: number | null;
  /** Municipio aproximado (OSM/Photon o persistido con la tarifa). */
  municipality?: string;
  /** Estado MX (geoestado o persistido con la tarifa). */
  state?: string;
};

export type RouteTollsResult = {
  source: string;
  vehicleCode: number;
  plazas: RouteTollPlazaRow[];
  tollCount: number;
  totalOneWayMxn: number | null;
  totalRoundTripMxn: number | null;
  attribution: string;
};

export type RouteWaypointQuery = {
  lat: number;
  lon: number;
  label: string;
  searchLabel?: string;
};

export type RouteTollsQuery = {
  originLat: number;
  originLon: number;
  destinationLat: number;
  destinationLon: number;
  axleCount?: number;
  originSearch?: string;
  destinationSearch?: string;
  excludePlazaKeys?: string[];
  waypoints?: RouteWaypointQuery[];
};

type TollCacheEntry = {
  expiresAt: number;
  result: RouteTollsResult;
};

@Injectable({ providedIn: 'root' })
export class RoutingApiService {
  private readonly http = inject(HttpClient);
  private readonly tollResultCache = new Map<string, TollCacheEntry>();
  private readonly tollInflight = new Map<string, Observable<RouteTollsResult>>();
  private static readonly TOLL_CACHE_TTL_MS = 20 * 60 * 1000;

  tollPlazasForRoute(query: RouteTollsQuery): Observable<RouteTollsResult> {
    const key = this.tollQueryCacheKey(query);
    const hit = this.tollResultCache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return of(hit.result);
    }
    const pending = this.tollInflight.get(key);
    if (pending) {
      return pending;
    }
    const request$ = this.http
      .post<RouteTollsResult>(`${environment.apiUrl}/routing/toll-plazas`, query)
      .pipe(
        tap((result) => {
          this.tollResultCache.set(key, {
            expiresAt: Date.now() + RoutingApiService.TOLL_CACHE_TTL_MS,
            result,
          });
          this.tollInflight.delete(key);
        }),
        catchError((err) => {
          this.tollInflight.delete(key);
          return throwError(() => err);
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    this.tollInflight.set(key, request$);
    return request$;
  }

  private tollQueryCacheKey(query: RouteTollsQuery): string {
    const ctxKey = destinationRateRouteTollContextKey({
      originLat: query.originLat,
      originLon: query.originLon,
      destinationLat: query.destinationLat,
      destinationLon: query.destinationLon,
      originSearch: query.originSearch,
      destinationSearch: query.destinationSearch,
      waypoints: query.waypoints,
    });
    const axle = query.axleCount ?? 5;
    return `${ctxKey}|axle:${axle}`;
  }
}