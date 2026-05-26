import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { Expense } from '@shared/models/logistics.models';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId } from './api-url';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getExpensesList(): Observable<Expense[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http.get<Expense[]>(companyResourceUrl(companyId, 'expenses')).pipe(
      map((rows) =>
        rows.map((e) => ({
          ...e,
          tripId: e.tripId ?? '',
        })),
      ),
    );
  }

  postExpense(payload: Omit<Expense, 'id'>): Observable<Expense> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http.post<Expense>(companyResourceUrl(companyId, 'expenses'), {
      ...payload,
      incurredAt: payload.incurredAt,
    });
  }
}
