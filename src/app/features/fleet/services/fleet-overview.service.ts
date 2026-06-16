import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { FleetApiService } from '@services/api/fleet';
import type {
  FleetOverviewEquipmentRowDto,
  FleetOverviewItemDto,
  FleetOverviewResponseDto,
} from '@shared/models/api/fleet-overview.model';
import { createRequestGeneration } from '@shared/utils/request-generation';

const EMPTY_OVERVIEW: FleetOverviewResponseDto = { items: [], equipment: [] };

@Injectable()
export class FleetOverviewFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fleetApi = inject(FleetApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _overview = signal<FleetOverviewResponseDto>(EMPTY_OVERVIEW);
  private readonly _loading = signal(false);

  private moduleLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly overview = this._overview.asReadonly();
  readonly items = computed(() => this._overview().items);
  readonly equipmentRows = computed(() => this._overview().equipment);
  readonly loading = this._loading.asReadonly();

  loadOverview(): void {
    if (this.disposed || this.moduleLoadStarted) {
      return;
    }
    this.moduleLoadStarted = true;
    this.runFetch();
  }

  refreshOverview(): void {
    if (this.disposed) {
      return;
    }
    this.runFetch();
  }

  findItemByUnitId(unitId: string): FleetOverviewItemDto | undefined {
    const n = Number(unitId);
    if (!Number.isFinite(n)) {
      return undefined;
    }
    return this.items().find((i) => i.unitId === n);
  }

  findEquipmentRow(equipmentId: string): FleetOverviewEquipmentRowDto | undefined {
    const n = Number(equipmentId);
    if (!Number.isFinite(n)) {
      return undefined;
    }
    return this.equipmentRows().find((e) => e.equipmentId === n);
  }

  private runFetch(): void {
    if (this.disposed) {
      return;
    }
    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    this._loading.set(true);
    this.fetchSub = this.fleetApi
      .getFleetOverview()
      .pipe(
        catchError(() => of(EMPTY_OVERVIEW)),
        finalize(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._loading.set(false);
          }
        }),
      )
      .subscribe({
        next: (data) => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this._overview.set({
            items: Array.isArray(data.items) ? data.items : [],
            equipment: Array.isArray(data.equipment) ? data.equipment : [],
          });
        },
      });
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._overview.set(EMPTY_OVERVIEW);
    this._loading.set(false);
    this.moduleLoadStarted = false;
  }
}
