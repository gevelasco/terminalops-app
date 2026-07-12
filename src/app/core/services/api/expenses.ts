import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { Expense } from '@shared/models/logistics.models';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId, resourceByIdUrl } from './api-url';

export interface ExpensesListParams {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  q?: string;
  kind?: string;
  relatedUnitId?: string;
  relatedEquipmentId?: string;
  tripId?: string;
  tripIds?: string;
}

export interface ExpensesListResponse {
  items: Expense[];
  total: number;
  page: number;
  limit: number;
  totalAmount: string | number;
}

export interface ExpensesCalendarParams {
  from: string;
  to: string;
  page?: number;
  limit?: number;
}

export type ExpenseCalendarEntryType = 'actual' | 'projected';

export interface ExpenseCalendarProjectedRow {
  id: string;
  source: string;
  nature: 'committed' | 'scheduled';
  kind: string;
  rubroLabel: string;
  conceptLabel: string;
  amount: string | number;
  currency: string;
  dueDate: string;
  tripId: number | null;
  tripManeuverCode?: string;
  relatedUnitId: number | null;
  relatedEquipmentId: number | null;
  relatedOperatorId: number | null;
  fleetRelationLabel?: string;
  relatedUnitLabel?: string;
  relatedEquipmentLabel?: string;
  relatedOperatorLabel?: string;
  verificationScope?: string;
  paymentMethod?: string;
  vendor?: string;
  invoiceRequired?: boolean;
  hint: string;
}

export interface ExpenseCalendarItem {
  entryType: ExpenseCalendarEntryType;
  sortDate: string;
  id: string;
  rubroLabel: string;
  conceptLabel: string;
  amount: string | number;
  currency: string;
  dateYmd: string;
  statusLabel: string;
  expenseId?: number;
  expense?: Expense;
  projected?: ExpenseCalendarProjectedRow;
}

export interface ExpenseCalendarMarker {
  label: string;
  amount: string | number;
  pct: number;
  tone: 'primary' | 'muted' | 'accent';
}

export interface ExpensesCalendarSummary {
  actualCount: number;
  actualTotalAmount: string | number;
  projectedCount: number;
  projectedTotalAmount: string | number;
  grandCount: number;
  grandTotalAmount: string | number;
}

export interface ExpensesCalendarResponse {
  from: string;
  to: string;
  items: ExpenseCalendarItem[];
  total: number;
  page: number;
  limit: number;
  markers: ExpenseCalendarMarker[];
  summary: ExpensesCalendarSummary;
}

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
    tripManeuverCode:
      typeof row.tripManeuverCode === 'string' && row.tripManeuverCode.trim()
        ? row.tripManeuverCode.trim()
        : undefined,
    fleetRelationLabel:
      typeof row.fleetRelationLabel === 'string' && row.fleetRelationLabel.trim()
        ? row.fleetRelationLabel.trim()
        : undefined,
    relatedUnitLabel:
      typeof row.relatedUnitLabel === 'string' && row.relatedUnitLabel.trim()
        ? row.relatedUnitLabel.trim()
        : undefined,
    relatedEquipmentLabel:
      typeof row.relatedEquipmentLabel === 'string' &&
      row.relatedEquipmentLabel.trim()
        ? row.relatedEquipmentLabel.trim()
        : undefined,
    relatedOperatorLabel:
      typeof row.relatedOperatorLabel === 'string' &&
      row.relatedOperatorLabel.trim()
        ? row.relatedOperatorLabel.trim()
        : undefined,
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

function parseMoneyAmount(raw: string | number | undefined): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  return Number(String(raw ?? '').replace(/,/g, '')) || 0;
}

