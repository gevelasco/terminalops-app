import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import type { LatLon } from '@shared/services/osrm-driving-route.service';

/** Sugerencia para mostrar y guardar como texto de origen/destino. */
export interface PlaceSuggestion {
  /** Texto legible (ciudad, región, país). */
  label: string;
  lat: number;
  lon: number;
}

interface PhotonFeature {
  geometry: { type: string; coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

/**
 * Búsqueda de lugares vía API pública Photon (datos OpenStreetMap).
 * Sin API key; uso razonable según política del servidor público (no para alto volumen).
 * @see https://photon.komoot.io
 */
@Injectable({ providedIn: 'root' })
export class PhotonPlaceSearchService {
  private readonly http = inject(HttpClient);

  private readonly endpoint = 'https://photon.komoot.io/api/';

  /** Photon solo admite `default`, `de`, `en`, `fr` (no `es`). */
  private readonly photonLang = 'default';

  /** Bounding box México (WGS84): minLon, minLat, maxLon, maxLat — acota resultados Photon. */
  private readonly mexicoBbox = '-118.5,14.5,-86.5,32.75';

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
   * Geocodificación acotada a SEPOMex: elige el hit de Photon que mejor coincida
   * con estado, municipio y nombre de asentamiento (evita homónimos y el primer
   * resultado irrelevante).
   */
  firstCoordinatesForMexicanSepomex(
    query: string,
    hints: { state: string; municipality: string; settlement: string },
  ): Observable<LatLon | null> {
    const q = query.trim();
    if (q.length < 3) {
      return of(null);
    }
    const h = {
      state: hints.state.trim(),
      municipality: hints.municipality.trim(),
      settlement: hints.settlement.trim(),
    };
    const qColoniaMuni = [h.settlement, h.municipality, h.state, 'México']
      .filter((x) => x.length > 0)
      .join(', ');
    const qMuniState = [h.municipality, h.state, 'México']
      .filter((x) => x.length > 0)
      .join(', ');

    return this.photonGetAndPick(q, h, true).pipe(
      switchMap((picked) => (picked ? of(picked) : this.photonGetAndPick(q, h, false))),
      switchMap((picked) => {
        if (picked || qColoniaMuni.length < 3 || qColoniaMuni === q) {
          return of(picked);
        }
        return this.photonGetAndPick(qColoniaMuni, h, true).pipe(
          switchMap((p2) =>
            p2 ? of(p2) : this.photonGetAndPick(qColoniaMuni, h, false),
          ),
        );
      }),
      switchMap((picked) => {
        if (picked || qMuniState.length < 3 || qMuniState === qColoniaMuni) {
          return of(picked);
        }
        return this.photonGetAndPick(qMuniState, h, true).pipe(
          switchMap((p3) =>
            p3 ? of(p3) : this.photonGetAndPick(qMuniState, h, false),
          ),
        );
      }),
    );
  }

  /** GET Photon + scoring SEPOMex; `useBbox` acota a México (a veces 0 hits → reintentar sin bbox). */
  private photonGetAndPick(
    q: string,
    hints: { state: string; municipality: string; settlement: string },
    useBbox: boolean,
  ): Observable<LatLon | null> {
    let params = new HttpParams()
      .set('q', q)
      .set('limit', '20')
      .set('lang', this.photonLang);
    if (useBbox) {
      params = params.set('bbox', this.mexicoBbox);
    }
    return this.http.get<PhotonResponse>(this.endpoint, { params }).pipe(
      map((res) => this.pickBestLatLonForSettlement(res.features ?? [], hints)),
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
    return this.http.get<PhotonResponse>(this.endpoint, { params }).pipe(
      map((res) =>
        (res.features ?? [])
          .filter((f) => this.isMexico(f.properties))
          .map((f) => this.toSuggestion(f)),
      ),
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

    const fallback = features.find((x) => this.isMexico(x.properties));
    if (!fallback) {
      return null;
    }
    const [lon, lat] = fallback.geometry.coordinates;
    return { lat, lon };
  }
}
