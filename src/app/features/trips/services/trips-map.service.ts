import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { TripsService as TripsApiService } from '@services/api/trips';
import type {
  TripMapItem,
  TripsMapMeta,
} from '@shared/models/api/api-trips-map.model';
import { createRequestGeneration } from '@shared/utils/request-generation';

/**
 * Vista geoespacial de maniobras activas (Tab Ruta).
 * GET /companies/{companyId}/trips/map — carga bajo demanda al abrir el tab.
 */
@Injectable()
export class TripsMapService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly tripsApi = inject(TripsApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _items = signal<readonly TripMapItem[]>([]);
  private readonly _meta = signal<TripsMapMeta | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);

  private fetchSub: Subscription | null = null;
  private disposed = false;
  private initialLoadStarted = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly items = this._items.asReadonly();
  readonly meta = this._meta.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasData = computed(() => this._items().length > 0);

  load(): void {
    if (this.disposed || this.initialLoadStarted) {
      return;
    }
    this.initialLoadStarted = true;
    this.refresh();
  }

  refresh(options?: { silent?: boolean }): void {
    if (this.disposed) {
      return;
    }
    const silent = options?.silent === true;
    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    if (!silent) {
      this._loading.set(true);
    }
    this._error.set(false);

    this.fetchSub = this.tripsApi
      .getTripsMap()
      .pipe(
        catchError(() => {
          if (this.canApplyResponse(requestId)) {
            this._error.set(true);
          }
          return of(null);
        }),
        finalize(() => {
          if (this.requestGen.isCurrent(requestId) && !silent) {
            this._loading.set(false);
          }
        }),
      )
      .subscribe((response) => {
        if (!this.canApplyResponse(requestId) || !response) {
          return;
        }
        this._items.set(response.items);
        this._meta.set(response.meta);
      });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._items.set([]);
    this._meta.set(null);
    this._loading.set(false);
    this._error.set(false);
    this.initialLoadStarted = false;
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }
}
