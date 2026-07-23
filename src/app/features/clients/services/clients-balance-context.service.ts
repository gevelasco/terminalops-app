import { computed, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { ClientsService } from '@core/services/api/clients';
import {
  emptyClientBalanceSummary,
  type ClientBalanceSummary,
} from '@features/clients/utils/client-balance-summary';

/**
 * Datos compartidos para balance comercial (tab Clientes + drawer).
 * Overview y balance por cliente: API (`/clients/balance-overview`, `/clients/:id/balance`).
 */
@Injectable()
export class ClientsBalanceContextService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly clientsApi = inject(ClientsService);

  private overviewLoadStarted = false;
  private clientBalanceSub: Subscription | null = null;
  private disposed = false;
  private overviewFetchSub: Subscription | null = null;

  private readonly _overviewByClientId = signal<
    Readonly<Record<string, ClientBalanceSummary>>
  >({});
  private readonly _overviewLoading = signal(false);

  private readonly _clientBalance = signal<ClientBalanceSummary | null>(null);
  private readonly _clientBalanceClientId = signal<string | null>(null);
  private readonly _clientBalanceLoading = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly overviewByClientId = this._overviewByClientId.asReadonly();
  readonly overviewLoading = this._overviewLoading.asReadonly();
  readonly clientBalance = this._clientBalance.asReadonly();
  readonly clientBalanceClientId = this._clientBalanceClientId.asReadonly();
  readonly clientBalanceLoading = this._clientBalanceLoading.asReadonly();

  readonly resolvedClientBalance = computed(() => {
    const summary = this._clientBalance();
    return summary ?? emptyClientBalanceSummary();
  });

  ensureOverviewLoaded(): void {
    if (this.disposed || this.overviewLoadStarted) {
      return;
    }
    this.overviewLoadStarted = true;
    this.overviewFetchSub?.unsubscribe();
    this._overviewLoading.set(true);
    this.overviewFetchSub = this.clientsApi
      .getClientsBalanceOverview()
      .pipe(
        catchError(() => of({ asOf: '', items: [] })),
        finalize(() => {
          if (!this.disposed) {
            this._overviewLoading.set(false);
          }
        }),
      )
      .subscribe((response) => {
        if (this.disposed) {
          return;
        }
        const map: Record<string, ClientBalanceSummary> = {};
        for (const item of response.items ?? []) {
          const id = item.clientId?.trim();
          if (id) {
            map[id] = item.summary;
          }
        }
        this._overviewByClientId.set(map);
      });
  }

  private _lastPeriodKey: string | null = null;

  ensureClientBalanceLoaded(
    clientId: string,
    periodFrom?: string,
    periodTo?: string,
  ): void {
    const id = clientId.trim();
    if (!id || this.disposed) {
      return;
    }
    const periodKey = periodFrom && periodTo ? `${periodFrom}:${periodTo}` : '';
    const cacheHit =
      this._clientBalanceClientId() === id &&
      this._lastPeriodKey === periodKey &&
      this._clientBalance() != null;
    if (cacheHit) return;

    const alreadyLoading =
      this._clientBalanceLoading() &&
      this._clientBalanceClientId() === id &&
      this._lastPeriodKey === periodKey;
    if (alreadyLoading) return;

    this.clientBalanceSub?.unsubscribe();
    this._clientBalanceClientId.set(id);
    this._lastPeriodKey = periodKey;
    this._clientBalance.set(null);
    this._clientBalanceLoading.set(true);
    this.clientBalanceSub = this.clientsApi
      .getClientBalance(id, periodFrom, periodTo)
      .pipe(
        catchError(() => of(emptyClientBalanceSummary())),
        finalize(() => {
          if (!this.disposed) {
            this._clientBalanceLoading.set(false);
          }
        }),
      )
      .subscribe((summary) => {
        if (this.disposed || this._clientBalanceClientId() !== id) {
          return;
        }
        this._clientBalance.set(summary);
      });
  }

  invalidateBalances(): void {
    this.overviewLoadStarted = false;
    this._overviewByClientId.set({});
    this._clientBalance.set(null);
    this._clientBalanceClientId.set(null);
    this._lastPeriodKey = null;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.overviewFetchSub?.unsubscribe();
    this.clientBalanceSub?.unsubscribe();
    this.overviewFetchSub = null;
    this.clientBalanceSub = null;
    this._overviewByClientId.set({});
    this._overviewLoading.set(false);
    this._clientBalance.set(null);
    this._clientBalanceClientId.set(null);
    this._clientBalanceLoading.set(false);
    this.overviewLoadStarted = false;
  }
}
