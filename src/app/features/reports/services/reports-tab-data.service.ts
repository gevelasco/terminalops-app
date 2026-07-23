import { DestroyRef, Injectable, inject } from '@angular/core';
import {
  ExpensesService,
  type ExpenseCalendarItem,
} from '@core/services/api/expenses';
import { ReportsService } from '@core/services/api/reports';
import {
  buildDashboardUpcomingPayments,
  dashboardUpcomingPaymentsRange,
  type DashboardUpcomingPaymentRow,
} from '@features/dashboard/utils/dashboard-upcoming-payments.util';
import type { ReportsFilter } from '@features/reports/models/reports-view.models';
import type { ReportsTabId } from '@features/reports/models/reports-view.models';
import { reportsFilterCacheKey } from '@features/reports/utils/reports-filter-cache-key.util';
import type { ReportsBalanceData } from '@shared/models/api/api-reports-balance.model';
import type { ReportsFleetData } from '@shared/models/api/api-reports-fleet.model';
import type { ReportsManiobrasData } from '@shared/models/api/api-reports-maniobras.model';
import { catchError, forkJoin, map, Observable, of, shareReplay } from 'rxjs';

export type ReportsBalanceBundle = {
  balance: ReportsBalanceData;
  upcomingPayments: DashboardUpcomingPaymentRow[];
  calendarItems: ExpenseCalendarItem[];
};

type CachedStream<T> = {
  filterKey: string;
  stream: Observable<T>;
};

@Injectable()
export class ReportsTabDataService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly reportsApi = inject(ReportsService);
  private readonly expensesApi = inject(ExpensesService);

  private balanceCache: CachedStream<ReportsBalanceData> | null = null;
  private maniobrasCache: CachedStream<ReportsManiobrasData> | null = null;
  private fleetCache: CachedStream<ReportsFleetData> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.clearCache());
  }

  getBalance(filter: ReportsFilter): Observable<ReportsBalanceData> {
    return this.cachedTab('balance', filter, this.balanceCache, (next) => {
      this.balanceCache = next;
    }, () => this.reportsApi.getBalance(filter));
  }

  getManiobras(filter: ReportsFilter): Observable<ReportsManiobrasData> {
    return this.cachedTab('maniobras', filter, this.maniobrasCache, (next) => {
      this.maniobrasCache = next;
    }, () => this.reportsApi.getManiobras(filter));
  }

  getFleet(filter: ReportsFilter): Observable<ReportsFleetData> {
    return this.cachedTab('fleet', filter, this.fleetCache, (next) => {
      this.fleetCache = next;
    }, () => this.reportsApi.getFleet(filter));
  }

  /** Balance + calendario de pagos (un solo request al calendar endpoint). */
  getBalanceBundle(filter: ReportsFilter): Observable<ReportsBalanceBundle> {
    const range = dashboardUpcomingPaymentsRange();

    const fromDate = new Date(filter.fromYear, filter.fromMonth - 1 - 12, 1, 12, 0, 0, 0);
    const lookbackFrom = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-01`;

    const lastDay = new Date(filter.toYear, filter.toMonth, 0).getDate();
    const fullMonthTo = `${filter.toYear}-${String(filter.toMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const from = lookbackFrom < range.fetchFrom ? lookbackFrom : range.fetchFrom;
    const to = fullMonthTo > range.to ? fullMonthTo : range.to;

    return forkJoin({
      balance: this.getBalance(filter),
      calendarItems: this.expensesApi
        .getAllExpensesCalendarItems({ from, to })
        .pipe(catchError(() => of([] as ExpenseCalendarItem[]))),
    }).pipe(
      map(({ balance, calendarItems }) => ({
        balance,
        calendarItems,
        upcomingPayments: buildDashboardUpcomingPayments(calendarItems, range),
      })),
    );
  }

  clearCache(): void {
    this.balanceCache = null;
    this.maniobrasCache = null;
    this.fleetCache = null;
  }

  private cachedTab<T>(
    tab: ReportsTabId,
    filter: ReportsFilter,
    current: CachedStream<T> | null,
    setCache: (entry: CachedStream<T>) => void,
    factory: () => Observable<T>,
  ): Observable<T> {
    const filterKey = `${tab}:${reportsFilterCacheKey(filter)}`;
    if (current?.filterKey === filterKey) {
      return current.stream;
    }
    // refCount: true suelta el stream cuando no hay suscriptores (evita cache huérfana).
    const stream = factory().pipe(shareReplay({ bufferSize: 1, refCount: true }));
    const entry = { filterKey, stream };
    setCache(entry);
    return stream;
  }
}
