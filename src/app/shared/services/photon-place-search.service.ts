import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

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

  /** Bounding box México (WGS84): minLon, minLat, maxLon, maxLat — acota resultados Photon. */
  private readonly mexicoBbox = '-118.5,14.5,-86.5,32.75';

  search(query: string): Observable<PlaceSuggestion[]> {
    const q = query.trim();
    if (q.length < 2) {
      return of([]);
    }
    const params = new HttpParams()
      .set('q', q)
      .set('limit', '15')
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
}
