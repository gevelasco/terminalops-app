import { Injectable, inject, signal } from '@angular/core';
import { ClientsService } from '@services/api/clients';
import { EquipmentService } from '@services/api/equipment';
import { OperatorsService } from '@services/api/operators';
import { UnitsService } from '@services/api/units';
import type { Client } from '@shared/models/client.models';
import type { Equipment, Operator, Unit } from '@shared/models/logistics.models';
import { catchError, forkJoin, Observable, of, shareReplay, tap } from 'rxjs';

export type ManiobraFormCatalog = {
  clients: Client[];
  units: Unit[];
  operators: Operator[];
  equipment: Equipment[];
};

@Injectable({ providedIn: 'root' })
export class ManiobraFormCatalogService {
  private readonly clientsApi = inject(ClientsService);
  private readonly unitsApi = inject(UnitsService);
  private readonly operatorsApi = inject(OperatorsService);
  private readonly equipmentApi = inject(EquipmentService);

  private load$?: Observable<ManiobraFormCatalog>;

  readonly clients = signal<Client[]>([]);
  readonly units = signal<Unit[]>([]);
  readonly operators = signal<Operator[]>([]);
  readonly equipment = signal<Equipment[]>([]);
  readonly ready = signal(false);
  readonly loading = signal(false);

  ensureLoaded(): Observable<ManiobraFormCatalog> {
    if (this.ready()) {
      return of({
        clients: this.clients(),
        units: this.units(),
        operators: this.operators(),
        equipment: this.equipment(),
      });
    }
    if (!this.load$) {
      this.loading.set(true);
      this.load$ = forkJoin({
        clients: this.clientsApi.getClientsList().pipe(catchError(() => of([]))),
        units: this.unitsApi.getUnitsList().pipe(catchError(() => of([]))),
        operators: this.operatorsApi.getOperatorsList().pipe(catchError(() => of([]))),
        equipment: this.equipmentApi.getEquipmentList().pipe(catchError(() => of([]))),
      }).pipe(
        tap((bundle) => {
          this.clients.set(bundle.clients);
          this.units.set(bundle.units);
          this.operators.set(bundle.operators);
          this.equipment.set(bundle.equipment);
          this.ready.set(true);
          this.loading.set(false);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.load$;
  }

  reset(): void {
    this.load$ = undefined;
    this.clients.set([]);
    this.units.set([]);
    this.operators.set([]);
    this.equipment.set([]);
    this.ready.set(false);
    this.loading.set(false);
  }
}
