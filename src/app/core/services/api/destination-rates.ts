import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';
import { mapApiDestinationRate } from '@shared/data/destination-rate-api-mapper';
import type {
  CreateDestinationRatePayload,
  DestinationRate,
  UpdateDestinationRatePayload,
} from '@shared/models/destination-rate.models';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId, resourceByIdUrl } from './api-url';

@Injectable({ providedIn: 'root' })
export class DestinationRatesService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  checkDestinationRateExists(params: {
    originOperationalCenterId: string;
    postalCode: string;
    locality: string;
  }): Observable<{ exists: boolean; destinationRateId?: string }> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<{ exists: boolean; destinationRateId?: number }>(
        companyResourceUrl(companyId, 'destination-rates/check-exists', {
          originOperationalCenterId: params.originOperationalCenterId.trim(),
          postalCode: normalizeMxPostalCodeDigits(params.postalCode),
          locality: params.locality.trim(),
        }),
      )
      .pipe(
        map((res) => ({
          exists: res.exists,
          destinationRateId:
            res.destinationRateId != null ? String(res.destinationRateId) : undefined,
        })),
      );
  }

  /** Match fino para nueva maniobra: evita descargar el catálogo completo de tarifas. */
  matchManeuverDestinationRate(params: {
    originOperationalCenterId: string;
    postalCode: string;
    locality: string;
    clientDestinationRateId?: string;
  }): Observable<DestinationRate | null> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<{ rate: Record<string, unknown> | null }>(
        companyResourceUrl(companyId, 'destination-rates/match', {
          originOperationalCenterId: params.originOperationalCenterId.trim(),
          postalCode: normalizeMxPostalCodeDigits(params.postalCode),
          locality: params.locality.trim(),
          ...(params.clientDestinationRateId?.trim()
            ? { clientDestinationRateId: params.clientDestinationRateId.trim() }
            : {}),
        }),
      )
      .pipe(map((res) => (res.rate ? mapApiDestinationRate(res.rate) : null)));
  }

  getDestinationRateById(id: string): Observable<DestinationRate> {
    return this.http
      .get<Record<string, unknown>>(resourceByIdUrl('destination-rates', id))
      .pipe(map((r) => mapApiDestinationRate(r)));
  }

  getDestinationRatesList(): Observable<DestinationRate[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<Record<string, unknown>[]>(
        companyResourceUrl(companyId, 'destination-rates'),
      )
      .pipe(map((rows) => rows.map((r) => mapApiDestinationRate(r))));
  }

  postDestinationRate(
    payload: CreateDestinationRatePayload,
  ): Observable<DestinationRate> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .post<Record<string, unknown>>(
        companyResourceUrl(companyId, 'destination-rates'),
        payload,
      )
      .pipe(map((r) => mapApiDestinationRate(r)));
  }

  patchDestinationRateById(
    rate: DestinationRate,
    patch: UpdateDestinationRatePayload,
  ): Observable<DestinationRate> {
    return this.http
      .patch<Record<string, unknown>>(
        resourceByIdUrl('destination-rates', rate.id),
        patch,
      )
      .pipe(map((r) => mapApiDestinationRate(r)));
  }

  deleteDestinationRateById(id: string): Observable<{ id: string; deleted: boolean }> {
    return this.http
      .delete<{ id: number; deleted: boolean }>(
        resourceByIdUrl('destination-rates', id),
      )
      .pipe(
        map((r) => ({
          id: String(r.id),
          deleted: r.deleted,
        })),
      );
  }
}
