import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { ClientsService } from '@services/api/clients';
import { OperatorsService } from '@services/api/operators';
import { UnitsService } from '@services/api/units';
import { ExpensesService } from '@services/api/expenses';
import type { Client } from '@shared/models/client.models';
import type { Expense, Operator, Unit } from '@shared/models/logistics.models';
import {
  buildFleetCoverageExpensesPageParams,
  fleetCoverageExpensesQueryRange,
} from '@features/fleet/utils/fleet-coverage-expenses.util';
import { createRequestGeneration } from '@shared/utils/request-generation';
import { catchError, finalize, forkJoin, map, of, Subscription } from 'rxjs';

/**
 * Catálogos para formularios de trips (lazy, scope de `/trips`).
 * Cada catálogo se carga bajo demanda según la interacción del usuario
 * (autocomplete de cliente, foco en unidad/operador); ninguno se descarga
 * al abrir el drawer. Se reutilizan si se cierra y reabre sin salir del módulo.
 */
@Injectable()
export class TripsFormCatalogService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly clientsApi = inject(ClientsService);
  private readonly unitsApi = inject(UnitsService);
  private readonly expensesApi = inject(ExpensesService);
  private readonly operatorsApi = inject(OperatorsService);
  private readonly requestGen = createRequestGeneration();

  private readonly _clients = signal<readonly Client[]>([]);
  private readonly _units = signal<readonly Unit[]>([]);
  private readonly _fleetCoverageExpenses = signal<readonly Expense[]>([]);
  private readonly _operators = signal<readonly Operator[]>([]);
  private readonly _clientsLoading = signal(false);
  private readonly _fleetLoading = signal(false);
  private readonly _operatorsLoading = signal(false);

  private disposed = false;
  private clientsStarted = false;
  private fleetStarted = false;
  private operatorsStarted = false;
  private readonly loadSubs: Subscription[] = [];
  private complianceSub: Subscription | null = null;
  private complianceKey = '';

  readonly clients = this._clients.asReadonly();
  readonly units = this._units.asReadonly();
  readonly fleetCoverageExpenses = this._fleetCoverageExpenses.asReadonly();
  readonly operators = this._operators.asReadonly();
  readonly clientsLoading = this._clientsLoading.asReadonly();
  readonly fleetLoading = this._fleetLoading.asReadonly();
  readonly operatorsLoading = this._operatorsLoading.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  /** Clientes; se dispara cuando el usuario escribe ≥3 caracteres en el autocomplete. */
  ensureClientsLoaded(): void {
    if (this.disposed || this.clientsStarted) {
      return;
    }
    this.clientsStarted = true;
    const requestId = this.requestGen.next();
    this._clientsLoading.set(true);
    this.loadSubs.push(
      this.clientsApi
        .getClientsList()
        .pipe(
          catchError(() => of([] as Client[])),
          finalize(() => {
            if (this.requestGen.isCurrent(requestId)) {
              this._clientsLoading.set(false);
            }
          }),
        )
        .subscribe((rows) => {
          if (this.canApplyResponse(requestId)) {
            this._clients.set(rows);
          }
        }),
    );
  }

  /**
   * Unidades disponibles; se dispara al enfocar el input de unidad.
   * Cada unidad ya incluye sus equipos enganchados (`hitchedEquipment`),
   * por lo que no se necesita el catálogo de /equipment.
   */
  ensureUnitsLoaded(): void {
    if (this.disposed || this.fleetStarted) {
      return;
    }
    this.fleetStarted = true;
    const requestId = this.requestGen.next();
    this._fleetLoading.set(true);
    this.loadSubs.push(
      this.unitsApi
        .getUnitsList({ available: true })
        .pipe(
          catchError(() => of([] as Unit[])),
          finalize(() => {
            if (this.requestGen.isCurrent(requestId)) {
              this._fleetLoading.set(false);
            }
          }),
        )
        .subscribe((rows) => {
          if (this.canApplyResponse(requestId)) {
            this._units.set(rows);
          }
        }),
    );
  }

  /** Operadores disponibles; se dispara al enfocar el input de operador. */
  ensureOperatorsLoaded(): void {
    if (this.disposed || this.operatorsStarted) {
      return;
    }
    this.operatorsStarted = true;
    const requestId = this.requestGen.next();
    this._operatorsLoading.set(true);
    this.loadSubs.push(
      this.operatorsApi
        .getOperatorsList({ available: true })
        .pipe(
          catchError(() => of([] as Operator[])),
          finalize(() => {
            if (this.requestGen.isCurrent(requestId)) {
              this._operatorsLoading.set(false);
            }
          }),
        )
        .subscribe((rows) => {
          if (this.canApplyResponse(requestId)) {
            this._operators.set(rows);
          }
        }),
    );
  }

  /**
   * Gastos de seguro/GPS solo para la unidad y remolques seleccionados (iconos de cumplimiento).
   */
  ensureComplianceExpenses(unitId: string, equipmentIds: readonly string[]): void {
    if (this.disposed) {
      return;
    }
    const uid = unitId.trim();
    const eqIds = [
      ...new Set(equipmentIds.map((id) => id.trim()).filter(Boolean)),
    ].sort();
    const key = `${uid}|${eqIds.join(',')}`;
    if (key === this.complianceKey) {
      return;
    }
    this.complianceKey = key;
    this.complianceSub?.unsubscribe();
    if (!uid && eqIds.length === 0) {
      this._fleetCoverageExpenses.set([]);
      return;
    }

    const range = fleetCoverageExpensesQueryRange();
    const requests = [];
    if (uid) {
      requests.push(
        this.expensesApi
          .getExpensesPage(
            buildFleetCoverageExpensesPageParams(
              { resource: 'unit', unitId: uid },
              'insurance',
              range,
            ),
          )
          .pipe(map((r) => r.items), catchError(() => of([] as Expense[]))),
        this.expensesApi
          .getExpensesPage(
            buildFleetCoverageExpensesPageParams({ resource: 'unit', unitId: uid }, 'gps', range),
          )
          .pipe(map((r) => r.items), catchError(() => of([] as Expense[]))),
      );
    }
    for (const equipmentId of eqIds) {
      requests.push(
        this.expensesApi
          .getExpensesPage(
            buildFleetCoverageExpensesPageParams(
              { resource: 'equipment', equipmentId },
              'insurance',
              range,
            ),
          )
          .pipe(map((r) => r.items), catchError(() => of([] as Expense[]))),
      );
    }
    if (requests.length === 0) {
      this._fleetCoverageExpenses.set([]);
      return;
    }

    this.complianceSub = forkJoin(requests)
      .pipe(map((chunks) => chunks.flat()))
      .subscribe((rows) => {
        if (!this.disposed) {
          this._fleetCoverageExpenses.set(rows);
        }
      });
  }

  private canApplyResponse(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  private clearCatalogSignals(): void {
    this._clients.set([]);
    this._units.set([]);
    this._fleetCoverageExpenses.set([]);
    this._operators.set([]);
    this.complianceKey = '';
  }

  /** Destrucción terminal al salir del feature (no reutilizar instancia). */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    for (const sub of this.loadSubs) {
      sub.unsubscribe();
    }
    this.loadSubs.length = 0;
    this.complianceSub?.unsubscribe();
    this.complianceSub = null;
    this.clearCatalogSignals();
    this._clientsLoading.set(false);
    this._fleetLoading.set(false);
    this._operatorsLoading.set(false);
  }
}
