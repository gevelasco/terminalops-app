import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { coordsMatchMexicanStateHint } from '@features/clients/utils/destination-rate-state-resolve.util';
import type { MexicoStatesGeoJson } from '@features/trips/utils/trips-map-state-activity';
import type { LatLon } from '@shared/services/osrm-driving-route.service';
import { isValidLatLon } from '@shared/services/lat-lon';

@Injectable({ providedIn: 'root' })
export class MexicoGeoStateService {
  private readonly http = inject(HttpClient);

  private geoJson: MexicoStatesGeoJson | null = null;
  private geoLoad: Promise<MexicoStatesGeoJson | null> | null = null;

  preload(): void {
    void this.whenReady().subscribe();
  }

  cachedGeoJson(): MexicoStatesGeoJson | null {
    return this.geoJson;
  }

  whenReady(): Observable<MexicoStatesGeoJson | null> {
    if (this.geoJson) {
      return of(this.geoJson);
    }
    if (!this.geoLoad) {
      this.geoLoad = new Promise((resolve) => {
        this.http
          .get<MexicoStatesGeoJson>('/geo/mexico-states.json')
          .subscribe({
            next: (geo) => {
              this.geoJson = geo;
              resolve(geo);
            },
            error: () => resolve(null),
          });
      });
    }
    return new Observable((subscriber) => {
      void this.geoLoad!.then((geo) => {
        subscriber.next(geo);
        subscriber.complete();
      });
    });
  }

  coordsMatchStateHint(
    point: LatLon | null | undefined,
    stateHint: string,
    geo?: MexicoStatesGeoJson | null,
  ): boolean {
    if (!isValidLatLon(point)) {
      return false;
    }
    const json = geo ?? this.geoJson;
    if (!json) {
      return true;
    }
    return coordsMatchMexicanStateHint(
      point.lat,
      point.lon,
      stateHint,
      json,
    );
  }
}