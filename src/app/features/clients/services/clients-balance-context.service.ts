import { computed, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { ClientsService } from '@core/services/api/clients';
import { ExpensesService } from '@core/services/api/expenses';
import {
  emptyClientBalanceSummary,
  type ClientBalanceSummary,
} from '@features/clients/utils/client-balance-summary';
import type { Expense } from '@shared/models/logistics.models';

/**
 * Datos compartidos para balance comercial (tab Balance + drawer).
 * Overview y balance por cliente: API (`/clients/balance-overview`, `/clients/:id/balance`).
 * Gastos: solo tab Maniobras del drawer, filtrados por maniobras del periodo.
 */
@Injectable()
export class ClientsBalanceContextService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly clientsApi = inject(ClientsService);
  private readonly expensesApi = inject(ExpensesService);

  private overviewLoadStarted = false;
  private loadedExpensesTripIdsKey: string | null = null;
  private clientBalanceSub: Subscription | null = null;
  private disposed = false;
  private overviewFetchSub: Subscription | null = null;
  private expensesFetchSub: Subscription | null = null;

  private readonly _overviewByClientId = signal<
    Readonly<Record<string, ClientBalanceSummary>>
  >({});
  private readonly _overviewLoading = signal(false);

  private readonly _clientBalance = signal<ClientBalanceSummary | null>(null);
  private readonly _clientBalanceClientId = signal<string | null>(null);
  private readonly _clientBalanceLoading = signal(false);

  private readonly _expenses = signal<readonly Expense[]>([]);
  private readonly _expensesLoading = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly overviewByClientId = this._overviewByClientId.asReadonly();
  readonly overviewLoading = this._overviewLoading.asReadonly();
  readonly clientBalance = this._clientBalance.asReadonly();
  readonly clientBalanceClientId = this._clientBalanceClientId.asReadonly();
  readonly clientBalanceLoading = this._clientBalanceLoading.asReadonly();
  readonly expenses = this._expenses.asReadonly();
  readonly expensesLoading = this._expensesLoading.asReadonly();

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

  ensureExpensesForTrips(tripIds: readonly string[]): void {
    if (this.disposed) {
      return;
    }
    const normalized = [
      ...new Set(tripIds.map((id) => id.trim()).filter(Boolean)),
    ].sort();
    const key = normalized.join(',');
    if (this.loadedExpensesTripIdsKey === key && !this._expensesLoading()) {
      return;
    }

    this.loadedExpensesTripIdsKey = key;
    this.expensesFetchSub?.unsubscribe();

    if (normalized.length === 0) {
      this._expenses.set([]);
      this._expensesLoading.set(false);
      return;
    }

    this._expensesLoading.set(true);
    this.expensesFetchSub = this.expensesApi
      .getAllExpenses({ tripIds: normalized.join(',') })
      .pipe(
        catchError(() => of([] as Expense[])),
        finalize(() => {
          if (!this.disposed) {
            this._expensesLoading.set(false);
          }
        }),
      )
      .subscribe((rows) => {
        if (!this.disposed && this.loadedExpensesTripIdsKey === key) {
          this._expenses.set(rows);
        }
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
    this.expensesFetchSub?.unsubscribe();
    this.clientBalanceSub?.unsubscribe();
    this.overviewFetchSub = null;
    this.expensesFetchSub = null;
    this.clientBalanceSub = null;
    this._overviewByClientId.set({});
    this._overviewLoading.set(false);
    this._clientBalance.set(null);
    this._clientBalanceClientId.set(null);
    this._clientBalanceLoading.set(false);
    this._expenses.set([]);
    this._expensesLoading.set(false);
    this.overviewLoadStarted = false;
    this.loadedExpensesTripIdsKey = null;
  }
}
