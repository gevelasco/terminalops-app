import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { SessionService } from '@core/services/state/session';
import {
  ReportsTabDataService,
  type ReportsBalanceBundle,
} from '@features/reports/services/reports-tab-data.service';
import { buildReportsBalanceClientPerformanceOption } from '@features/reports/utils/charts/balance/reports-balance-client-performance-option';
import { buildReportsBalanceCompositionPieOption } from '@features/reports/utils/charts/balance/reports-balance-composition-pie-option';
import { buildReportsBalanceProfitTreemapOption } from '@features/reports/utils/charts/balance/reports-balance-profit-treemap-option';
import { buildReportsBalanceRubroBarOption } from '@features/reports/utils/charts/balance/reports-balance-rubro-bar-option';
import {
  REPORTS_BALANCE_CHART_COLOR_OFFSET,
  reportsChartPrimary,
} from '@features/reports/utils/charts/reports-chart-palette';
import { buildReportsBalancePortfolioTable } from '@features/reports/utils/reports-balance-client-ranking.util';
import { buildReportsPayableTable } from '@features/reports/utils/reports-balance-payables.util';
import { buildReportsBalanceActivityHeatmapModel } from '@features/reports/utils/reports-balance-activity-heatmap.util';
import type { ReportsFilter } from '@features/reports/models/reports-view.models';
import { reportsPeriodSubtitle } from '@features/reports/utils/reports-period-subtitle.util';
import { CurrencyMxPipe } from '@shared/pipes/currency-mx.pipe';
import { clientCommercialPillClass } from '@shared/utils/client-commercial-pill';
import { ReportsBalanceActivityHeatmapComponent } from '@features/reports/components/reports-balance-activity-heatmap/reports-balance-activity-heatmap.component';
import { ToEchartsHostComponent } from '@shared/ui/to-echarts-host/to-echarts-host.component';
import { ToKpiCardComponent } from '@shared/ui/to-kpi-card/to-kpi-card.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';

