import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  of,
  Subscription,
  type Observable,
} from 'rxjs';
import { OperationConfigurationsService as OperationConfigurationsApiService } from '@services/api/operation-configurations';
import type { OperationConfiguration } from '@shared/models/operation-configuration.models';
import { createRequestGeneration } from '@shared/utils/request-generation';

/**
 * Catálogo operativo para la tab Tarifas.
 * GET /operation-configurations — lazy al abrir la tab Tarifas (una vez por visita al módulo).
 */
@Injectable()
export class OperationConfigurationsFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(OperationConfigurationsApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _configurations = signal<readonly OperationConfiguration[]>([]);
  private readonly _loading = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly configurations = this._configurations.asReadonly();
  readonly activeConfigurations = computed(() =>
    this._configurations().filter((c) => c.active),
  );
  readonly loading = this._loading.asReadonly();

  loadOperationConfigurations(): void {
    if (this.disposed || this.initialLoadStarted) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  refreshOperationConfigurations(): void {
    if (this.disposed) {
      return;
    }
    this.runFetch();
  }

  configurationByCode(code: string): OperationConfiguration | null {
    const normalized = code.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    return (
      this._configurations().find((c) => c.code.toLowerCase() === normalized) ??
      null
    );
  }

  private runFetch(): void {
    if (this.disposed) {
      return;
    }
    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    this._loading.set(true);
    this.fetchSub = this.api
      .getOperationConfigurationsList()
      .pipe(
        catchError(() => of([] as OperationConfiguration[])),
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
          this._configurations.set(list);
        },
        error: () => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this._configurations.set([]);
        },
      });
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._configurations.set([]);
    this._loading.set(false);
    this.initialLoadStarted = false;
  }
}
