import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { Operator } from '@shared/models/logistics.models';
import { mapApiOperator } from '@shared/data/api-mappers';
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

  getOperatorById(id: string): Observable<Operator | null> {
    return this.http
      .get<Record<string, unknown>>(resourceByIdUrl('operators', id))
      .pipe(map((r) => mapApiOperator(r)));
  }

  postOperator(payload: Omit<Operator, 'id'>): Observable<Operator> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .post<Record<string, unknown>>(companyResourceUrl(companyId, 'operators'), payload)
      .pipe(map((r) => mapApiOperator(r)));
  }

  patchOperatorById(operator: Operator): Observable<Operator> {
    return this.http
      .patch<Record<string, unknown>>(resourceByIdUrl('operators', operator.id), operator)
      .pipe(map((r) => mapApiOperator(r)));
  }
}
