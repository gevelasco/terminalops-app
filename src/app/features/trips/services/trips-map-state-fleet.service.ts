import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { FleetApiService } from '@services/api/fleet';
import { overviewCardEntryFromDto } from '@features/fleet/utils/fleet-overview-view';
import type { FleetOverviewCardEntry } from '@features/fleet/utils/fleet-overview-view';
import { createRequestGeneration } from '@shared/utils/request-generation';

@Injectable()
export class TripsMapStateFleetService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fleetApi = inject(FleetApiService);
  private readonly requestGen = createRequestGeneration();

  private fetchSub: Subscription | null = null;
  private disposed = false;

  private readonly _selectedState = signal<string | null>(null);
  private readonly _cards = signal<readonly FleetOverviewCardEntry[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);

  readonly selectedState = this._selectedState.asReadonly();
  readonly cards = this._cards.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasSelection = computed(() => this._selectedState() != null);

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  loadForState(stateName: string, tripIds: readonly string[]): void {
    if (this.disposed) {
      return;
    }

    const normalizedState = stateName.trim();
    if (!normalizedState || tripIds.length === 0) {
      this.clear();
      return;
    }

    this._selectedState.set(normalizedState);
    const numericTripIds = tripIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (numericTripIds.length === 0) {
      this._cards.set([]);
      this._loading.set(false);
      this._error.set(false);
      return;
    }

    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    this._loading.set(true);
    this._error.set(false);

    this.fetchSub = this.fleetApi
      .getFleetOverviewForTripIds(numericTripIds)
      .pipe(
        catchError(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._error.set(true);
          }
          return of({ items: [], equipment: [] });
        }),
        finalize(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._loading.set(false);
          }
        }),
      )
      .subscribe({
        next: (response) => {
          if (!this.requestGen.isCurrent(requestId) || this.disposed) {
            return;
          }
          this._cards.set(response.items.map((item) => overviewCardEntryFromDto(item)));
          this._error.set(false);
        },
      });
  }

  clear(): void {
    this.requestGen.invalidate();
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._selectedState.set(null);
    this._cards.set([]);
    this._loading.set(false);
    this._error.set(false);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clear();
  }
}
