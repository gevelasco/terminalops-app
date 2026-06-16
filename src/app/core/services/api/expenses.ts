import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { Expense } from '@shared/models/logistics.models';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId } from './api-url';

function normalizeExpensePublicId(value: unknown): string {
  if (value == null || value === '') {
    return '';
  }
  return String(value).trim();
}

function mapApiExpenseRow(row: Expense): Expense {
  const amountRaw = row.amount as unknown;
  const amount =
    typeof amountRaw === 'number'
      ? amountRaw
      : Number(String(amountRaw ?? '').replace(/,/g, '')) || 0;

  return {
    ...row,
    id: normalizeExpensePublicId(row.id),
    tripId: normalizeExpensePublicId(row.tripId),
    amount,
    ...(row.relatedUnitId != null && row.relatedUnitId !== ''
      ? { relatedUnitId: normalizeExpensePublicId(row.relatedUnitId) }
      : {}),
    ...(row.relatedEquipmentId != null && row.relatedEquipmentId !== ''
      ? { relatedEquipmentId: normalizeExpensePublicId(row.relatedEquipmentId) }
      : {}),
    ...(row.relatedOperatorId != null && row.relatedOperatorId !== ''
      ? { relatedOperatorId: normalizeExpensePublicId(row.relatedOperatorId) }
      : {}),
  };
}

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getExpensesList(): Observable<Expense[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http.get<Expense[]>(companyResourceUrl(companyId, 'expenses')).pipe(
      map((rows) => rows.map((e) => mapApiExpenseRow(e))),
    );
  }

  postExpense(payload: Omit<Expense, 'id'>): Observable<Expense> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .post<Expense>(companyResourceUrl(companyId, 'expenses'), {
        ...payload,
        incurredAt: payload.incurredAt,
      })
      .pipe(map((e) => mapApiExpenseRow(e)));
  }
}
