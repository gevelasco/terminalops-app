import { DestroyRef, Injectable, inject } from '@angular/core';
import { ReportsService } from '@core/services/api/reports';
import type { ReportsFilter } from '@features/reports/models/reports-view.models';
import type { ReportsTabId } from '@features/reports/models/reports-view.models';
import { reportsFilterCacheKey } from '@features/reports/utils/reports-filter-cache-key.util';
import type { ReportsBalanceData } from '@shared/models/api/api-reports-balance.model';
import type { ReportsFleetData } from '@shared/models/api/api-reports-fleet.model';
import type { ReportsManiobrasData } from '@shared/models/api/api-reports-maniobras.model';
import { catchError, defer, Observable, shareReplay, throwError } from 'rxjs';
import { SessionService } from '@core/services/state/session';
import { API_SHARE_REPLAY_CACHE } from '@shared/utils/share-replay-api-cache';

type CachedStream<T> = {
  filterKey: string;
  stream: Observable<T>;
};

@Injectable()
export class ReportsTabDataService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly reportsApi = inject(ReportsService);
  private readonly session = inject(SessionService);

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
    // defer: convierte throws síncronos (p. ej. sin companyId al logout) en error RxJS.
    const stream = defer(() => {
      if (!this.session.companyId()?.trim()) {
        return throwError(() => new Error('No hay empresa en sesión'));
      }
      return factory();
    }).pipe(
      shareReplay(API_SHARE_REPLAY_CACHE),
      catchError((err) => {
        this.dropCacheEntryIfMatches(tab, filterKey);
        return throwError(() => err);
      }),
    );
    const entry = { filterKey, stream };
    setCache(entry);
    return stream;
  }

  /** Evita servir un stream que terminó en error al volver al tab / cambiar filtro. */
  private dropCacheEntryIfMatches(tab: ReportsTabId, filterKey: string): void {
    const drop = (current: CachedStream<unknown> | null): boolean =>
      current?.filterKey === filterKey;
    if (tab === 'balance' && drop(this.balanceCache)) {
      this.balanceCache = null;
    } else if (tab === 'maniobras' && drop(this.maniobrasCache)) {
      this.maniobrasCache = null;
    } else if (tab === 'fleet' && drop(this.fleetCache)) {
      this.fleetCache = null;
    }
  }
}
