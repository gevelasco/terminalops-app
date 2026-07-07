import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { catchError, finalize, map, of, Subscription, switchMap, type Observable } from 'rxjs';
import { OperationalFleetSyncService } from '@core/services/state/operational-fleet-sync.service';
import { TripsService as TripsApiService } from '@services/api/trips';
import type { CancelTripPayload, CreateTripPayload } from '@shared/models/api/api-trips.model';
import type { UpdateActualSchedulePayload } from '@shared/models/api/api-trips-actual-schedule.model';
import type { Trip } from '@shared/models/logistics.models';
import { createRequestGeneration } from '@shared/utils/request-generation';

/**
 * Fuente única de verdad del feature Trips (lista en memoria + selección).
 * GET /companies/{companyId}/trips — una vez al entrar; refresh solo tras mutaciones explícitas.
 * Alcance: ruta `/trips`.
 */
@Injectable()
export class TripsFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly tripsApi = inject(TripsApiService);
  private readonly operationalSync = inject(OperationalFleetSyncService);
  private readonly requestGen = createRequestGeneration();

  private readonly _trips = signal<readonly Trip[]>([]);
  private readonly _selectedTripId = signal<string | null>(null);
  private readonly _fallbackTrip = signal<Trip | null>(null);
  private readonly _loading = signal(false);
  private readonly _listEpoch = signal(0);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;
  private selectTripSub: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly trips = this._trips.asReadonly();
  readonly selectedTripId = this._selectedTripId.asReadonly();
  readonly selectedTrip = computed(() => {
    const id = this._selectedTripId();
    if (!id) {
      return null;
    }
    return this._trips().find((t) => t.id === id) ?? this._fallbackTrip();
  });
  readonly loading = this._loading.asReadonly();
  readonly listEpoch = this._listEpoch.asReadonly();

  loadTrips(): void {
    if (this.disposed) {
      return;
    }
    if (this.initialLoadStarted) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  refreshTrips(): void {
    if (this.disposed) {
      return;
    }
    this.runFetch();
  }

  selectTrip(tripId: string): void {
    const id = tripId.trim();
    if (!id) {
      return;
    }
    if (this._trips().some((t) => t.id === id)) {
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
        const withoutDuplicate = this._trips().filter((t) => t.id !== created.id);
        // Al crear, no autoabrimos detalle: consistencia con clients.
        this.applyList([created, ...withoutDuplicate], null);
        this.operationalSync.notifyTripFleetMutation();
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
            this.applyList(list, keepId);
            return this._trips().find((t) => t.id === keepId) ?? updated;
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
            this.applyList(list, keepId);
            this.operationalSync.notifyTripFleetMutation();
            return this._trips().find((t) => t.id === keepId) ?? updated;
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
            this.applyList(list, keepId);
            return this._trips().find((t) => t.id === keepId) ?? updated;
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
            this.applyList(list, keepId);
            this.operationalSync.notifyTripFleetMutation();
            return this._trips().find((t) => t.id === keepId) ?? updated;
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
        const list = this._trips().filter((t) => t.id !== id);
        this.applyList(list, selected === id ? null : selected);
        if (selected === id) {
          this._selectedTripId.set(null);
          this._fallbackTrip.set(null);
        }
        this.operationalSync.notifyTripFleetMutation();
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
          this.applyList(list, this._selectedTripId());
        },
        error: () => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this.applyList([], this._selectedTripId());
        },
      });
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  private fetchList(): Observable<Trip[]> {
    return this.tripsApi.getTripsList().pipe(catchError(() => of([] as Trip[])));
  }

  private applyList(list: Trip[], selectedId: string | null): void {
    this._trips.set(list);
    this._listEpoch.update((n) => n + 1);
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

  /** Destrucción terminal al salir del feature (no reutilizar instancia). */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    this.fetchSub?.unsubscribe();
    this.selectTripSub?.unsubscribe();
    this.fetchSub = null;
    this.selectTripSub = null;
    this._trips.set([]);
    this._selectedTripId.set(null);
    this._fallbackTrip.set(null);
    this._loading.set(false);
    this.initialLoadStarted = false;
  }
}

