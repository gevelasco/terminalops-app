import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  of,
  Subscription,
  switchMap,
  type Observable,
} from 'rxjs';
import { DestinationRatesService as DestinationRatesApiService } from '@services/api/destination-rates';
import type {
  CreateDestinationRatePayload,
  DestinationRate,
  UpdateDestinationRatePayload,
} from '@shared/models/destination-rate.models';
import { createRequestGeneration } from '@shared/utils/request-generation';

/**
 * Fuente única de verdad del feature Tarifas por destino (lista en memoria + selección).
 * GET /companies/{companyId}/destination-rates — lazy al abrir la tab Tarifas (una vez por visita al módulo).
 * Alcance: ruta `/clients`.
 */
@Injectable()
export class DestinationRatesFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(DestinationRatesApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _rates = signal<readonly DestinationRate[]>([]);
  private readonly _selectedRateId = signal<string | null>(null);
  private readonly _loading = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly rates = this._rates.asReadonly();
  readonly selectedRateId = this._selectedRateId.asReadonly();
  readonly selectedRate = computed(() => {
    const id = this._selectedRateId();
    if (!id) {
      return null;
    }
    return this._rates().find((r) => r.id === id) ?? null;
  });
  readonly loading = this._loading.asReadonly();

  loadDestinationRates(): void {
    if (this.disposed) {
      return;
    }
    if (this.initialLoadStarted) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  refreshDestinationRates(): void {
    if (this.disposed) {
      return;
    }
    this.runFetch();
  }

  selectRate(rateId: string): void {
    if (this._rates().some((r) => r.id === rateId)) {
      this._selectedRateId.set(rateId);
    }
  }

  clearSelection(): void {
    this._selectedRateId.set(null);
  }

  createDestinationRate(
    payload: CreateDestinationRatePayload,
  ): Observable<DestinationRate> {
    const requestId = this.requestGen.next();
    return this.api.postDestinationRate(payload).pipe(
      switchMap((created) =>
        this.fetchList().pipe(
          map((list) => {
            if (!this.canApplyResponse(requestId)) {
              return created;
            }
            this.applyList(list, created.id);
            return this._rates().find((r) => r.id === created.id) ?? created;
          }),
        ),
      ),
    );
  }

  updateDestinationRate(
    rate: DestinationRate,
    patch: UpdateDestinationRatePayload,
  ): Observable<DestinationRate> {
    const keepId = this._selectedRateId() ?? rate.id;
    const requestId = this.requestGen.next();
    return this.api.patchDestinationRateById(rate, patch).pipe(
      switchMap(() => this.fetchList()),
      map((list) => {
        if (!this.canApplyResponse(requestId)) {
          return rate;
        }
        this.applyList(list, keepId);
        return this._rates().find((r) => r.id === keepId) ?? rate;
      }),
    );
  }

  deleteDestinationRate(rateId: string): Observable<void> {
    const requestId = this.requestGen.next();
    return this.api.deleteDestinationRateById(rateId).pipe(
      switchMap(() => this.fetchList()),
      map((list) => {
        if (!this.canApplyResponse(requestId)) {
          return;
        }
        this.applyList(list, null);
      }),
    );
  }

  private runFetch(): void {
    if (this.disposed) {
      return;
    }
    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    this._loading.set(true);
    this.fetchSub = this.fetchList()
      .pipe(
        finalize(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._loading.set(false);
          }
        }),
      )
      .subscribe({
        next: (list) => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this.applyList(list, this._selectedRateId());
        },
        error: () => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this.applyList([], this._selectedRateId());
        },
      });
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  private fetchList(): Observable<DestinationRate[]> {
    return this.api
      .getDestinationRatesList()
      .pipe(catchError(() => of([] as DestinationRate[])));
  }

  private applyList(list: DestinationRate[], selectedId: string | null): void {
    this._rates.set(list);
    if (!selectedId) {
      return;
    }
    if (list.some((r) => r.id === selectedId)) {
      this._selectedRateId.set(selectedId);
      return;
    }
    this._selectedRateId.set(null);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._rates.set([]);
    this._selectedRateId.set(null);
    this._loading.set(false);
    this.initialLoadStarted = false;
  }
}
