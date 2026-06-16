import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { OperationalCentersService as OperationalCentersApi } from '@core/services/api/operational-centers';
import type { OperationalCenter } from '@shared/models/operational-center.models';
import { createRequestGeneration } from '@shared/utils/request-generation';
import { finalize, tap, type Subscription } from 'rxjs';

/**
 * Catálogo de centros operativos en memoria (signals).
 * GET /companies/{companyId}/operational-centers — una sola vez por visita a `/clients`.
 */
@Injectable()
export class OperationalCentersFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(OperationalCentersApi);
  private readonly requestGen = createRequestGeneration();

  private readonly _centers = signal<readonly OperationalCenter[]>([]);
  private readonly _loading = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;

  readonly centers = this._centers.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly defaultCenter = computed(() => {
    const list = this._centers();
    return list.find((c) => c.isDefault) ?? list[0] ?? null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  loadOperationalCenters(): void {
    if (this.disposed) {
      return;
    }
    if (this.initialLoadStarted) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  refreshOperationalCenters(): void {
    if (this.disposed) {
      return;
    }
    this.runFetch();
  }

  centerById(id: string): OperationalCenter | null {
    const key = id.trim();
    if (!key) {
      return null;
    }
    return this._centers().find((c) => c.id === key) ?? null;
  }

  dispose(): void {
    this.disposed = true;
    this.initialLoadStarted = false;
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._centers.set([]);
    this._loading.set(false);
    this.requestGen.invalidate();
  }

  private runFetch(): void {
    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    this._loading.set(true);
    this.fetchSub = this.api
      .getOperationalCentersList()
      .pipe(
        tap((list) => {
          if (this.requestGen.isCurrent(requestId)) {
            this._centers.set(list);
          }
        }),
        finalize(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._loading.set(false);
          }
        }),
      )
      .subscribe({
        error: () => {
          if (this.requestGen.isCurrent(requestId)) {
            this._centers.set([]);
          }
        },
      });
  }
}
