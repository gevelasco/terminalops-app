import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, expand, map, Observable, reduce } from 'rxjs';
import type { CancelTripPayload, CreateTripPayload } from '@shared/models/api/api-trips.model';
import type { UpdateActualSchedulePayload } from '@shared/models/api/api-trips-actual-schedule.model';
import type {
  FuelEstimateRequest,
  FuelEstimateResponse,
} from '@shared/models/api/api-trips-fuel.model';
import type { ClientCargoHistoryResponse } from '@shared/models/api/api-trips-cargo-history.model';
import type { TripLinkOptionsResponse } from '@shared/models/api/api-trips-link-options.model';
import { mapApiTripLinkOption } from '@shared/models/api/api-trips-link-options.model';
import { mapApiTripsMapResponse } from '@shared/models/api/api-trips-map.model';
import type { TripsMapResponse } from '@shared/models/api/api-trips-map.model';
import type { Trip } from '@shared/models/logistics.models';
import { mapApiTrip } from '@shared/data/api-mappers';
import { buildFleetLinkOptionsQuery } from './fleet-link-options-query';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId, resourceByIdUrl } from './api-url';

export interface TripsListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
}

export interface TripsListResponse {
  items: Trip[];
  total: number;
  page: number;
  limit: number;
}

function normalizeTripsListResponse(
  res: TripsListResponse | Record<string, unknown>[] | Record<string, unknown>,
): TripsListResponse {
  if (Array.isArray(res)) {
    const items = res.map((row) => mapApiTrip(row as Record<string, unknown>));
    return {
      items,
      total: items.length,
      page: 1,
      limit: items.length,
    };
  }

  const raw = res as TripsListResponse & { items?: unknown[] };
  const items = Array.isArray(raw.items)
    ? raw.items.map((row) =>
        mapApiTrip(row as unknown as Record<string, unknown>),
      )
    : [];

  return {
    items,
    total: typeof raw.total === 'number' ? raw.total : items.length,
    page: typeof raw.page === 'number' ? raw.page : 1,
    limit: typeof raw.limit === 'number' ? raw.limit : items.length,
  };
}

function buildTripsListParams(params?: TripsListParams): HttpParams {
  let httpParams = new HttpParams();
  if (!params) {
    return httpParams;
  }
  if (params.page != null) {
    httpParams = httpParams.set('page', String(params.page));
  }
  if (params.limit != null) {
    httpParams = httpParams.set('limit', String(params.limit));
  }
  if (params.q?.trim()) {
    httpParams = httpParams.set('q', params.q.trim());
  }
  if (params.status?.trim()) {
    httpParams = httpParams.set('status', params.status.trim());
  }
  return httpParams;
}

@Injectable({ providedIn: 'root' })
export class TripsService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  /** Exportación explícita: recorre páginas de 100 sin abrir un endpoint ilimitado. */
  getAllTrips(params: Omit<TripsListParams, 'page' | 'limit'> = {}): Observable<Trip[]> {
    const loadPage = (page: number) =>
      this.getTripsPage({ ...params, page, limit: 100 });

    return loadPage(1).pipe(
      expand((response) =>
        response.page * response.limit < response.total
          ? loadPage(response.page + 1)
          : EMPTY,
      ),
      reduce((items, response) => [...items, ...response.items], [] as Trip[]),
    );
  }

  getTripsPage(params: TripsListParams): Observable<TripsListResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<TripsListResponse>(companyResourceUrl(companyId, 'trips'), {
        params: buildTripsListParams(params),
      })
      .pipe(map((res) => normalizeTripsListResponse(res)));
  }

  /** Maniobras ligeras para vincular en formularios (código, estatus, fecha). */
  getTripLinkOptions(params?: {
    search?: string;
    id?: string;
    limit?: number;
  }): Observable<TripLinkOptionsResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    const qs = buildFleetLinkOptionsQuery(params);
    const url = `${companyResourceUrl(companyId, 'trips/link-options')}${qs ? `?${qs}` : ''}`;
    return this.http.get<Record<string, unknown>>(url).pipe(
      map((raw) => ({
        items: Array.isArray(raw['items'])
          ? (raw['items'] as Record<string, unknown>[]).map(mapApiTripLinkOption)
          : [],
      })),
    );
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
    return this.http
      .post<Record<string, unknown>>(companyResourceUrl(companyId, 'trips'), payload)
      .pipe(map((r) => mapApiTrip(r)));
  }

  postTripIncident(
    tripId: string,
    description: string,
    postedBy: string,
    isIncident = false,
  ): Observable<Trip> {
    return this.http
      .post<Record<string, unknown>>(resourceByIdUrl('trips', tripId, 'incidents'), {
        description,
        postedBy,
        isIncident,
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

  /** Soft delete (solo administrador). */
  deleteTrip(tripId: string): Observable<{ id: number; deleted: boolean }> {
    const id = tripId.trim();
    return this.http
      .delete<{ id: number; deleted: boolean }>(resourceByIdUrl('trips', id))
      .pipe(map((res) => res));
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
    return this.http.post<FuelEstimateResponse>(
      companyResourceUrl(companyId, 'trips/fuel-estimate'),
      payload,
    );
  }
}
