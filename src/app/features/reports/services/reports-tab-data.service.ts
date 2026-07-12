import { Injectable, inject } from '@angular/core';
import { ExpensesService } from '@core/services/api/expenses';
import { ReportsService } from '@core/services/api/reports';
import {
  buildDashboardUpcomingPayments,
  dashboardUpcomingPaymentsRange,
  operationalTodayYmd,
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
};

type CachedStream<T> = {
  filterKey: string;
  stream: Observable<T>;
};

@Injectable()
export class ReportsTabDataService {
  private readonly reportsApi = inject(ReportsService);
  private readonly expensesApi = inject(ExpensesService);

  private balanceCache: CachedStream<ReportsBalanceData> | null = null;
  private maniobrasCache: CachedStream<ReportsManiobrasData> | null = null;
  private fleetCache: CachedStream<ReportsFleetData> | null = null;
  private upcomingPaymentsCache: { dayKey: string; stream: Observable<DashboardUpcomingPaymentRow[]> } | null =
    null;

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

  /** Balance + calendario de pagos (un solo forkJoin por visita al tab). */
  getBalanceBundle(filter: ReportsFilter): Observable<ReportsBalanceBundle> {
    return forkJoin({
      balance: this.getBalance(filter),
      upcomingPayments: this.getUpcomingPayments(),
    });
  }

  /** Calendario operativo del mes; no depende del filtro de reportes. */
  getUpcomingPayments(): Observable<DashboardUpcomingPaymentRow[]> {
    const dayKey = operationalTodayYmd();
    if (this.upcomingPaymentsCache?.dayKey !== dayKey) {
      const range = dashboardUpcomingPaymentsRange();
      this.upcomingPaymentsCache = {
        dayKey,
        stream: this.expensesApi
          .getExpensesCalendar({
            from: range.fetchFrom,
            to: range.to,
            page: 1,
            limit: 0,
          })
          .pipe(
            map((response) => buildDashboardUpcomingPayments(response.items, range)),
            catchError(() => of([] as DashboardUpcomingPaymentRow[])),
            shareReplay({ bufferSize: 1, refCount: false }),
          ),
      };
    }
    return this.upcomingPaymentsCache.stream;
  }

  /** Limpia cache al cambiar de compañía (opcional, invocado desde tabs si hace falta). */
  clearCache(): void {
    this.balanceCache = null;
    this.maniobrasCache = null;
    this.fleetCache = null;
    this.upcomingPaymentsCache = null;
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
    const stream = factory().pipe(shareReplay({ bufferSize: 1, refCount: false }));
    const entry = { filterKey, stream };
    setCache(entry);
    return stream;
  }
}
