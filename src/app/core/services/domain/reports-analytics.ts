import { Injectable, inject } from '@angular/core';
import { catchError, forkJoin, Observable, of } from 'rxjs';
import { ClientsService } from '@services/api/clients';
import { EquipmentService } from '@services/api/equipment';
import { ExpensesService } from '@services/api/expenses';
import { OperatorsService } from '@services/api/operators';
import { UnitsService } from '@services/api/units';
import type { ReportsFilter } from '@features/reports/models/reports-view.models';
import {
  buildFilteredBundle,
  type ReportsRawBundle,
} from '@features/reports/utils/reports-bundle-filter';
import { previousPeriodRange } from '@features/reports/utils/reports-filter';
import { buildGeneralTabView } from '@features/reports/utils/reports-general-metrics';
import { buildManiobrasTabView } from '@features/reports/utils/reports-maniobra-metrics';
import { buildBalanceTabView } from '@features/reports/utils/reports-financial-metrics';
import { buildFleetTabView } from '@features/reports/utils/reports-fleet-metrics';

export type ReportsAnalyticsView = {
  general: ReturnType<typeof buildGeneralTabView>;
  maniobras: ReturnType<typeof buildManiobrasTabView>;
  balance: ReturnType<typeof buildBalanceTabView>;
  fleet: ReturnType<typeof buildFleetTabView>;
};

@Injectable({ providedIn: 'root' })
export class ReportsAnalyticsService {
  private readonly expensesApi = inject(ExpensesService);
  private readonly unitsApi = inject(UnitsService);
  private readonly equipmentApi = inject(EquipmentService);
  private readonly operatorsApi = inject(OperatorsService);
  private readonly clientsApi = inject(ClientsService);

  loadRawBundle(): Observable<ReportsRawBundle> {
    return forkJoin({
      trips: of([]),
      expenses: this.expensesApi.getExpensesList().pipe(catchError(() => of([]))),
      units: this.unitsApi.getUnitsList().pipe(catchError(() => of([]))),
      equipment: this.equipmentApi.getEquipmentList().pipe(catchError(() => of([]))),
      operators: this.operatorsApi.getOperatorsList().pipe(catchError(() => of([]))),
      clients: this.clientsApi.getClientsList().pipe(catchError(() => of([]))),
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
