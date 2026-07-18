import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { TripsService } from '@core/services/api/trips';
import { createRequestGeneration } from '@shared/utils/request-generation';
import { finalize, tap, type Subscription } from 'rxjs';

function normalizePlaceName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Catálogo por empresa de lugares de carga de maniobras.
 * GET /companies/{companyId}/trips/load-places — al abrir el drawer de alta.
 */
@Injectable()
export class TripLoadPlacesFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(TripsService);
  private readonly requestGen = createRequestGeneration();

  private readonly _places = signal<readonly string[]>([]);
  private readonly _loading = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;

  readonly places = this._places.asReadonly();
  readonly loading = this._loading.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  /** Carga bajo demanda; idempotente mientras el usuario permanezca en Maniobras. */
  ensureLoaded(): void {
    if (this.disposed || this.initialLoadStarted || this._loading()) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  /** Añade el lugar al estado local tras guardar la maniobra (sin recargar). */
  registerLocalPlace(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    const normalized = normalizePlaceName(trimmed);
    const list = this._places();
    if (list.some((p) => normalizePlaceName(p) === normalized)) {
      return;
    }
    this._places.set(
      [...list, trimmed].sort((a, b) => a.localeCompare(b, 'es')),
    );
  }

  dispose(): void {
    this.disposed = true;
    this.initialLoadStarted = false;
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._places.set([]);
    this._loading.set(false);
    this.requestGen.invalidate();
  }

  private runFetch(): void {
    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    this._loading.set(true);
    this.fetchSub = this.api
      .getTripLoadPlaces()
      .pipe(
        tap((res) => {
          if (this.requestGen.isCurrent(requestId)) {
            this._places.set(res.places ?? []);
          }
        }),
        finalize(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._loading.set(false);
          }
        }),
      )
      .subscribe();
  }
}
