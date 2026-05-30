import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReportsFilterBarComponent, type ReportsToolbarTab } from '@features/reports/components/reports-filter-bar/reports-filter-bar.component';
import { ReportsAnalyticsService } from '@services/domain/reports-analytics';
import type { ReportsTabId } from '@features/reports/models/reports-view.models';
import type { ReportsRawBundle } from '@features/reports/utils/reports-bundle-filter';
import { defaultReportsFilter } from '@features/reports/utils/reports-filter';
import { UserPreferencesStore } from '@services/state/user-preferences';
import {
  donutConicGradient,
  donutMarginTotal,
} from '@features/reports/utils/reports-client-margin-donut';
import { formatMxn } from '@features/reports/utils/reports-money';
import type {
  ReportsDestinationPerformanceRow,
  ReportsDonutSlice,
  ReportsFleetOperatorPayRow,
  ReportsPeriodBalanceBar,
} from '@features/reports/models/reports-view.models';
import { barFillWidthPct as resolveBarFillWidthPct } from '@features/reports/utils/reports-chart-mappers';
import { collectionPaymentDonutTotal } from '@features/reports/utils/reports-collection-payment-donut';
import {
  expenseCategoryDonutTotal,
  semiDonutConicGradient,
} from '@features/reports/utils/reports-expense-category-slices';
import { donutSliceTotal } from '@features/reports/utils/reports-operation-donut';
import { TripEvaluationService } from '@shared/services/trip-evaluation.service';
import { TRIP_EVALUATION_PROVIDERS } from '@shared/services/trip-evaluation.providers';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { ToKpiCardComponent } from '@shared/ui/to-kpi-card/to-kpi-card.component';
import { ToCardComponent } from '@shared/ui/to-card/to-card.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import { ToBadgeComponent } from '@shared/ui/to-badge/to-badge.component';
import { ToTableColumn, ToTableComponent } from '@shared/ui/to-table/to-table.component';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [...TRIP_EVALUATION_PROVIDERS],
  imports: [
    DecimalPipe,
    ToPageHeaderComponent,
    ToSkeletonComponent,
    ToBadgeComponent,
    ToCardComponent,
    ToKpiCardComponent,
    ToTableComponent,
    ReportsFilterBarComponent,
  ],
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.scss',
})
export class ReportsPageComponent {
  private readonly analytics = inject(ReportsAnalyticsService);
  private readonly preferences = inject(UserPreferencesStore);
  private readonly operationConfigsFeature = inject(OperationConfigurationsFeatureService);
  private readonly tripEvaluation = inject(TripEvaluationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly tab = signal<ReportsTabId>('general');
  readonly filter = signal(defaultReportsFilter());
  readonly raw = signal<ReportsRawBundle | null>(null);

  readonly operationalAnalysisEnabled = this.preferences.operationalAnalysisEnabled;

  readonly view = computed(() => {
    const bundle = this.raw();
    if (!bundle) {
      return null;
    }
    return this.analytics.buildView(bundle, this.filter(), this.tripEvaluation);
  });

  readonly clientRows = computed(() =>
    (this.view()?.general.topClients ?? []).map((r) => ({
      clientName: r.clientName,
      maneuvers: r.maneuvers,
      km: Math.round(r.km).toLocaleString('es-MX'),
      revenue: formatMxn(r.revenue),
      revenueShare: `${r.revenuePct}%`,
    })),
  );

  readonly clientColumns: ToTableColumn[] = [
    { key: 'clientName', label: 'Cliente' },
    { key: 'maneuvers', label: 'Maniobras compl.' },
    { key: 'km', label: 'Km' },
    { key: 'revenue', label: 'Ingresos' },
    { key: 'revenueShare', label: '% ingresos' },
  ];

  readonly formatMxn = formatMxn;
  readonly donutConicGradient = donutConicGradient;
  readonly donutMarginTotal = donutMarginTotal;
  readonly donutSliceTotal = donutSliceTotal;
  readonly collectionPaymentDonutTotal = collectionPaymentDonutTotal;
  readonly semiDonutConicGradient = semiDonutConicGradient;
  readonly expenseCategoryDonutTotal = expenseCategoryDonutTotal;

  donutAriaLabel(slices: readonly ReportsDonutSlice[]): string {
    if (slices.length === 0) {
      return 'Sin datos de margen por cliente';
    }
    return slices.map((s) => `${s.label} ${s.pct}%`).join(', ');
  }

  readonly tabs: ReportsToolbarTab[] = [
    { id: 'general', label: 'General', icon: 'chartBar' },
    { id: 'balance', label: 'Balance', icon: 'revenue' },
    { id: 'maniobras', label: 'Maniobras', icon: 'route' },
    { id: 'fleet', label: 'Flota', icon: 'truck' },
  ];

  readonly routeClientProfitRows = computed(() =>
    (this.view()?.balance.routeClientProfitability ?? []).map((r) => ({
      client: r.client,
      route: r.route,
      maneuvers: r.maneuvers,
      volumeTons: r.volumeTons.toLocaleString('es-MX'),
      km: r.km.toLocaleString('es-MX'),
      revenue: formatMxn(r.revenue),
      cost: formatMxn(r.cost),
      margin: formatMxn(r.margin),
      marginPct: `${r.marginPct}%`,
    })),
  );

  readonly routeClientProfitColumns: ToTableColumn[] = [
    { key: 'client', label: 'Cliente' },
    { key: 'route', label: 'Ruta' },
    { key: 'maneuvers', label: 'Viajes' },
    { key: 'volumeTons', label: 'Ton' },
    { key: 'km', label: 'Km' },
    { key: 'revenue', label: 'Ingresos' },
    { key: 'cost', label: 'Costo' },
    { key: 'margin', label: 'Margen' },
    { key: 'marginPct', label: 'Margen %' },
  ];

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.operationConfigsFeature.dispose();
    });
    this.preferences.ensureLoaded();
    this.operationConfigsFeature.loadOperationConfigurations();
    this.analytics
      .loadRawBundle()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (bundle) => {
          this.raw.set(bundle);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  periodBalanceBarHeightPct(
    value: number,
    bars: readonly ReportsPeriodBalanceBar[],
  ): number {
    const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
    return Math.max(4, Math.round((Math.abs(value) / max) * 100));
  }

  weeklyBarHeightPct(value: number, series: readonly { value: number }[]): number {
    const max = Math.max(1, ...series.map((p) => Math.abs(p.value)));
    return Math.max(4, Math.round((Math.abs(value) / max) * 100));
  }

  destMarginColHeightPct(
    margin: number,
    rows: readonly ReportsDestinationPerformanceRow[],
  ): number {
    const max = Math.max(1, ...rows.map((r) => Math.abs(r.margin)));
    return Math.max(6, Math.round((Math.abs(margin) / max) * 100));
  }

  barFillWidthPct(count: number, pct: number): number {
    return resolveBarFillWidthPct(count, pct);
  }

  operatorPaidBarPct(row: ReportsFleetOperatorPayRow): number {
    const total =
      row.paidAmount + row.pendingCompletedAmount + row.pendingInTransitAmount;
    if (total <= 0) {
      return 0;
    }
    return Math.round((row.paidAmount / total) * 100);
  }
}
