import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import type { LatLon } from '@shared/services/osrm-driving-route.service';

/** Sugerencia para mostrar y guardar como texto de origen/destino. */
export interface PlaceSuggestion {
  /** Texto legible (ciudad, región, país). */
  label: string;
  lat: number;
  lon: number;
}

export type PhotonMexicanAdminLabels = {
  municipality: string;
  state: string;
};

interface PhotonFeature {
  geometry: { type: string; coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

/**
 * Geocodificación Photon (OSM) vía proxy en terminalops-api (sin CORS ni bloqueos del navegador).
 */
@Injectable({ providedIn: 'root' })
export class PhotonPlaceSearchService {
  private readonly http = inject(HttpClient);

  private readonly searchUrl = `${environment.apiUrl}/geo/photon/search`;
  private readonly reverseUrl = `${environment.apiUrl}/geo/photon/reverse`;
  private readonly reverseCache = new Map<string, PhotonMexicanAdminLabels | null>();
  private readonly searchPickCache = new Map<string, LatLon | null>();

  /** Photon solo admite `default`, `de`, `en`, `fr` (no `es`). */
  private readonly photonLang = 'default';

  /** Bounding box México (WGS84): minLon, minLat, maxLon, maxLat — acota resultados Photon. */
  private readonly mexicoBbox = '-118.5,14.5,-86.5,32.75';

  /**
   * Municipio y estado aproximados por coordenada (OSM vía Photon).
   * Caché en memoria por sesión; no usa INEGI.
   */
  reverseMexicanAdminLabels(
    lat: number,
    lon: number,
  ): Observable<PhotonMexicanAdminLabels | null> {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return of(null);
    }
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (this.reverseCache.has(key)) {
      return of(this.reverseCache.get(key) ?? null);
    }
    const params = new HttpParams()
      .set('lat', String(lat))
      .set('lon', String(lon))
      .set('lang', this.photonLang);
    return this.http
      .get<PhotonResponse>(this.reverseUrl, { params })
      .pipe(
        map((body) => {
          const features = body?.features ?? [];
          const feature = features.find((f) => this.isMexico(f.properties)) ?? features[0];
          if (!feature) {
            this.reverseCache.set(key, null);
            return null;
          }
          const p = feature.properties;
          const municipality = (
            p['city'] ??
            p['town'] ??
            p['village'] ??
            p['county'] ??
            ''
          ).trim();
          const state = (p['state'] ?? '').trim();
          if (!municipality && !state) {
            this.reverseCache.set(key, null);
            return null;
          }
          const labels: PhotonMexicanAdminLabels = {
            municipality,
            state,
          };
          this.reverseCache.set(key, labels);
          return labels;
        }),
        catchError(() => {
          this.reverseCache.set(key, null);
          return of(null);
        }),
      );
  }

  /** Primera coincidencia en México (geocodificación rápida para CP / colonia). */
  firstCoordinates(query: string): Observable<LatLon | null> {
    const q = query.trim();
    if (q.length < 3) {
      return of(null);
    }
    return this.search(q).pipe(
      map((list) =>
        list.length > 0 ? { lat: list[0].lat, lon: list[0].lon } : null,
      ),
    );
  }

  /**
   * Una consulta acotada (máx. 2 con/sin bbox). Resultados cacheados por query en sesión.
   */
  firstCoordinatesForMexicanSepomex(
    query: string,
    hints: { state: string; municipality: string; settlement: string },
  ): Observable<LatLon | null> {
    const h = {
      state: hints.state.trim(),
      municipality: hints.municipality.trim(),
      settlement: hints.settlement.trim(),
    };
    const primary = [h.settlement, h.municipality, h.state, 'México']
      .filter((x) => x.length > 0)
      .join(', ');
    const q = primary.length >= 3 ? primary : query.trim();
    if (q.length < 3) {
      return of(null);
    }
    return this.photonGetAndPick(q, h, true).pipe(
      switchMap((picked) => (picked ? of(picked) : this.photonGetAndPick(q, h, false))),
    );
  }

  /** GET Photon + scoring SEPOMex; `useBbox` acota a México (a veces 0 hits → reintentar sin bbox). */
  private photonGetAndPick(
    q: string,
    hints: { state: string; municipality: string; settlement: string },
    useBbox: boolean,
  ): Observable<LatLon | null> {
    const cacheKey = `${useBbox ? 'b' : 'o'}|${q}`;
    const cached = this.searchPickCache.get(cacheKey);
    if (cached !== undefined) {
      return of(cached);
    }
    let params = new HttpParams()
      .set('q', q)
      .set('limit', '20')
      .set('lang', this.photonLang);
    if (useBbox) {
      params = params.set('bbox', this.mexicoBbox);
    }
    return this.http.get<PhotonResponse>(this.searchUrl, { params }).pipe(
      map((res) => this.pickBestLatLonForSettlement(res.features ?? [], hints)),
      tap((picked) => this.searchPickCache.set(cacheKey, picked)),
      catchError(() => {
        this.searchPickCache.set(cacheKey, null);
        return of(null);
      }),
    );
  }

  search(query: string): Observable<PlaceSuggestion[]> {
    const q = query.trim();
    if (q.length < 2) {
      return of([]);
    }
    const params = new HttpParams()
      .set('q', q)
      .set('limit', '15')
      .set('lang', this.photonLang)
      .set('bbox', this.mexicoBbox);
    return this.http.get<PhotonResponse>(this.searchUrl, { params }).pipe(
      map((res) =>
        (res.features ?? [])
          .filter((f) => this.isMexico(f.properties))
          .map((f) => this.toSuggestion(f)),
      ),
      catchError(() => of([])),
    );
  }

  private isMexico(p: Record<string, string | undefined>): boolean {
    const cc = (p['countrycode'] ?? '').trim().toUpperCase();
    if (cc === 'MX') {
      return true;
    }
    const country = (p['country'] ?? '').toLowerCase();
    return (
      country.includes('méxico') ||
      country.includes('mexico') ||
      country === 'mx'
    );
  }

  private toSuggestion(f: PhotonFeature): PlaceSuggestion {
    const [lon, lat] = f.geometry.coordinates;
    const p = f.properties;
    return {
      label: this.formatLabel(p),
      lat,
      lon,
    };
  }

  private formatLabel(p: Record<string, string | undefined>): string {
    const name = (p['name'] ?? '').trim();
    const street = (p['street'] ?? '').trim();
    const main = name || street;
    const city = (p['city'] ?? p['town'] ?? p['village'] ?? p['county'] ?? '').trim();
    const state = (p['state'] ?? '').trim();
    const country = (p['country'] ?? '').trim();

    const parts: string[] = [];
    if (main) {
      parts.push(main);
    }
    if (city && city !== main) {
      parts.push(city);
    }
    if (state && !parts.includes(state)) {
      parts.push(state);
    }
    if (country && !parts.includes(country)) {
      parts.push(country);
    }

    const joined = parts.join(', ');
    return joined || main || city || '—';
  }

  private static normMx(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private pickBestLatLonForSettlement(
    features: PhotonFeature[],
    hints: { state: string; municipality: string; settlement: string },
  ): LatLon | null {
    const stateH = PhotonPlaceSearchService.normMx(hints.state);
    const muniH = PhotonPlaceSearchService.normMx(hints.municipality);
    const asenH = PhotonPlaceSearchService.normMx(hints.settlement);

    let best: { score: number; lat: number; lon: number } | null = null;

    for (const f of features) {
      if (!this.isMexico(f.properties)) {
        continue;
      }
      const p = f.properties;
      const st = PhotonPlaceSearchService.normMx(p['state'] ?? '');
      const cityBlob = PhotonPlaceSearchService.normMx(
        [p['city'], p['town'], p['village'], p['county']].filter(Boolean).join(' '),
      );
      const nameBlob = PhotonPlaceSearchService.normMx(
        [p['name'], p['street']].filter(Boolean).join(' '),
      );

      let score = 0;
      if (stateH && st && (st.includes(stateH) || stateH.includes(st))) {
        score += 14;
      }
      if (muniH && cityBlob && (cityBlob.includes(muniH) || muniH.includes(cityBlob))) {
        score += 10;
      }
      if (asenH && nameBlob && (nameBlob.includes(asenH) || asenH.includes(nameBlob))) {
        score += 8;
      }

      const [lon, lat] = f.geometry.coordinates;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        continue;
      }
      if (!best || score > best.score) {
        best = { score, lat, lon };
      }
    }

    if (best && best.score >= 12) {
      return { lat: best.lat, lon: best.lon };
    }

    if (stateH) {
      return null;
    }

    const fallback = features.find((x) => this.isMexico(x.properties));
    if (!fallback) {
      return null;
    }
    const [lon, lat] = fallback.geometry.coordinates;
    return { lat, lon };
  }
}