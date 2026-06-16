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
            this.upsertEquipmentInList(saved, keepId);
          }
          const resolvedId = keepId ?? equipment.id;
          return of(this._equipment().find((e) => e.id === resolvedId) ?? saved);
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
      .getEquipmentList({ includeFleetTenure: true })
      .pipe(
        map((rows) => rows.map(normalizeEquipmentFromApi)),
        catchError(() => of([] as Equipment[])),
      );
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