function mapExpensesCalendarResponse(res: ExpensesCalendarResponse): ExpensesCalendarResponse {
  return {
    ...res,
    items: res.items.map((item) => ({
      ...item,
      amount: parseMoneyAmount(item.amount),
      expense: item.expense ? mapApiExpenseRow(item.expense) : undefined,
    })),
    markers: res.markers.map((marker) => ({
      ...marker,
      amount: parseMoneyAmount(marker.amount),
    })),
    summary: {
      ...res.summary,
      actualTotalAmount: parseMoneyAmount(res.summary.actualTotalAmount),
      projectedTotalAmount: parseMoneyAmount(res.summary.projectedTotalAmount),
      grandTotalAmount: parseMoneyAmount(res.summary.grandTotalAmount),
    },
  };
}

function mapExpensesListResponse(res: ExpensesListResponse): ExpensesListResponse {
  const totalAmountRaw = res.totalAmount as unknown;
  const totalAmount =
    typeof totalAmountRaw === 'number'
      ? totalAmountRaw
      : Number(String(totalAmountRaw ?? '').replace(/,/g, '')) || 0;

  return {
    ...res,
    totalAmount,
    items: res.items.map((e) => mapApiExpenseRow(e)),
  };
}

function buildExpensesListParams(params?: ExpensesListParams): HttpParams {
  let httpParams = new HttpParams();
  if (!params) {
    return httpParams;
  }
  if (params.from) {
    httpParams = httpParams.set('from', params.from);
  }
  if (params.to) {
    httpParams = httpParams.set('to', params.to);
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
  if (params.kind?.trim()) {
    httpParams = httpParams.set('kind', params.kind.trim());
  }
  if (params.relatedUnitId?.trim()) {
    httpParams = httpParams.set('relatedUnitId', params.relatedUnitId.trim());
  }
  if (params.relatedEquipmentId?.trim()) {
    httpParams = httpParams.set('relatedEquipmentId', params.relatedEquipmentId.trim());
  }
  if (params.tripId?.trim()) {
    httpParams = httpParams.set('tripId', params.tripId.trim());
  }
  if (params.tripIds?.trim()) {
    httpParams = httpParams.set('tripIds', params.tripIds.trim());
  }
  return httpParams;
}

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  /** Listado completo (reportes, drawers). */
  getExpensesList(): Observable<Expense[]> {
    return this.getExpensesPage({ limit: 0 }).pipe(map((r) => r.items));
  }

  getExpensesPage(params: ExpensesListParams): Observable<ExpensesListResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<ExpensesListResponse>(companyResourceUrl(companyId, 'expenses'), {
        params: buildExpensesListParams(params),
      })
      .pipe(map((res) => mapExpensesListResponse(res)));
  }

  getExpenseById(id: string): Observable<Expense> {
    const expenseId = id.trim();
    return this.http
      .get<Expense>(resourceByIdUrl('expenses', expenseId))
      .pipe(map((e) => mapApiExpenseRow(e)));
  }

  getExpensesCalendar(params: ExpensesCalendarParams): Observable<ExpensesCalendarResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    let httpParams = new HttpParams()
      .set('from', params.from)
      .set('to', params.to);
    if (params.page != null) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.limit != null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http
      .get<ExpensesCalendarResponse>(companyResourceUrl(companyId, 'expenses/calendar'), {
        params: httpParams,
      })
      .pipe(map((res) => mapExpensesCalendarResponse(res)));
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

  patchExpense(id: string, payload: Partial<Omit<Expense, 'id'>>): Observable<Expense> {
    const expenseId = id.trim();
    return this.http
      .patch<Expense>(resourceByIdUrl('expenses', expenseId), {
        ...payload,
        ...(payload.incurredAt != null ? { incurredAt: payload.incurredAt } : {}),
      })
      .pipe(map((e) => mapApiExpenseRow(e)));
  }

  deleteExpense(id: string): Observable<{ id: string; deleted: boolean }> {
    const expenseId = id.trim();
    return this.http.delete<{ id: string | number; deleted: boolean }>(
      resourceByIdUrl('expenses', expenseId),
    ).pipe(
      map((res) => ({
        id: normalizeExpensePublicId(res.id),
        deleted: res.deleted === true,
      })),
    );
  }
}
