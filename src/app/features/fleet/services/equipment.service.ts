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
import { EquipmentService as EquipmentApiService } from '@services/api/equipment';
import type { CreateEquipmentPayload } from '@shared/models/api/api-fleet.model';
import type { FleetMaintenanceAction } from '@shared/models/api/api-fleet-operational-status.model';
import type { Equipment } from '@shared/models/logistics.models';
import type { EquipmentPersistDraft } from '@shared/utils/fleet/equipment-api-payload';
import { FleetEntityDetailCache } from '@features/fleet/utils/fleet-entity-detail-cache';
import { coalesceInFlightRequest } from '@shared/utils/coalesce-in-flight-request';
import { createRequestGeneration } from '@shared/utils/request-generation';
import { normalizeEquipmentFromApi } from '@shared/utils/fleet/normalize-fleet-entities';

export type EquipmentUpdateOptions = {
  /** Evita GET de lista tras PATCH cuando el caller refrescará el módulo (p. ej. `refreshFleetModule`). */
  skipListRefresh?: boolean;
};

@Injectable()
export class EquipmentFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly equipmentApi = inject(EquipmentApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _equipment = signal<readonly Equipment[]>([]);
  private readonly _selectedEquipmentId = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _hydrated = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;
  private readonly listFetchInFlight: { current: Observable<Equipment[]> | null } = {
    current: null,
  };
  private readonly equipmentDetailCache = new FleetEntityDetailCache<Equipment>();
  private readonly equipmentDetailFetchInFlight = new Map<
    string,
    { current: Observable<Equipment | null> | null }
  >();

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly equipment = this._equipment.asReadonly();
  readonly selectedEquipmentId = this._selectedEquipmentId.asReadonly();
  readonly selectedEquipment = computed(() => {
    const id = this._selectedEquipmentId();
    if (!id) {
      return null;
    }
    const found = this._equipment().find((e) => e.id === id);
    if (found) {
      return found;
    }
    // El drawer puede abrir desde overview antes de hidratar GET /equipment.
    if (!this._hydrated()) {
      return placeholderEquipment(id);
    }
    return null;
  });
  readonly loading = this._loading.asReadonly();
  /** True tras el primer fetch (éxito o error). */
  readonly hydrated = this._hydrated.asReadonly();

  hasLoadedOnce(): boolean {
    return this.initialLoadStarted;
  }

  loadEquipment(): void {
    if (this.disposed) {
      return;
    }
    if (this.initialLoadStarted) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  refreshEquipment(): void {
    if (this.disposed) {
      return;
    }
    this.runFetch();
  }

  selectEquipment(equipmentId: string): void {
    this._selectedEquipmentId.set(equipmentId);
  }

  clearSelection(): void {
    this._selectedEquipmentId.set(null);
  }

  /** PATCH devuelve detalle completo; el observable emite esa respuesta. */
  updateEquipment(
    equipment: Equipment,
    draft?: EquipmentPersistDraft,
    options?: EquipmentUpdateOptions,
  ): Observable<Equipment> {
    const keepId = this._selectedEquipmentId();
    const requestId = this.requestGen.next();
    return this.equipmentApi.patchEquipment(equipment, draft).pipe(
      switchMap((saved) => {
        const normalized = normalizeEquipmentFromApi(saved);
        if (options?.skipListRefresh) {
          if (this.canApplyResponse(requestId)) {
            this.upsertEquipmentSummary(normalized);
            this.rememberEquipmentDetail(normalized);
          }
          return of(normalized);
        }
        return this.fetchList().pipe(
          map((list) => {
            if (this.canApplyResponse(requestId)) {
              this.applyList(list, keepId);
              this.upsertEquipmentSummary(normalized);
              this.rememberEquipmentDetail(normalized);
            }
            return normalized;
          }),
        );
      }),
    );
  }

  deleteEquipment(equipmentId: string): Observable<void> {
    const requestId = this.requestGen.next();
    return this.equipmentApi.deleteEquipment(equipmentId).pipe(
      switchMap(() => this.fetchList()),
      map((list) => {
        if (this.canApplyResponse(requestId)) {
          this.applyList(list, null);
          this.equipmentDetailCache.invalidate(equipmentId);
        }
      }),
      map(() => void 0),
    );
  }

  setEquipmentMaintenance(
    equipmentId: string,
    action: FleetMaintenanceAction,
  ): Observable<Equipment> {
    const keepId = equipmentId.trim();
    const requestId = this.requestGen.next();
    return this.equipmentApi.postEquipmentMaintenance(keepId, action).pipe(
      map((saved) => {
        const equipment = normalizeEquipmentFromApi(saved);
        if (this.canApplyResponse(requestId)) {
          this.upsertEquipmentSummary(equipment);
          this.rememberEquipmentDetail(equipment);
        }
        return equipment;
      }),
    );
  }

  syncEquipmentInsuranceExpenses(equipmentId: string): Observable<Equipment> {
    const keepId = equipmentId.trim();
    const requestId = this.requestGen.next();
    return this.equipmentApi.postEquipmentInsuranceSyncExpenses(keepId).pipe(
      map((saved) => {
        const equipment = normalizeEquipmentFromApi(saved);
        if (this.canApplyResponse(requestId)) {
          this.upsertEquipmentInList(equipment, keepId);
          this.rememberEquipmentDetail(equipment);
        }
        return equipment;
      }),
    );
  }

  createEquipment(payload: CreateEquipmentPayload): Observable<Equipment> {
    const requestId = this.requestGen.next();
    return this.equipmentApi.postEquipment(payload).pipe(
      map((created) => {
        const equipment = normalizeEquipmentFromApi(created);
        if (this.canApplyResponse(requestId)) {
          this.upsertEquipmentInList(equipment, null);
          this.rememberEquipmentDetail(equipment);
        }
        return equipment;
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
          this.applyList(list, this._selectedEquipmentId());
        },
        error: () => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this.applyList([], this._selectedEquipmentId());
        },
      });
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  private fetchList(): Observable<Equipment[]> {
    return coalesceInFlightRequest(this.listFetchInFlight, () =>
      this.equipmentApi.getEquipmentList().pipe(
        map((rows) => rows.map(normalizeEquipmentFromApi)),
        catchError(() => of([] as Equipment[])),
      ),
    );
  }

  fetchEquipmentDetail(equipmentId: string): Observable<Equipment | null> {
    const id = equipmentId.trim();
    if (!id) {
      return of(null);
    }
    const cached = this.equipmentDetailCache.get(id);
    if (cached) {
      return of(cached);
    }
    const slot = this.equipmentDetailInFlightSlot(id);
    return coalesceInFlightRequest(slot, () =>
      this.equipmentApi.getEquipmentById(id).pipe(
        map((row) => {
          const equipment = normalizeEquipmentFromApi(row);
          this.rememberEquipmentDetail(equipment);
          return equipment;
        }),
        catchError(() => of(null)),
      ),
    );
  }

  private rememberEquipmentDetail(equipment: Equipment): void {
    this.equipmentDetailCache.set(equipment.id, equipment);
  }

  private equipmentDetailInFlightSlot(id: string): {
    current: Observable<Equipment | null> | null;
  } {
    let slot = this.equipmentDetailFetchInFlight.get(id);
    if (!slot) {
      slot = { current: null };
      this.equipmentDetailFetchInFlight.set(id, slot);
    }
    return slot;
  }

  upsertEquipmentSummary(saved: Equipment): void {
    const summary = this.toListSummary(saved);
    this.upsertEquipmentInList(summary, this._selectedEquipmentId());
  }

  private toListSummary(equipment: Equipment): Equipment {
    const meta = equipment.fleetMeta;
    if (!meta) {
      return equipment;
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
      trailerRecurringPaymentCadence: _t6,
      trailerTenureBeneficiary: _t7,
      trailerManagementOwnerPayout: _t8,
      ...summaryMeta
    } = meta;
    return { ...equipment, fleetMeta: summaryMeta };
  }

  private applyList(list: Equipment[], selectedId: string | null): void {
    this._equipment.set(list);
    if (!selectedId) {
      return;
    }
    if (list.some((e) => e.id === selectedId)) {
      this._selectedEquipmentId.set(selectedId);
      return;
    }
    this._selectedEquipmentId.set(null);
  }

  private upsertEquipmentInList(saved: Equipment, selectedId: string | null): void {
    const list = this._equipment();
    const idx = list.findIndex((e) => e.id === saved.id);
    const next = idx >= 0 ? list.map((e, i) => (i === idx ? saved : e)) : [...list, saved];
    this.applyList(next, selectedId);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    this.listFetchInFlight.current = null;
    this.equipmentDetailCache.clear();
    this.equipmentDetailFetchInFlight.clear();
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._equipment.set([]);
    this._selectedEquipmentId.set(null);
    this._loading.set(false);
    this._hydrated.set(false);
    this.initialLoadStarted = false;
  }
}

function placeholderEquipment(id: string): Equipment {
  return { id, unitId: '', name: '', serialNumber: '', lastServiceDate: '' };
}
