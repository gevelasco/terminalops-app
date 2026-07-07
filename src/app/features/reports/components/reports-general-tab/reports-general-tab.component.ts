import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { ReportsService } from '@services/api/reports';
import { SessionService } from '@core/services/state/session';
import { buildReportsGeneralActivityAreaOption } from '@features/reports/utils/charts/general/reports-general-activity-area-option';
import { buildReportsGeneralDestinationsBarOption } from '@features/reports/utils/charts/general/reports-general-destinations-bar-option';
import { buildReportsGeneralFlowGaugeOption } from '@features/reports/utils/charts/general/reports-general-flow-gauge-option';
import { buildReportsGeneralFlowTreemapOption } from '@features/reports/utils/charts/general/reports-general-flow-treemap-option';
import { buildReportsGeneralOperationMixPieOption } from '@features/reports/utils/charts/general/reports-general-operation-mix-pie-option';
import { buildReportsGeneralOperatorsRankingOption } from '@features/reports/utils/charts/general/reports-general-operators-ranking-option';
import {
  REPORTS_GENERAL_CHART_COLOR_OFFSET,
  reportsChartPrimary,
} from '@features/reports/utils/charts/reports-chart-palette';
import type { ReportsFilter } from '@features/reports/models/reports-view.models';
import { parseYmd } from '@features/reports/utils/reports-filter';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import type { ReportsGeneralData } from '@shared/models/api/api-reports-general.model';
import { CurrencyMxPipe } from '@shared/pipes/currency-mx.pipe';
import { canAccessModule, isAdminRole } from '@shared/utils/access-control';
import { ToEchartsHostComponent } from '@shared/ui/to-echarts-host/to-echarts-host.component';
import { ToKpiCardComponent } from '@shared/ui/to-kpi-card/to-kpi-card.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';

