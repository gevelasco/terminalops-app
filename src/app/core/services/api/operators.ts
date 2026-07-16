import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { Operator } from '@shared/models/logistics.models';
import { mapApiOperator } from '@shared/data/api-mappers';
import {
  mapApiOperatorOperationSummary,
  type OperatorOperationSummary,
} from '@features/operators/utils/operator-operation-summary';
import { buildOperatorPatchPayload } from '@shared/utils/operator-api-payload';
import type { OperatorLinkOptionsResponse } from '@shared/models/api/api-fleet-link-options.model';
import { mapApiOperatorLinkOption } from '@shared/models/api/api-fleet-link-options.model';
import { buildFleetLinkOptionsQuery } from './fleet-link-options-query';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId, resourceByIdUrl } from './api-url';

@Injectable({ providedIn: 'root' })
export class OperatorsService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getOperatorsList(options?: { available?: boolean }): Observable<Operator[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<Record<string, unknown>[]>(
        companyResourceUrl(companyId, 'operators', { available: options?.available }),
      )
      .pipe(map((rows) => rows.map((r) => mapApiOperator(r))));
  }

  getOperatorLinkOptions(params?: {
    search?: string;
    id?: string;
    limit?: number;
  }): Observable<OperatorLinkOptionsResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    const qs = buildFleetLinkOptionsQuery(params);
    const url = `${companyResourceUrl(companyId, 'operators/link-options')}${qs ? `?${qs}` : ''}`;
    return this.http.get<Record<string, unknown>>(url).pipe(
      map((raw) => ({
        items: Array.isArray(raw['items'])
          ? (raw['items'] as Record<string, unknown>[]).map(mapApiOperatorLinkOption)
          : [],
      })),
    );
  }

  getOperatorById(id: string): Observable<Operator | null> {
    return this.http
      .get<Record<string, unknown>>(resourceByIdUrl('operators', id))
      .pipe(map((r) => mapApiOperator(r)));
  }

  getOperatorOperationSummary(
    id: string,
    periodFrom?: string,
    periodTo?: string,
  ): Observable<OperatorOperationSummary> {
    const params: Record<string, string> = {};
    if (periodFrom) params['from'] = periodFrom;
    if (periodTo) params['to'] = periodTo;
    return this.http
      .get<Record<string, unknown>>(resourceByIdUrl('operators', id, 'operation-summary'), { params })
      .pipe(map((r) => mapApiOperatorOperationSummary(r)));
  }

  confirmOperatorTripPayment(
    operatorId: string,
    tripId: string,
  ): Observable<OperatorOperationSummary> {
    return this.http
      .post<Record<string, unknown>>(
        resourceByIdUrl('operators', operatorId, `trips/${tripId}/confirm-payment`),
        {},
      )
      .pipe(map((r) => mapApiOperatorOperationSummary(r)));
  }

  revertOperatorTripPayment(
    operatorId: string,
    tripId: string,
  ): Observable<OperatorOperationSummary> {
    return this.http
      .post<Record<string, unknown>>(
        resourceByIdUrl('operators', operatorId, `trips/${tripId}/revert-payment`),
        {},
      )
      .pipe(map((r) => mapApiOperatorOperationSummary(r)));
  }

  postOperator(payload: Omit<Operator, 'id'>): Observable<Operator> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .post<Record<string, unknown>>(companyResourceUrl(companyId, 'operators'), payload)
      .pipe(map((r) => mapApiOperator(r)));
  }

  patchOperatorById(operator: Operator): Observable<Operator> {
    return this.http
      .patch<Record<string, unknown>>(
        resourceByIdUrl('operators', operator.id),
        buildOperatorPatchPayload(operator),
      )
      .pipe(map((r) => mapApiOperator(r)));
  }
}
