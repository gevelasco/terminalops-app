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
import { UnitsService as UnitsApiService } from '@services/api/units';
import type { CreateUnitPayload } from '@shared/models/api/api-fleet.model';
import type { FleetMaintenanceAction } from '@shared/models/api/api-fleet-operational-status.model';
import type { Unit } from '@shared/models/logistics.models';
import type { UnitPersistDraft } from '@shared/utils/fleet/unit-api-payload';
import { FleetEntityDetailCache } from '@features/fleet/utils/fleet-entity-detail-cache';
import { coalesceInFlightRequest } from '@shared/utils/coalesce-in-flight-request';
import { createRequestGeneration } from '@shared/utils/request-generation';
import { normalizeUnitFromApi } from '@shared/utils/fleet/normalize-fleet-entities';

export type UnitUpdateOptions = {
  /** Evita GET de lista tras PATCH cuando el caller actualiza el listado en memoria. */
  skipListRefresh?: boolean;
};

/**
 * Lista de unidades en memoria + selección para el módulo Flota.
 * Carga al entrar a la tab Unidades (o al necesitar el catálogo); dispose al salir.
 */
@Injectable()
export class UnitsFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _units = signal<readonly Unit[]>([]);
  private readonly _selectedUnitId = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _hydrated = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;
  private readonly listFetchInFlight: { current: Observable<Unit[]> | null } = {
    current: null,
  };
  private readonly unitDetailCache = new FleetEntityDetailCache<Unit>();
  private readonly unitDetailFetchInFlight = new Map<
    string,
    { current: Observable<Unit | null> | null }
  >();

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly units = this._units.asReadonly();
  readonly selectedUnitId = this._selectedUnitId.asReadonly();
  readonly selectedUnit = computed(() => {
    const id = this._selectedUnitId();
    if (!id) {
      return null;
    }
    const found = this._units().find((u) => u.id === id);
    if (found) {
      return found;
    }
    // El drawer puede abrir desde overview antes de hidratar GET /units.
    if (!this._hydrated()) {
      return placeholderUnit(id);
    }
    return null;
  });
  readonly loading = this._loading.asReadonly();
  /** True tras el primer fetch (éxito o error). */
  readonly hydrated = this._hydrated.asReadonly();

  hasLoadedOnce(): boolean {
    return this.initialLoadStarted;
  }

  loadUnits(): void {
    if (this.disposed) {
      return;
    }
    if (this.initialLoadStarted) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  refreshUnits(): void {
    if (this.disposed) {
      return;
    }
    this.runFetch();
  }

  selectUnit(unitId: string): void {
    this._selectedUnitId.set(unitId);
  }

  clearSelection(): void {
    this._selectedUnitId.set(null);
  }

  /**
   * PATCH devuelve detalle completo; el observable emite esa respuesta (no la fila resumida del listado).
   */
  updateUnit(
    unit: Unit,
    draft?: UnitPersistDraft,
    options?: UnitUpdateOptions,
  ): Observable<Unit> {
    const keepId = this._selectedUnitId() ?? unit.id;
    const requestId = this.requestGen.next();
    return this.unitsApi.patchUnit(unit, draft).pipe(
      switchMap((saved) => {
        const normalized = normalizeUnitFromApi(saved);
        if (options?.skipListRefresh) {
          if (this.canApplyResponse(requestId)) {
            this.upsertUnitSummary(normalized);
            this.rememberUnitDetail(normalized);
          }
          return of(normalized);
        }
        return this.fetchList().pipe(
          map((list) => {
            if (this.canApplyResponse(requestId)) {
              this.applyList(list, keepId);
              // Mezcla campos recién guardados: GET lista es resumen y no refleja el PATCH.
              this.upsertUnitSummary(normalized);
              this.rememberUnitDetail(normalized);
            }
            return normalized;
          }),
        );
      }),
    );
  }

  deleteUnit(unitId: string): Observable<void> {
    const requestId = this.requestGen.next();
    return this.unitsApi.deleteUnit(unitId).pipe(
      switchMap(() => this.fetchList()),
      map((list) => {
        if (this.canApplyResponse(requestId)) {
          this.applyList(list, null);
          this.unitDetailCache.invalidate(unitId);
        }
      }),
      map(() => void 0),
    );
  }

  setUnitMaintenance(unitId: string, action: FleetMaintenanceAction): Observable<Unit> {
    const keepId = unitId.trim();
    const requestId = this.requestGen.next();
    return this.unitsApi.postUnitMaintenance(keepId, action).pipe(
      map((saved) => {
        const unit = normalizeUnitFromApi(saved);
        if (this.canApplyResponse(requestId)) {
          this.upsertUnitSummary(unit);
          this.rememberUnitDetail(unit);
        }
        return unit;
      }),
    );
  }

  syncUnitInsuranceExpenses(unitId: string): Observable<Unit> {
    const keepId = unitId.trim();
    const requestId = this.requestGen.next();
    return this.unitsApi.postUnitInsuranceSyncExpenses(keepId).pipe(
      map((saved) => {
        const unit = normalizeUnitFromApi(saved);
        if (this.canApplyResponse(requestId)) {
          this.upsertUnitInList(unit, keepId);
          this.rememberUnitDetail(unit);
        }
        return unit;
      }),
    );
  }

  createUnit(payload: CreateUnitPayload): Observable<Unit> {
    const requestId = this.requestGen.next();
    return this.unitsApi.postUnit(payload).pipe(
      map((created) => {
        const unit = normalizeUnitFromApi(created);
        if (this.canApplyResponse(requestId)) {
          this.upsertUnitInList(unit, null);
          this.rememberUnitDetail(unit);
        }
        return unit;
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
            this._hydrated.set(true);
          }
        }),
      )
      .subscribe({
        next: (list) => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this.applyList(list, this._selectedUnitId());
        },
        error: () => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this.applyList([], this._selectedUnitId());
        },
      });
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  private fetchList(): Observable<Unit[]> {
    return coalesceInFlightRequest(this.listFetchInFlight, () =>
      this.unitsApi.getUnitsList().pipe(
        map((rows) => rows.map(normalizeUnitFromApi)),
        catchError(() => of([] as Unit[])),
      ),
    );
  }

  /** Tras enganche/desenganche u otro cambio que invalida GET /units/:id en caché. */
  invalidateUnitDetail(unitId: string): void {
    this.unitDetailCache.invalidate(unitId);
  }

  /** Detalle completo (historial + tenure) para el drawer. */
  fetchUnitDetail(unitId: string): Observable<Unit | null> {
    const id = unitId.trim();
    if (!id) {
      return of(null);
    }
    const cached = this.unitDetailCache.get(id);
    if (cached) {
      return of(cached);
    }
    const slot = this.unitDetailInFlightSlot(id);
    return coalesceInFlightRequest(slot, () =>
      this.unitsApi.getUnitById(id).pipe(
        map((row) => {
          const unit = normalizeUnitFromApi(row);
          this.rememberUnitDetail(unit);
          return unit;
        }),
        catchError(() => of(null)),
      ),
    );
  }

  private rememberUnitDetail(unit: Unit): void {
    this.unitDetailCache.set(unit.id, unit);
  }

  private unitDetailInFlightSlot(id: string): {
    current: Observable<Unit | null> | null;
  } {
    let slot = this.unitDetailFetchInFlight.get(id);
    if (!slot) {
      slot = { current: null };
      this.unitDetailFetchInFlight.set(id, slot);
    }
    return slot;
  }

  /** Actualiza fila del listado con un resumen (tras save del drawer). */
  upsertUnitSummary(saved: Unit): void {
    const summary = this.toListSummary(saved);
    this.upsertUnitInList(summary, this._selectedUnitId());
  }

  private toListSummary(unit: Unit): Unit {
    const meta = unit.fleetMeta;
    if (!meta) {
      return unit;
    }
    const {
      maintenanceEntries: _m,
      verificationEntries: _v,
      documentMaintenanceNames: _d1,
      documentVerificationNames: _d2,
      documentPolicyNames: _d3,
      documentOwnershipNames: _d4,
      fleetDocuments: _d5,
      trailerTenureMode: _t1,
      trailerCommercialValue: _t2,
      trailerRecurringPaymentAmount: _t3,
      trailerRecurringPaymentDate: _t4,
      trailerRecurringInstallmentCount: _t5,
      trailerManagementOwnerPayout: _t6,
      ...summaryMeta
    } = meta;
    return { ...unit, fleetMeta: summaryMeta };
  }

  private applyList(list: Unit[], selectedId: string | null): void {
    this._units.set(list);
    if (!selectedId) {
      return;
    }
    if (list.some((u) => u.id === selectedId)) {
      this._selectedUnitId.set(selectedId);
      return;
    }
    this._selectedUnitId.set(null);
  }

  private upsertUnitInList(saved: Unit, selectedId: string | null): void {
    const list = this._units();
    const idx = list.findIndex((u) => u.id === saved.id);
    const next = idx >= 0 ? list.map((u, i) => (i === idx ? saved : u)) : [...list, saved];
    this.applyList(next, selectedId);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    this.listFetchInFlight.current = null;
    this.unitDetailCache.clear();
    this.unitDetailFetchInFlight.clear();
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._units.set([]);
    this._selectedUnitId.set(null);
    this._loading.set(false);
    this._hydrated.set(false);
    this.initialLoadStarted = false;
  }
}

function placeholderUnit(id: string): Unit {
  return { id, plate: '', capacityKg: 0, status: '' };
}
