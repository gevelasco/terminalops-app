import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { UsersService } from '@core/services/api/users';
import { ClientsService } from '@services/api/clients';
import { OperatorsService } from '@services/api/operators';
import { UnitsService } from '@services/api/units';
import { EquipmentService } from '@services/api/equipment';
import { ExpensesService } from '@services/api/expenses';
import type { Client } from '@shared/models/client.models';
import type { Equipment, Expense, Operator, Unit } from '@shared/models/logistics.models';
import { fleetCoverageExpensesQueryRange } from '@features/fleet/utils/fleet-coverage-expenses.util';
import { createRequestGeneration } from '@shared/utils/request-generation';
import { catchError, finalize, forkJoin, of, Subscription } from 'rxjs';

/**
 * Catálogos para formularios de trips (lazy, scope de `/trips`).
 * Carga bajo demanda al abrir el drawer de nueva maniobra; se reutiliza si se cierra y reabre sin salir del módulo.
 */
@Injectable()
export class TripsFormCatalogService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly clientsApi = inject(ClientsService);
  private readonly unitsApi = inject(UnitsService);
  private readonly equipmentApi = inject(EquipmentService);
  private readonly expensesApi = inject(ExpensesService);
  private readonly operatorsApi = inject(OperatorsService);
  private readonly usersApi = inject(UsersService);
  private readonly requestGen = createRequestGeneration();

  private readonly _clients = signal<readonly Client[]>([]);
  private readonly _units = signal<readonly Unit[]>([]);
  private readonly _equipment = signal<readonly Equipment[]>([]);
  private readonly _fleetCoverageExpenses = signal<readonly Expense[]>([]);
  private readonly _operators = signal<readonly Operator[]>([]);
  private readonly _currentUsername = signal<string | null>(null);
  private readonly _ready = signal(false);
  private readonly _loading = signal(false);

  private disposed = false;
  private loadSub: Subscription | null = null;

  readonly clients = this._clients.asReadonly();
  readonly units = this._units.asReadonly();
  readonly equipment = this._equipment.asReadonly();
  readonly fleetCoverageExpenses = this._fleetCoverageExpenses.asReadonly();
  readonly operators = this._operators.asReadonly();
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
    const coverageRange = fleetCoverageExpensesQueryRange();
    this.loadSub = forkJoin({
      clients: this.clientsApi.getClientsList().pipe(catchError(() => of([] as Client[]))),
      units: this.unitsApi
        .getUnitsList({ available: true })
        .pipe(catchError(() => of([] as Unit[]))),
      equipment: this.equipmentApi
        .getEquipmentList()
        .pipe(catchError(() => of([] as Equipment[]))),
      insuranceExpenses: this.expensesApi
        .getExpensesPage({
          from: coverageRange.from,
          to: coverageRange.to,
          kind: 'insurance',
          limit: 0,
        })
        .pipe(catchError(() => of({ items: [] as Expense[] }))),
      gpsExpenses: this.expensesApi
        .getExpensesPage({
          from: coverageRange.from,
          to: coverageRange.to,
          kind: 'gps',
          limit: 0,
        })
        .pipe(catchError(() => of({ items: [] as Expense[] }))),
      operators: this.operatorsApi
        .getOperatorsList({ available: true })
        .pipe(catchError(() => of([] as Operator[]))),
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
          this._equipment.set(bundle.equipment);
          this._fleetCoverageExpenses.set([
            ...bundle.insuranceExpenses.items,
            ...bundle.gpsExpenses.items,
          ]);
          this._operators.set(bundle.operators);
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
    this._equipment.set([]);
    this._fleetCoverageExpenses.set([]);
    this._operators.set([]);
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
