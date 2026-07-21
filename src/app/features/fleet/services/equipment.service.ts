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

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;

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
    return this._equipment().find((e) => e.id === id) ?? null;
  });
  readonly loading = this._loading.asReadonly();

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

  updateEquipment(
    equipment: Equipment,
    draft?: EquipmentPersistDraft,
    options?: EquipmentUpdateOptions,
  ): Observable<Equipment> {
    const keepId = this._selectedEquipmentId();
    const requestId = this.requestGen.next();
    return this.equipmentApi.patchEquipment(equipment, draft).pipe(
      switchMap((saved) => {
        if (options?.skipListRefresh) {
          if (this.canApplyResponse(requestId)) {
            this.upsertEquipmentSummary(saved);
          }
          return of(saved);
        }
        return this.fetchList().pipe(
          map((list) => {
            if (!this.canApplyResponse(requestId)) {
              const fallbackId = keepId ?? equipment.id;
              return this._equipment().find((e) => e.id === fallbackId) ?? equipment;
            }
            this.applyList(list, keepId);
            const resolvedId = keepId ?? equipment.id;
            return this._equipment().find((e) => e.id === resolvedId) ?? equipment;
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
      switchMap((saved) =>
        this.fetchList().pipe(
          map((list) => {
            if (this.canApplyResponse(requestId)) {
              this.applyList(list, keepId);
            }
            return saved;
          }),
        ),
      ),
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
    return this.equipmentApi
      .getEquipmentList()
      .pipe(
        map((rows) => rows.map(normalizeEquipmentFromApi)),
        catchError(() => of([] as Equipment[])),
      );
  }

  fetchEquipmentDetail(equipmentId: string): Observable<Equipment | null> {
    const id = equipmentId.trim();
    if (!id) {
      return of(null);
    }
    return this.equipmentApi.getEquipmentById(id).pipe(
      map((row) => normalizeEquipmentFromApi(row)),
      catchError(() => of(null)),
    );
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
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._equipment.set([]);
    this._selectedEquipmentId.set(null);
    this._loading.set(false);
    this.initialLoadStarted = false;
  }
}
