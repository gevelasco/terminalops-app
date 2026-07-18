import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  OperationalFleetSyncService,
  isOperationalTripStatus,
} from '@core/services/state/operational-fleet-sync.service';
import { TripsService as TripsApiService } from '@services/api/trips';
import type {
  CancelTripPayload,
  CreateTripPayload,
  TripEmptyDeliveryPayload,
  TripLoadInfoPayload,
} from '@shared/models/api/api-trips.model';
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

  /**
   * Selecciona y SIEMPRE revalida contra el servidor: la caché operativa se
   * carga una vez por sesión y el lifecycle del API puede haber transicionado
   * la maniobra (p. ej. en curso → completada) sin que la copia local se entere.
   * La copia cacheada se muestra de inmediato (sin parpadeo) mientras llega la fresca.
   */
  selectTrip(tripId: string): void {
    const id = tripId.trim();
    if (!id) {
      return;
    }
    const cached = this.trips().find((t) => t.id === id) ?? null;
    this.selectTripSub?.unsubscribe();
    this._selectedTripId.set(id);
    this._fallbackTrip.set(cached);
    this.selectTripSub = this.tripsApi.getTripById(id).subscribe({
      next: (trip) => {
        if (this._selectedTripId() !== id) {
          return;
        }
        if (!trip) {
          if (!cached) {
            this.clearSelection();
          }
          return;
        }
        this.reconcileFetchedTrip(trip);
      },
      error: () => {
        if (this._selectedTripId() !== id) {
          return;
        }
        if (!cached) {
          this.clearSelection();
        }
      },
    });
  }

  /**
   * Aplica la verdad del servidor sobre la caché compartida:
   * - Si la maniobra dejó de ser operativa (completada/cancelada por el
   *   lifecycle), se saca de la caché y se notifica a flota/operadores.
   * - Si sigue operativa pero cambió, se actualiza en sitio.
   * - Si no cambió, no se toca la caché (evita recargas de lista innecesarias).
   */
  private reconcileFetchedTrip(fresh: Trip): void {
    const current = this.trips();
    const cached = current.find((t) => t.id === fresh.id) ?? null;
    const keepInCache = isOperationalTripStatus(fresh.status);

    if (cached && !keepInCache) {
      this.operationalSync.publishTripsAfterMutation(
        current.filter((t) => t.id !== fresh.id),
      );
      this._fallbackTrip.set(fresh);
      return;
    }
    if (cached) {
      if (JSON.stringify(cached) !== JSON.stringify(fresh)) {
        this.operationalSync.replaceTrips(
          current.map((t) => (t.id === fresh.id ? fresh : t)),
        );
      }
      this._fallbackTrip.set(null);
      return;
    }
    this._fallbackTrip.set(fresh);
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
      map((updated) => this.applyUpdatedTrip(updated, keepId, requestId, 'list')),
    );
  }

  cancelTrip(tripId: string, payload: CancelTripPayload): Observable<Trip> {
    const keepId = this._selectedTripId() ?? tripId;
    const requestId = this.requestGen.next();
    return this.tripsApi.postTripCancel(tripId, payload).pipe(
      map((updated) => this.applyUpdatedTrip(updated, keepId, requestId, 'fleet')),
    );
  }

  setClientCollected(tripId: string, collected: boolean): Observable<Trip> {
    const keepId = this._selectedTripId() ?? tripId;
    const requestId = this.requestGen.next();
    return this.tripsApi.patchTripClientCollected(tripId, collected).pipe(
      map((updated) => this.applyUpdatedTrip(updated, keepId, requestId, 'list')),
    );
  }

  updateLoadInfo(tripId: string, payload: TripLoadInfoPayload): Observable<Trip> {
    const keepId = this._selectedTripId() ?? tripId;
    const requestId = this.requestGen.next();
    return this.tripsApi.patchTripLoadInfo(tripId, payload).pipe(
      map((updated) => this.applyUpdatedTrip(updated, keepId, requestId, 'list')),
    );
  }

  updateEmptyDelivery(
    tripId: string,
    payload: TripEmptyDeliveryPayload,
  ): Observable<Trip> {
    const keepId = this._selectedTripId() ?? tripId;
    const requestId = this.requestGen.next();
    return this.tripsApi.patchTripEmptyDelivery(tripId, payload).pipe(
      map((updated) => this.applyUpdatedTrip(updated, keepId, requestId, 'list')),
    );
  }

  updateActualSchedule(
    tripId: string,
    payload: UpdateActualSchedulePayload,
  ): Observable<Trip> {
    const keepId = this._selectedTripId() ?? tripId;
    const requestId = this.requestGen.next();
    return this.tripsApi.patchTripActualSchedule(tripId, payload).pipe(
      map((updated) => this.applyUpdatedTrip(updated, keepId, requestId, 'fleet')),
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

  private applyUpdatedTrip(
    updated: Trip,
    selectedId: string,
    requestId: number,
    sync: 'list' | 'fleet',
  ): Trip {
    if (!this.canApplyResponse(requestId)) {
      return updated;
    }
    const keepInCache = isOperationalTripStatus(updated.status);
    const current = this.trips();
    const exists = current.some((trip) => trip.id === updated.id);
    const list = !keepInCache
      ? current.filter((trip) => trip.id !== updated.id)
      : exists
        ? current.map((trip) => (trip.id === updated.id ? updated : trip))
        : [updated, ...current];
    if (sync === 'fleet') {
      this.operationalSync.publishTripsAfterMutation([...list]);
    } else {
      this.operationalSync.replaceTrips([...list]);
    }
    if (selectedId === updated.id) {
      // La caché solo guarda activas; si salió de ella, el drawer sigue vivo vía fallback.
      this._fallbackTrip.set(keepInCache ? null : updated);
      this._selectedTripId.set(selectedId);
    }
    return updated;
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