function pluralEs(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function formatPriorPeriodPercent(value: number | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const signed = value > 0 ? `+${value}` : String(value);
  return `${signed}% vs periodo anterior`;
}

@Component({
  selector: 'app-reports-general-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CurrencyMxPipe],
  imports: [ToKpiCardComponent, ToEchartsHostComponent, ToSkeletonComponent],
  templateUrl: './reports-general-tab.component.html',
  styleUrl: './reports-general-tab.component.scss',
})
export class ReportsGeneralTabComponent {
  private readonly reportsApi = inject(ReportsService);
  private readonly session = inject(SessionService);
  private readonly currencyMx = inject(CurrencyMxPipe);

  readonly filter = input.required<ReportsFilter>();

  private readonly pageState = toSignal(
    toObservable(this.filter).pipe(
      switchMap((params) =>
        this.reportsApi.getGeneral(params).pipe(
          map((data) => ({ loading: false, data })),
          catchError(() => of({ loading: false, data: null })),
          startWith({ loading: true, data: null as ReportsGeneralData | null }),
        ),
      ),
    ),
    { initialValue: { loading: true, data: null as ReportsGeneralData | null } },
  );

  readonly loading = computed(() => this.pageState()?.loading ?? true);

  readonly summary = computed(() => this.pageState()?.data?.summary);
  readonly insights = computed(() => this.pageState()?.data?.insights);

  /** Re-lee el azul del sidemenu al cambiar tema o datos. */
  readonly chartShellColor = computed(() => {
    this.session.theme();
    return reportsChartPrimary();
  });

  readonly showFinancialInsights = computed(() => {
    const role = this.session.role();
    if (isAdminRole(role)) {
      return true;
    }
    return canAccessModule(this.session.allowedModules(), APP_MODULE_CODES.EXPENSES);
  });

  readonly periodSubtitle = computed(() => {
    const f = this.filter();
    const a = parseYmd(f.from);
    const b = parseYmd(f.to);
    if (!a || !b) {
      return '';
    }
    const fmt = new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      year: a.getFullYear() !== b.getFullYear() ? 'numeric' : undefined,
    });
    return `${fmt.format(a)} – ${fmt.format(b)}`;
  });

  readonly activityChartOption = computed(() =>
    buildReportsGeneralActivityAreaOption(this.insights()?.tripActivity ?? [], {
      primaryColor: this.chartShellColor(),
    }),
  );

  readonly flowChartOption = computed(() => {
    const s = this.summary();
    const chartColors = { primaryColor: this.chartShellColor() };
    if (!s) {
      return buildReportsGeneralFlowGaugeOption(0, 0, chartColors);
    }
    if (this.showFinancialInsights()) {
      const distribution = this.insights()?.periodDistribution;
      return buildReportsGeneralFlowTreemapOption(
        {
          collectedRevenue: distribution?.collectedRevenue ?? 0,
          receivableRevenue: distribution?.receivableRevenue ?? 0,
          expensesByRubro: distribution?.expensesByRubro ?? [],
        },
        chartColors,
      );
    }
    return buildReportsGeneralFlowGaugeOption(
      s.completedTripsCount,
      s.tripsScheduledInPeriod,
      chartColors,
    );
  });

  readonly operatorsRankingOption = computed(() =>
    buildReportsGeneralOperatorsRankingOption(
      this.insights()?.topOperators ?? [],
      REPORTS_GENERAL_CHART_COLOR_OFFSET.operators,
      { primaryColor: this.chartShellColor() },
    ),
  );

  readonly topDestinationsOption = computed(() =>
    buildReportsGeneralDestinationsBarOption(
      this.insights()?.topDestinations ?? [],
      REPORTS_GENERAL_CHART_COLOR_OFFSET.destinations,
      { primaryColor: this.chartShellColor() },
    ),
  );

  readonly operationMixOption = computed(() =>
    buildReportsGeneralOperationMixPieOption(
      this.insights()?.operationMix ?? [],
      REPORTS_GENERAL_CHART_COLOR_OFFSET.operationMix,
      { primaryColor: this.chartShellColor() },
    ),
  );

  readonly completedValue = computed(() =>
    String(this.summary()?.completedTripsCount ?? 0),
  );

  readonly completedValueUnit = computed(() => {
    const n = this.summary()?.completedTripsCount ?? 0;
    return pluralEs(n, 'maniobra', 'maniobras');
  });

  readonly completedLegend = computed(() => {
    const avg = this.summary()?.completedTripsDailyAvg ?? 0;
    return `${avg} promedio/día`;
  });

  readonly completedDelta = computed(() =>
    formatPriorPeriodPercent(this.summary()?.completedTripsPriorPeriodPercent),
  );

  readonly revenueValue = computed(() =>
    this.currencyMx.transform(this.summary()?.revenue ?? 0),
  );

  readonly revenueLegend = computed(() => {
    const avg = this.summary()?.avgRevenuePerTrip ?? 0;
    return `${this.currencyMx.transform(avg)} promedio por maniobra`;
  });

  readonly expensesValue = computed(() =>
    this.currencyMx.transform(this.summary()?.expenses ?? 0),
  );

  readonly expensesLegend = computed(() => {
    const n = this.summary()?.expensesCount ?? 0;
    return `${n} ${pluralEs(n, 'gasto', 'gastos')}`;
  });

  readonly marginValue = computed(() =>
    this.currencyMx.transform(this.summary()?.margin ?? 0),
  );

  readonly marginLegend = computed(() => {
    const s = this.summary();
    if (!s) {
      return '';
    }
    return `Cobro ${this.currencyMx.transform(s.revenue)} − gastos ${this.currencyMx.transform(s.expenses)}`;
  });

  readonly marginTone = computed((): 'up' | 'down' | 'neutral' => {
    const m = this.summary()?.margin ?? 0;
    if (m > 0) {
      return 'up';
    }
    if (m < 0) {
      return 'down';
    }
    return 'neutral';
  });

  readonly inTransitValue = computed(() => String(this.summary()?.tripsInTransit ?? 0));

  readonly inTransitValueUnit = computed(() => {
    const n = this.summary()?.tripsInTransit ?? 0;
    return pluralEs(n, 'maniobra', 'maniobras');
  });

  readonly inTransitLegend = computed(() => 'Estado en vivo');

  readonly scheduledValue = computed(() =>
    String(this.summary()?.tripsScheduledInPeriod ?? 0),
  );

  readonly scheduledValueUnit = computed(() => {
    const n = this.summary()?.tripsScheduledInPeriod ?? 0;
    return pluralEs(n, 'maniobra', 'maniobras');
  });

  readonly scheduledLegend = computed(() => 'Salida planificada en el periodo');

  readonly unitsUsedValue = computed(() => String(this.summary()?.unitsUsed ?? 0));

  readonly unitsUsedValueUnit = computed(() => {
    const n = this.summary()?.unitsUsed ?? 0;
    return pluralEs(n, 'unidad', 'unidades');
  });

  readonly unitsUsedLegend = computed(() => 'Con al menos una maniobra');
}
