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
import { buildReportsBalanceCompositionPieOption } from '@features/reports/utils/charts/balance/reports-balance-composition-pie-option';
import { buildReportsBalanceCreditHorizontalBarOption } from '@features/reports/utils/charts/balance/reports-balance-credit-horizontal-bar-option';
import { buildReportsBalanceIncomeHorizontalBarOption } from '@features/reports/utils/charts/balance/reports-balance-income-horizontal-bar-option';
import { buildReportsBalanceMarginHorizontalBarOption } from '@features/reports/utils/charts/balance/reports-balance-margin-horizontal-bar-option';
import { buildReportsBalanceProfitTreemapOption } from '@features/reports/utils/charts/balance/reports-balance-profit-treemap-option';
import { buildReportsBalanceRubroBarOption } from '@features/reports/utils/charts/balance/reports-balance-rubro-bar-option';
import {
  REPORTS_BALANCE_CHART_COLOR_OFFSET,
  reportsChartPrimary,
} from '@features/reports/utils/charts/reports-chart-palette';
import type { ReportsFilter } from '@features/reports/models/reports-view.models';
import { parseYmd } from '@features/reports/utils/reports-filter';
import type { ReportsBalanceData } from '@shared/models/api/api-reports-balance.model';
import { CurrencyMxPipe } from '@shared/pipes/currency-mx.pipe';
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
  imports: [ToKpiCardComponent, ToEchartsHostComponent, ToSkeletonComponent],
  templateUrl: './reports-balance-tab.component.html',
  styleUrl: './reports-balance-tab.component.scss',
})
export class ReportsBalanceTabComponent {
  private readonly reportsApi = inject(ReportsService);
  private readonly session = inject(SessionService);
  private readonly currencyMx = inject(CurrencyMxPipe);

  readonly filter = input.required<ReportsFilter>();

  private readonly pageState = toSignal(
    toObservable(this.filter).pipe(
      switchMap((params) =>
        this.reportsApi.getBalance(params).pipe(
          map((data) => ({ loading: false, data })),
          catchError(() => of({ loading: false, data: null })),
          startWith({ loading: true, data: null as ReportsBalanceData | null }),
        ),
      ),
    ),
    { initialValue: { loading: true, data: null as ReportsBalanceData | null } },
  );

  readonly loading = computed(() => this.pageState()?.loading ?? true);
  readonly summary = computed(() => this.pageState()?.data?.summary);
  readonly insights = computed(() => this.pageState()?.data?.insights);

  readonly chartShellColor = computed(() => {
    this.session.theme();
    return reportsChartPrimary();
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

  readonly compositionOption = computed(() =>
    buildReportsBalanceCompositionPieOption(this.insights()?.composition ?? [], {
      primaryColor: this.chartShellColor(),
    }),
  );

  readonly creditByClientOption = computed(() =>
    buildReportsBalanceCreditHorizontalBarOption(
      this.insights()?.creditByClient ?? [],
      REPORTS_BALANCE_CHART_COLOR_OFFSET.creditByClient,
      { primaryColor: this.chartShellColor() },
    ),
  );

  readonly incomeByClientOption = computed(() =>
    buildReportsBalanceIncomeHorizontalBarOption(
      this.insights()?.incomeByClient ?? [],
      REPORTS_BALANCE_CHART_COLOR_OFFSET.incomeByClient,
      { primaryColor: this.chartShellColor() },
    ),
  );

  readonly marginByClientOption = computed(() =>
    buildReportsBalanceMarginHorizontalBarOption(
      this.insights()?.marginByClient ?? [],
      REPORTS_BALANCE_CHART_COLOR_OFFSET.marginByClient,
      { primaryColor: this.chartShellColor() },
    ),
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

  readonly collectedValue = computed(() =>
    this.currencyMx.transform(this.summary()?.collectedInPeriod ?? 0),
  );

  readonly collectedLegend = computed(() => 'Ingreso confirmado en el periodo');

  readonly receivableValue = computed(() =>
    this.currencyMx.transform(this.summary()?.receivableOpen ?? 0),
  );

  readonly receivableLegend = computed(() => 'Cartera abierta (sin ingreso confirmado)');

  readonly expensesValue = computed(() =>
    this.currencyMx.transform(this.summary()?.expenses ?? 0),
  );

  readonly expensesLegend = computed(() => {
    const n = this.summary()?.expensesCount ?? 0;
    return `${n} ${pluralEs(n, 'gasto', 'gastos')} registrados`;
  });

  readonly payableValue = computed(() =>
    this.currencyMx.transform(this.summary()?.accountsPayable ?? 0),
  );

  readonly payableLegend = computed(() => 'Crédito proveedor / TDC en el periodo');

  readonly provisionsValue = computed(() =>
    this.currencyMx.transform(this.summary()?.provisions ?? 0),
  );

  readonly provisionsLegend = computed(() => 'Provisiones operativas');

  readonly cashMarginValue = computed(() =>
    this.currencyMx.transform(this.summary()?.cashMargin ?? 0),
  );

  readonly cashMarginLegend = computed(() => {
    const pct = this.summary()?.marginPercent;
    if (pct == null) {
      return 'Ingreso cobrado − gastos del periodo';
    }
    return `Margen ${pct}% sobre ingreso pactado`;
  });

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

  readonly tollsSpendLegend = computed(() => 'Gasto en casetas del periodo');

  readonly operatorSpendValue = computed(() =>
    this.currencyMx.transform(this.summary()?.operatorSpendInPeriod ?? 0),
  );

  readonly operatorSpendLegend = computed(
    () => 'Pagos y comisiones a operadores del periodo',
  );
}
