import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, of, Subscription, switchMap, type Observable } from 'rxjs';
import { OperationalFleetSyncService } from '@core/services/state/operational-fleet-sync.service';
import { TripsService as TripsApiService } from '@services/api/trips';
import type { CancelTripPayload, CreateTripPayload } from '@shared/models/api/api-trips.model';
import type { UpdateActualSchedulePayload } from '@shared/models/api/api-trips-actual-schedule.model';
import type { Trip } from '@shared/models/logistics.models';
import { createRequestGeneration } from '@shared/utils/request-generation';

/**
 * Estado de UI del feature Trips: selección y mutaciones.
 * La lista vive en `OperationalFleetSyncService` (una sola copia en memoria).
 * Alcance: ruta `/trips`.
 */
@Injectable()
export class TripsFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly tripsApi = inject(TripsApiService);
  private readonly operationalSync = inject(OperationalFleetSyncService);
  private readonly requestGen = createRequestGeneration();

  private readonly _selectedTripId = signal<string | null>(null);
  private readonly _fallbackTrip = signal<Trip | null>(null);

  private loadRequested = false;
  private disposed = false;
  private selectTripSub: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly trips = this.operationalSync.trips;
  readonly loading = this.operationalSync.tripsLoading;
  readonly listEpoch = this.operationalSync.tripsEpoch;
  readonly selectedTripId = this._selectedTripId.asReadonly();
  readonly selectedTrip = computed(() => {
    const id = this._selectedTripId();
    if (!id) {
      return null;
    }
    return this.trips().find((t) => t.id === id) ?? this._fallbackTrip();
  });

  loadTrips(): void {
    if (this.disposed || this.loadRequested) {
      return;
    }
    this.loadRequested = true;
    this.operationalSync.ensureTripsLoaded();
  }

  refreshTrips(): void {
    if (this.disposed) {
      return;
    }
    this.operationalSync.refreshTrips();
  }

  selectTrip(tripId: string): void {
    const id = tripId.trim();
    if (!id) {
      return;
    }
    if (this.trips().some((t) => t.id === id)) {
      this.selectTripSub?.unsubscribe();
      this._fallbackTrip.set(null);
      this._selectedTripId.set(id);
      return;
    }
    this._selectedTripId.set(id);
    this._fallbackTrip.set(null);
    this.selectTripSub?.unsubscribe();
    this.selectTripSub = this.tripsApi.getTripById(id).subscribe({
      next: (trip) => {
        if (this._selectedTripId() !== id) {
          return;
        }
        this._fallbackTrip.set(trip ?? null);
      },
      error: () => {
        if (this._selectedTripId() !== id) {
          return;
        }
        this.clearSelection();
      },
    });
  }

  clearSelection(): void {
    this.selectTripSub?.unsubscribe();
    this._selectedTripId.set(null);
    this._fallbackTrip.set(null);
  }

  createTrip(payload: CreateTripPayload): Observable<Trip> {
    const requestId = this.requestGen.next();
    return this.tripsApi.postTrip(payload).pipe(
      map((created) => {
        if (!this.canApplyResponse(requestId)) {
          return created;
        }
        const withoutDuplicate = this.trips().filter((t) => t.id !== created.id);
        const list = [created, ...withoutDuplicate];
        this.applyList(list, null, 'fleet');
        return created;
      }),
    );
  }

  postTripIncident(
    tripId: string,
    description: string,
    postedBy: string,
    isIncident = false,
  ): Observable<Trip> {
    const keepId = this._selectedTripId() ?? tripId;
    const requestId = this.requestGen.next();
    return this.tripsApi.postTripIncident(tripId, description, postedBy, isIncident).pipe(
      switchMap((updated) =>
        this.fetchList().pipe(
          map((list) => {
            if (!this.canApplyResponse(requestId)) {
              return updated;
            }
            this.applyList(list, keepId, 'list');
            return this.trips().find((t) => t.id === keepId) ?? updated;
          }),
        ),
      ),
    );
  }

  cancelTrip(tripId: string, payload: CancelTripPayload): Observable<Trip> {
    const keepId = this._selectedTripId() ?? tripId;
    const requestId = this.requestGen.next();
    return this.tripsApi.postTripCancel(tripId, payload).pipe(
      switchMap((updated) =>
        this.fetchList().pipe(
          map((list) => {
            if (!this.canApplyResponse(requestId)) {
              return updated;
            }
            this.applyList(list, keepId, 'fleet');
            return this.trips().find((t) => t.id === keepId) ?? updated;
          }),
        ),
      ),
    );
  }

  setClientCollected(tripId: string, collected: boolean): Observable<Trip> {
    const keepId = this._selectedTripId() ?? tripId;
    const requestId = this.requestGen.next();
    return this.tripsApi.patchTripClientCollected(tripId, collected).pipe(
      switchMap((updated) =>
        this.fetchList().pipe(
          map((list) => {
            if (!this.canApplyResponse(requestId)) {
              return updated;
            }
            this.applyList(list, keepId, 'list');
            return this.trips().find((t) => t.id === keepId) ?? updated;
          }),
        ),
      ),
    );
  }

  updateActualSchedule(
    tripId: string,
    payload: UpdateActualSchedulePayload,
  ): Observable<Trip> {
    const keepId = this._selectedTripId() ?? tripId;
    const requestId = this.requestGen.next();
    return this.tripsApi.patchTripActualSchedule(tripId, payload).pipe(
      switchMap((updated) =>
        this.fetchList().pipe(
          map((list) => {
            if (!this.canApplyResponse(requestId)) {
              return updated;
            }
            this.applyList(list, keepId, 'fleet');
            return this.trips().find((t) => t.id === keepId) ?? updated;
          }),
        ),
      ),
    );
  }

  deleteTrip(tripId: string): Observable<void> {
    const id = tripId.trim();
    const requestId = this.requestGen.next();
    return this.tripsApi.deleteTrip(id).pipe(
      map(() => {
        if (!this.canApplyResponse(requestId)) {
          return;
        }
        const selected = this._selectedTripId();
        const list = this.trips().filter((t) => t.id !== id);
        this.applyList(list, selected === id ? null : selected, 'fleet');
        if (selected === id) {
          this._selectedTripId.set(null);
          this._fallbackTrip.set(null);
        }
      }),
    );
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  private fetchList(): Observable<Trip[]> {
    return this.tripsApi.getTripsList().pipe(catchError(() => of([] as Trip[])));
  }

  private applyList(
    list: Trip[],
    selectedId: string | null,
    sync: 'list' | 'fleet',
  ): void {
    if (sync === 'fleet') {
      this.operationalSync.publishTripsAfterMutation(list);
    } else {
      this.operationalSync.replaceTrips(list);
    }
    if (!selectedId) {
      return;
    }
    if (list.some((t) => t.id === selectedId)) {
      this._fallbackTrip.set(null);
      this._selectedTripId.set(selectedId);
      return;
    }
    this._selectedTripId.set(null);
    this._fallbackTrip.set(null);
  }

  /** Limpia selección al salir del feature; la lista permanece en sync hasta logout. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    this.selectTripSub?.unsubscribe();
    this.selectTripSub = null;
    this._selectedTripId.set(null);
    this._fallbackTrip.set(null);
    this.loadRequested = false;
  }
}