function pluralEs(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

@Component({
  selector: 'app-reports-balance-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CurrencyMxPipe],
  imports: [
    ToKpiCardComponent,
    ToEchartsHostComponent,
    ToSkeletonComponent,
    ReportsBalanceActivityHeatmapComponent,
  ],
  templateUrl: './reports-balance-tab.component.html',
  styleUrl: './reports-balance-tab.component.scss',
})
export class ReportsBalanceTabComponent {
  private readonly tabData = inject(ReportsTabDataService);
  private readonly session = inject(SessionService);
  private readonly currencyMx = inject(CurrencyMxPipe);

  readonly filter = input.required<ReportsFilter>();

  private readonly pageState = toSignal(
    toObservable(this.filter).pipe(
      switchMap((params) =>
        this.tabData.getBalanceBundle(params).pipe(
          map((data) => ({ loading: false, data })),
          catchError(() => of({ loading: false, data: null })),
          startWith({ loading: true, data: null as ReportsBalanceBundle | null }),
        ),
      ),
    ),
    { initialValue: { loading: true, data: null as ReportsBalanceBundle | null } },
  );

  readonly loading = computed(() => this.pageState()?.loading ?? true);
  readonly summary = computed(() => this.pageState()?.data?.balance.summary);
  readonly insights = computed(() => this.pageState()?.data?.balance.insights);

  readonly chartShellColor = computed(() => {
    this.session.theme();
    return reportsChartPrimary();
  });

  readonly periodSubtitle = computed(() => reportsPeriodSubtitle(this.filter()));

  readonly activityHeatmapSubtitle = computed(() => {
    const model = buildReportsBalanceActivityHeatmapModel(
      this.insights()?.dailyActivity ?? [],
      this.filter().from,
      this.filter().to,
    );
    if (model.layout === 'months') {
      return `${model.title} · ${this.periodSubtitle()}`;
    }
    return model.title || this.periodSubtitle();
  });

  readonly compositionOption = computed(() =>
    buildReportsBalanceCompositionPieOption(this.insights()?.composition ?? [], {
      primaryColor: this.chartShellColor(),
    }),
  );

  readonly profitabilityOption = computed(() =>
    buildReportsBalanceProfitTreemapOption(this.insights()?.profitability, {
      primaryColor: this.chartShellColor(),
    }),
  );

  readonly rubroOption = computed(() =>
    buildReportsBalanceRubroBarOption(
      this.insights()?.expensesByRubro ?? [],
      REPORTS_BALANCE_CHART_COLOR_OFFSET.expensesByRubro,
      { primaryColor: this.chartShellColor() },
    ),
  );

  readonly portfolioTable = computed(() =>
    buildReportsBalancePortfolioTable(
      this.insights()?.incomeByClient ?? [],
      this.insights()?.creditByClient ?? [],
    ),
  );
  readonly portfolioRows = computed(() => this.portfolioTable().rows);
  readonly portfolioTotals = computed(() => this.portfolioTable().totals);

  readonly clientPerformanceOption = computed(() =>
    buildReportsBalanceClientPerformanceOption(this.insights()?.marginByClient ?? [], {
      primaryColor: this.chartShellColor(),
    }),
  );

  private readonly calendarItems = computed(
    () => this.pageState()?.data?.calendarItems ?? [],
  );
  private readonly payableToDate = computed(() => {
    const f = this.filter();
    const lastDay = new Date(f.toYear, f.toMonth, 0).getDate();
    return `${f.toYear}-${String(f.toMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  readonly payableTable = computed(() =>
    buildReportsPayableTable(
      this.calendarItems(),
      this.filter().from,
      this.payableToDate(),
    ),
  );
  readonly payableItems = computed(() => this.payableTable().rows);
  readonly hasPayableItems = computed(() => this.payableItems().length > 0);
  readonly payableTotalAmount = computed(() => this.payableTable().totals.amount);

  readonly hasPortfolioRows = computed(() => this.portfolioRows().length > 0);
  readonly hasClientPerformance = computed(
    () => (this.insights()?.marginByClient ?? []).length > 0,
  );

  readonly collectedValue = computed(() =>
    this.currencyMx.transform(this.summary()?.collectedInPeriod ?? 0),
  );
  readonly collectedLegend = computed(() => 'Ya entró a la empresa en el periodo');

  readonly receivableValue = computed(() =>
    this.currencyMx.transform(this.summary()?.receivableOpen ?? 0),
  );
  readonly receivableLegend = computed(() => 'Lo que clientes aún deben');

  readonly expensesValue = computed(() =>
    this.currencyMx.transform(this.summary()?.expenses ?? 0),
  );
  readonly expensesLegend = computed(() => {
    const n = this.summary()?.expensesCount ?? 0;
    return `${n} ${pluralEs(n, 'gasto', 'gastos')} registrados`;
  });

  readonly cashMarginValue = computed(() =>
    this.currencyMx.transform(this.summary()?.cashMargin ?? 0),
  );
  readonly cashMarginLegend = computed(() => 'Cobrado menos gastos del periodo');
  readonly cashMarginTone = computed((): 'up' | 'down' | 'neutral' => {
    const m = this.summary()?.cashMargin ?? 0;
    if (m > 0) {
      return 'up';
    }
    if (m < 0) {
      return 'down';
    }
    return 'neutral';
  });

  readonly tollsSpendValue = computed(() =>
    this.currencyMx.transform(this.summary()?.tollsSpendInPeriod ?? 0),
  );
  readonly tollsSpendLegend = computed(() => 'Casetas pagadas en el periodo');

  readonly operatorSpendValue = computed(() =>
    this.currencyMx.transform(this.summary()?.operatorSpendInPeriod ?? 0),
  );
  readonly operatorSpendLegend = computed(() => 'Pagos a operadores en el periodo');

  readonly payableValue = computed(() =>
    this.currencyMx.transform(this.summary()?.accountsPayable ?? 0),
  );
  readonly payableLegend = computed(() => 'Deudas con proveedores pendientes');

  readonly provisionsValue = computed(() =>
    this.currencyMx.transform(this.summary()?.provisions ?? 0),
  );
  readonly provisionsLegend = computed(() => 'Reservas operativas estimadas');

  formatMoney(value: number, currency = 'MXN'): string {
    return this.currencyMx.transform(value, currency);
  }

  formatDateShort(ymd: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd?.trim() ?? '');
    if (!match) return ymd ?? '—';
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
    return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }

  payableStatusLabel(status: string): string {
    switch (status) {
      case 'paid': return 'Pagado';
      case 'overdue': return 'Vencido';
      default: return 'Pendiente';
    }
  }

  payableStatusClass(status: string): string {
    switch (status) {
      case 'paid': return 'reports-balance-panel__status-pill reports-balance-panel__status-pill--paid';
      case 'overdue': return 'reports-balance-panel__status-pill reports-balance-panel__status-pill--overdue';
      default: return 'reports-balance-panel__status-pill reports-balance-panel__status-pill--pending';
    }
  }

  commercialPillClass = clientCommercialPillClass;
}
