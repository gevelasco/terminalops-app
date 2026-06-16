import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { CancelTripPayload, CreateTripPayload } from '@shared/models/api/api-trips.model';
import type { UpdateActualSchedulePayload } from '@shared/models/api/api-trips-actual-schedule.model';
import type {
  FuelEstimateRequest,
  FuelEstimateResponse,
} from '@shared/models/api/api-trips-fuel.model';
import type { ClientCargoHistoryResponse } from '@shared/models/api/api-trips-cargo-history.model';
import type { TripsMapResponse } from '@shared/models/api/api-trips-map.model';
import { mapApiTripsMapResponse } from '@shared/models/api/api-trips-map.model';
import type { Trip } from '@shared/models/logistics.models';
import { mapApiTrip } from '@shared/data/api-mappers';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId, resourceByIdUrl } from './api-url';

@Injectable({ providedIn: 'root' })
export class TripsService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getTripsList(): Observable<Trip[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<Record<string, unknown>[]>(companyResourceUrl(companyId, 'trips'))
      .pipe(map((rows) => rows.map((r) => mapApiTrip(r))));
  }

  getTripsMap(): Observable<TripsMapResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<Record<string, unknown>>(companyResourceUrl(companyId, 'trips/map'))
      .pipe(map((raw) => mapApiTripsMapResponse(raw)));
  }

  getTripById(id: string): Observable<Trip | undefined> {
    return this.http
      .get<Record<string, unknown>>(resourceByIdUrl('trips', id))
      .pipe(map((r) => mapApiTrip(r)));
  }

  postTrip(payload: CreateTripPayload): Observable<Trip> {
    const companyId = requireCompanyId(this.session.companyId());
    const body = {
      ...payload,
      status: 'scheduled',
    };
    return this.http
      .post<Record<string, unknown>>(companyResourceUrl(companyId, 'trips'), body)
      .pipe(map((r) => mapApiTrip(r)));
  }

  postTripIncident(
    tripId: string,
    description: string,
    postedBy: string,
  ): Observable<Trip> {
    return this.http
      .post<Record<string, unknown>>(resourceByIdUrl('trips', tripId, 'incidents'), {
        description,
        postedBy,
      })
      .pipe(map((r) => mapApiTrip(r)));
  }

  postTripCancel(tripId: string, payload: CancelTripPayload): Observable<Trip> {
    return this.http
      .post<Record<string, unknown>>(resourceByIdUrl('trips', tripId, 'cancel'), payload)
      .pipe(map((r) => mapApiTrip(r)));
  }

  patchTripClientCollected(tripId: string, collected: boolean): Observable<Trip> {
    return this.http
      .patch<Record<string, unknown>>(resourceByIdUrl('trips', tripId, 'client-collected'), {
        collected,
      })
      .pipe(map((r) => mapApiTrip(r)));
  }

  patchTripActualSchedule(
    tripId: string,
    payload: UpdateActualSchedulePayload,
  ): Observable<Trip> {
    return this.http
      .patch<Record<string, unknown>>(
        resourceByIdUrl('trips', tripId, 'actual-schedule'),
        payload,
      )
      .pipe(map((r) => mapApiTrip(r)));
  }

  getClientCargoHistory(clientId: string): Observable<ClientCargoHistoryResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    const id = clientId.trim();
    return this.http.get<ClientCargoHistoryResponse>(
      companyResourceUrl(companyId, `clients/${encodeURIComponent(id)}/cargo-history`),
    );
  }

  /** Estimación operativa de diesel (heurística en backend). */
  estimateFuelConsumption(payload: FuelEstimateRequest): Observable<FuelEstimateResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    console.log('[Trips][FuelEstimate][Request]', payload);
    return this.http
      .post<FuelEstimateResponse>(
        companyResourceUrl(companyId, 'trips/fuel-estimate'),
        payload,
      )
      .pipe(
        map((res) => {
          console.log('[Trips][FuelEstimate][Response]', res);
          return res;
        }),
      );
  }
}
