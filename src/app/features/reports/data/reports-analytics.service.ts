import { Injectable, inject } from '@angular/core';
import { catchError, forkJoin, Observable, of } from 'rxjs';
import { ManiobraRepository } from '@features/maniobra/data/maniobra.repository';
import { ExpenseRepository } from '@features/expenses/data/expense.repository';
import { UnitRepository } from '@features/fleet/data/unit.repository';
import { EquipmentRepository } from '@features/fleet/data/equipment.repository';
import { OperatorRepository } from '@features/operators/data/operator.repository';
import { ClientRepository } from '@shared/data/client.repository';
import type { ReportsFilter } from '../models/reports-view.models';
import {
  buildFilteredBundle,
  type ReportsRawBundle,
} from '../utils/reports-bundle-filter';
import { previousPeriodRange } from '../utils/reports-filter';
import { buildGeneralTabView } from '../utils/reports-general-metrics';
import { buildManiobrasTabView } from '../utils/reports-maniobra-metrics';
import { buildBalanceTabView } from '../utils/reports-financial-metrics';
import { buildFleetTabView } from '../utils/reports-fleet-metrics';
export type ReportsAnalyticsView = {
  general: ReturnType<typeof buildGeneralTabView>;
  maniobras: ReturnType<typeof buildManiobrasTabView>;
  balance: ReturnType<typeof buildBalanceTabView>;
  fleet: ReturnType<typeof buildFleetTabView>;
};

@Injectable({ providedIn: 'root' })
export class ReportsAnalyticsService {
  private readonly maniobrasRepo = inject(ManiobraRepository);
  private readonly expensesRepo = inject(ExpenseRepository);
  private readonly unitsRepo = inject(UnitRepository);
  private readonly equipmentRepo = inject(EquipmentRepository);
  private readonly operatorsRepo = inject(OperatorRepository);
  private readonly clientsRepo = inject(ClientRepository);

  loadRawBundle(): Observable<ReportsRawBundle> {
    return forkJoin({
      trips: this.maniobrasRepo.list().pipe(catchError(() => of([]))),
      expenses: this.expensesRepo.list().pipe(catchError(() => of([]))),
      units: this.unitsRepo.list().pipe(catchError(() => of([]))),
      equipment: this.equipmentRepo.list().pipe(catchError(() => of([]))),
      operators: this.operatorsRepo.list().pipe(catchError(() => of([]))),
      clients: this.clientsRepo.list().pipe(catchError(() => of([]))),
    });
  }

  buildView(raw: ReportsRawBundle, filter: ReportsFilter): ReportsAnalyticsView {
    const prev = previousPeriodRange(filter.from, filter.to);
    const bundle = buildFilteredBundle(raw, filter, prev);
    return {
      general: buildGeneralTabView(bundle, filter),
      maniobras: buildManiobrasTabView(bundle),
      balance: buildBalanceTabView(bundle, filter),
      fleet: buildFleetTabView(bundle, filter),
    };
  }
}
