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
import { createRequestGeneration } from '@shared/utils/request-generation';
import { normalizeUnitFromApi } from '@shared/utils/fleet/normalize-fleet-entities';

export type UnitUpdateOptions = {
  /** Evita GET de lista tras PATCH cuando el caller actualiza el listado en memoria. */
  skipListRefresh?: boolean;
};

/**
 * Lista de unidades en memoria + selección para el módulo Flota.
 * Carga inicial al entrar al módulo; dispose al salir de la ruta.
 */
@Injectable()
export class UnitsFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _units = signal<readonly Unit[]>([]);
  private readonly _selectedUnitId = signal<string | null>(null);
  private readonly _loading = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;

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
    return this._units().find((u) => u.id === id) ?? null;
  });
  readonly loading = this._loading.asReadonly();

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

  updateUnit(
    unit: Unit,
    draft?: UnitPersistDraft,
    options?: UnitUpdateOptions,
  ): Observable<Unit> {
    const keepId = this._selectedUnitId() ?? unit.id;
    const requestId = this.requestGen.next();
    return this.unitsApi.patchUnit(unit, draft).pipe(
      switchMap((saved) => {
        if (options?.skipListRefresh) {
          const normalized = normalizeUnitFromApi(saved);
          if (this.canApplyResponse(requestId)) {
            this.upsertUnitInList(normalized, keepId);
          }
          return of(this._units().find((u) => u.id === keepId) ?? normalized);
        }
        return this.fetchList().pipe(
          map((list) => {
            if (!this.canApplyResponse(requestId)) {
              return this._units().find((u) => u.id === keepId) ?? unit;
            }
            this.applyList(list, keepId);
            return this._units().find((u) => u.id === keepId) ?? unit;
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
        }
      }),
      map(() => void 0),
    );
  }

  setUnitMaintenance(unitId: string, action: FleetMaintenanceAction): Observable<Unit> {
    const keepId = unitId.trim();
    const requestId = this.requestGen.next();
    return this.unitsApi.postUnitMaintenance(keepId, action).pipe(
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

  syncUnitInsuranceExpenses(unitId: string): Observable<Unit> {
    const keepId = unitId.trim();
    const requestId = this.requestGen.next();
    return this.unitsApi.postUnitInsuranceSyncExpenses(keepId).pipe(
      map((saved) => {
        const unit = normalizeUnitFromApi(saved);
        if (this.canApplyResponse(requestId)) {
          this.upsertUnitInList(unit, keepId);
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
    return this.unitsApi
      .getUnitsList({ includeFleetTenure: true })
      .pipe(
        map((rows) => rows.map(normalizeUnitFromApi)),
        catchError(() => of([] as Unit[])),
      );
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
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._units.set([]);
    this._selectedUnitId.set(null);
    this._loading.set(false);
    this.initialLoadStarted = false;
  }
}
