import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { TripsService as TripsApiService } from '@services/api/trips';
import type { Trip } from '@shared/models/logistics.models';
import { createRequestGeneration } from '@shared/utils/request-generation';

/**
 * Caché de maniobras para derivar estado operativo en Flota / Operadores.
 * Una sola carga GET /trips por módulo; no reemplaza TripsFeatureService en `/trips`.
 */
@Injectable()
export class OperationalTripsFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly tripsApi = inject(TripsApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _trips = signal<readonly Trip[]>([]);
  private readonly _loading = signal(false);

  private loadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly trips = this._trips.asReadonly();
  readonly loading = this._loading.asReadonly();

  loadTrips(): void {
    if (this.disposed || this.loadStarted) {
      return;
    }
    this.loadStarted = true;
    this.runFetch();
  }

  refreshTrips(): void {
    if (this.disposed) {
      return;
    }
    this.runFetch();
  }

  private runFetch(): void {
    if (this.disposed) {
      return;
    }
    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    this._loading.set(true);
    this.fetchSub = this.tripsApi
      .getTripsList()
      .pipe(
        catchError(() => of([] as Trip[])),
        finalize(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._loading.set(false);
          }
        }),
      )
      .subscribe((list) => {
        if (!this.canApplyResponse(requestId)) {
          return;
        }
        this._trips.set(list);
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
    this._trips.set([]);
    this._loading.set(false);
    this.loadStarted = false;
  }
}
