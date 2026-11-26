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

export type DestinationRateRouteQuery = {
  originOperationalCenterId: string;
  postalCode?: string;
  locality?: string;
  municipalityName?: string;
  stateName?: string;
  cityMunicipality?: string;
  clientDestinationRateId?: string;
};

function routeQueryParams(params: DestinationRateRouteQuery): Record<string, string> {
  const out: Record<string, string> = {
    originOperationalCenterId: params.originOperationalCenterId.trim(),
  };
  const cp = normalizeMxPostalCodeDigits(params.postalCode ?? '');
  if (cp.length === 5) {
    out['postalCode'] = cp;
  }
  const locality = (params.locality ?? '').trim();
  if (locality) {
    out['locality'] = locality;
  }
  const municipalityName = (params.municipalityName ?? '').trim();
  if (municipalityName) {
    out['municipalityName'] = municipalityName;
  }
  const stateName = (params.stateName ?? '').trim();
  if (stateName) {
    out['stateName'] = stateName;
  }
  const cityMunicipality = (params.cityMunicipality ?? '').trim();
  if (cityMunicipality) {
    out['cityMunicipality'] = cityMunicipality;
  }
  const linked = params.clientDestinationRateId?.trim();
  if (linked) {
    out['clientDestinationRateId'] = linked;
  }
  return out;
}

@Injectable({ providedIn: 'root' })
export class DestinationRatesService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  checkDestinationRateExists(
    params: DestinationRateRouteQuery,
  ): Observable<{ exists: boolean; destinationRateId?: string }> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<{ exists: boolean; destinationRateId?: number }>(
        companyResourceUrl(
          companyId,
          'destination-rates/check-exists',
          routeQueryParams(params),
        ),
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
  matchManeuverDestinationRate(
    params: DestinationRateRouteQuery,
  ): Observable<DestinationRate | null> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<{ rate: Record<string, unknown> | null }>(
        companyResourceUrl(
          companyId,
          'destination-rates/match',
          routeQueryParams(params),
        ),
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

  patchDestinationRate(
    id: string,
    payload: UpdateDestinationRatePayload,
  ): Observable<DestinationRate> {
    return this.http
      .patch<Record<string, unknown>>(resourceByIdUrl('destination-rates', id), payload)
      .pipe(map((r) => mapApiDestinationRate(r)));
  }

  deleteDestinationRate(id: string): Observable<void> {
    return this.http.delete<void>(resourceByIdUrl('destination-rates', id));
  }
}
