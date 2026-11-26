import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, concat, defer, of, timer } from 'rxjs';
import { catchError, concatMap, ignoreElements, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { isValidLatLon } from '@shared/services/lat-lon';
import {
  downsampleOsrmCoordinates,
  osrmRouteCacheKey,
  osrmRouteThroughCacheKey,
  parseOsrmDrivingRoute,
  type OsrmDrivingRouteResult,
  type OsrmLngLat,
  type OsrmRouteResponse,
} from '@shared/services/osrm-driving-route.util';

export interface LatLon {
  lat: number;
  lon: number;
}

export type { OsrmDrivingRouteResult, OsrmLngLat };
export { isValidLatLon } from '@shared/services/lat-lon';

/** Demo público: no más de ~1 petición por segundo. */
const OSRM_MIN_INTERVAL_MS = 1100;
/** v2: ya no se fuerza la ruta por casetas; invalida cachés viejas (~345 km erróneos). */
const SESSION_CACHE_PREFIX = 'to.osrm.route.v2:';

type QueuedOsrmJob = {
  fetch: () => Observable<OsrmDrivingRouteResult | null>;
  settle: (result: OsrmDrivingRouteResult | null) => void;
};

/**
 * Distancia y geometría por carretera usando la demo pública **OSRM**.
 * Sin API key; uso razonable · servidor demo sin SLA.
 * @see https://project-osrm.org/
 */
@Injectable({ providedIn: 'root' })
export class OsrmDrivingRouteService {
  private readonly http = inject(HttpClient);

  /** Instancia pública (coordenadas lon,lat en el path según especificación OSRM). */
  private readonly base =
    'https://router.project-osrm.org/route/v1/driving';

  private readonly memoryCache = new Map<string, OsrmDrivingRouteResult>();
  private readonly inflight = new Map<
    string,
    Observable<OsrmDrivingRouteResult | null>
  >();
  private readonly jobs = new Subject<QueuedOsrmJob>();

  constructor() {
    this.jobs
      .pipe(
        concatMap((job) =>
          concat(
            defer(() => job.fetch()).pipe(
              catchError((error) => {
                if (!environment.production) {
                  console.error('[Trips][OSRM][Error]', error);
                }
                return of(null);
              }),
              tap((result) => job.settle(result)),
              ignoreElements(),
            ),
            timer(OSRM_MIN_INTERVAL_MS).pipe(ignoreElements()),
          ),
        ),
      )
      .subscribe();
  }

  /**
   * Kilómetros aproximados por la red vial.
   * `null` si no hay ruta o error de red.
   */
  drivingKm(from: LatLon, to: LatLon): Observable<number | null> {
    return this.drivingRoute(from, to).pipe(map((route) => route?.km ?? null));
  }

  /**
   * Ruta de manejo: km + polilínea [lon, lat] para dibujar sobre el mapa.
   * Reutiliza caché de memoria/sesión; las peticiones nuevas van en cola (1/s).
   */
  /** Ruta por carretera pasando por todos los puntos en orden (aprox.). */
  drivingRouteThrough(
    points: readonly LatLon[],
  ): Observable<OsrmDrivingRouteResult | null> {
    if (points.length < 2) {
      return of(null);
    }
    for (const p of points) {
      if (!isValidLatLon(p)) {
        return of(null);
      }
    }
    const key = `through:${osrmRouteThroughCacheKey(points)}`;
    const cached = this.memoryCache.get(key) ?? this.readSessionCache(key);
    if (cached) {
      this.memoryCache.set(key, cached);
      return of(cached);
    }
    const pending = this.inflight.get(key);
    if (pending) {
      return pending;
    }
    const request$ = this.enqueue(() => this.fetchRouteThrough(points)).pipe(
      tap((route) => {
        if (route) {
          this.writeCache(key, route);
        }
        this.inflight.delete(key);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.inflight.set(key, request$);
    return request$;
  }

  drivingRoute(
    from: LatLon,
    to: LatLon,
  ): Observable<OsrmDrivingRouteResult | null> {
    if (!isValidLatLon(from) || !isValidLatLon(to)) {
      if (!environment.production) {
        console.warn('[Trips][OSRM][Skip] Coordenadas inválidas', { from, to });
      }
      return of(null);
    }

    const key = osrmRouteCacheKey(from, to);
    const cached = this.memoryCache.get(key) ?? this.readSessionCache(key);
    if (cached) {
      this.memoryCache.set(key, cached);
      return of(cached);
    }

    const pending = this.inflight.get(key);
    if (pending) {
      return pending;
    }

    const request$ = this.enqueue(() => this.fetchRoute(from, to)).pipe(
      tap((route) => {
        if (route) {
          this.writeCache(key, route);
        }
        this.inflight.delete(key);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.inflight.set(key, request$);
    return request$;
  }

  private enqueue(
    fetch: () => Observable<OsrmDrivingRouteResult | null>,
  ): Observable<OsrmDrivingRouteResult | null> {
    return new Observable((subscriber) => {
      this.jobs.next({
        fetch,
        settle: (result) => {
          subscriber.next(result);
          subscriber.complete();
        },
      });
    });
  }

  private fetchRouteThrough(
    points: readonly LatLon[],
  ): Observable<OsrmDrivingRouteResult | null> {
    const path = points.map((p) => `${p.lon},${p.lat}`).join(';');
    const url = `${this.base}/${path}`;
    const params = new HttpParams()
      .set('overview', 'simplified')
      .set('geometries', 'geojson')
      .set('alternatives', 'true')
      .set('steps', 'false')
      .set('generate_hints', 'false');

    return this.http.get<OsrmRouteResponse>(url, { params }).pipe(
      map((res) => {
        const parsed = parseOsrmDrivingRoute(res);
        if (!parsed) {
          return null;
        }
        return {
          km: parsed.km,
          coordinates: downsampleOsrmCoordinates(parsed.coordinates),
        };
      }),
    );
  }

  private fetchRoute(
    from: LatLon,
    to: LatLon,
  ): Observable<OsrmDrivingRouteResult | null> {
    if (!environment.production) {
      console.log('[Trips][OSRM][Request]', {
        originLat: from.lat,
        originLng: from.lon,
        destinationLat: to.lat,
        destinationLng: to.lon,
      });
    }

    const path = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    const url = `${this.base}/${path}`;
    const params = new HttpParams()
      .set('overview', 'full')
      .set('geometries', 'geojson')
      .set('alternatives', 'true')
      .set('steps', 'false')
      .set('generate_hints', 'false');

    return this.http.get<OsrmRouteResponse>(url, { params }).pipe(
      tap((res) => {
        if (!environment.production) {
          console.log('[Trips][OSRM][Response]', res);
        }
      }),
      map((res) => {
        const parsed = parseOsrmDrivingRoute(res);
        if (!parsed) {
          return null;
        }
        return {
          km: parsed.km,
          coordinates: downsampleOsrmCoordinates(parsed.coordinates),
        };
      }),
    );
  }

  private writeCache(key: string, route: OsrmDrivingRouteResult): void {
    this.memoryCache.set(key, route);
    this.writeSessionCache(key, route);
  }

  private readSessionCache(key: string): OsrmDrivingRouteResult | null {
    try {
      const raw = sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<OsrmDrivingRouteResult>;
      if (
        typeof parsed.km !== 'number' ||
        !Number.isFinite(parsed.km) ||
        !Array.isArray(parsed.coordinates)
      ) {
        return null;
      }
      const coordinates = parsed.coordinates.filter(
        (pair): pair is OsrmLngLat =>
          Array.isArray(pair) &&
          pair.length >= 2 &&
          Number.isFinite(pair[0]) &&
          Number.isFinite(pair[1]),
      );
      if (coordinates.length < 2) {
        return { km: parsed.km, coordinates: [] };
      }
      return { km: parsed.km, coordinates };
    } catch {
      return null;
    }
  }

  private writeSessionCache(key: string, route: OsrmDrivingRouteResult): void {
    try {
      sessionStorage.setItem(SESSION_CACHE_PREFIX + key, JSON.stringify(route));
    } catch {
      /* quota / private mode */
    }
  }
}
