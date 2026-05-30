import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { UsersService } from '@core/services/api/users';
import { ClientsService } from '@services/api/clients';
import { EquipmentService } from '@services/api/equipment';
import { OperatorsService } from '@services/api/operators';
import { UnitsService } from '@services/api/units';
import type { Client } from '@shared/models/client.models';
import type { Equipment, Operator, Unit } from '@shared/models/logistics.models';
import { createRequestGeneration } from '@shared/utils/request-generation';
import { catchError, finalize, forkJoin, of, Subscription } from 'rxjs';

/**
 * Catálogos para formularios de trips (lazy, route-scoped).
 * Solo debe cargarse al abrir drawer de creación/edición — no en listado ni detalle view.
 */
@Injectable()
export class TripsFormCatalogService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly clientsApi = inject(ClientsService);
  private readonly unitsApi = inject(UnitsService);
  private readonly operatorsApi = inject(OperatorsService);
  private readonly equipmentApi = inject(EquipmentService);
  private readonly usersApi = inject(UsersService);
  private readonly requestGen = createRequestGeneration();

  private readonly _clients = signal<readonly Client[]>([]);
  private readonly _units = signal<readonly Unit[]>([]);
  private readonly _operators = signal<readonly Operator[]>([]);
  private readonly _equipment = signal<readonly Equipment[]>([]);
  private readonly _currentUsername = signal<string | null>(null);
  private readonly _ready = signal(false);
  private readonly _loading = signal(false);

  private disposed = false;
  private loadSub: Subscription | null = null;

  readonly clients = this._clients.asReadonly();
  readonly units = this._units.asReadonly();
  readonly operators = this._operators.asReadonly();
  readonly equipment = this._equipment.asReadonly();
  readonly currentUsername = this._currentUsername.asReadonly();
  readonly ready = this._ready.asReadonly();
  readonly loading = this._loading.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  /** Carga bajo demanda; idempotente mientras el usuario permanezca en `/trips`. */
  ensureLoaded(): void {
    if (this.disposed || this._ready() || this._loading()) {
      return;
    }
    this.runLoad();
  }

  private runLoad(): void {
    if (this.disposed) {
      return;
    }
    const requestId = this.requestGen.next();
    this.loadSub?.unsubscribe();
    this._loading.set(true);
    this.loadSub = forkJoin({
      clients: this.clientsApi.getClientsList().pipe(catchError(() => of([] as Client[]))),
      units: this.unitsApi
        .getUnitsList({ available: true })
        .pipe(catchError(() => of([] as Unit[]))),
      operators: this.operatorsApi
        .getOperatorsList({ available: true })
        .pipe(catchError(() => of([] as Operator[]))),
      equipment: this.equipmentApi
        .getEquipmentList()
        .pipe(catchError(() => of([] as Equipment[]))),
      me: this.usersApi.getMe().pipe(catchError(() => of(null))),
    })
      .pipe(
        finalize(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._loading.set(false);
          }
        }),
      )
      .subscribe({
        next: (bundle) => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this._clients.set(bundle.clients);
          this._units.set(bundle.units);
          this._operators.set(bundle.operators);
          this._equipment.set(bundle.equipment);
          const username = bundle.me?.username?.trim();
          this._currentUsername.set(username || null);
          this._ready.set(true);
        },
        error: () => {
          if (!this.canApplyResponse(requestId)) {
            return;
          }
          this.clearCatalogSignals();
        },
      });
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  private clearCatalogSignals(): void {
    this._clients.set([]);
    this._units.set([]);
    this._operators.set([]);
    this._equipment.set([]);
    this._currentUsername.set(null);
    this._ready.set(false);
  }

  /** Destrucción terminal al salir del feature (no reutilizar instancia). */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    this.loadSub?.unsubscribe();
    this.loadSub = null;
    this.clearCatalogSignals();
    this._loading.set(false);
  }
}
