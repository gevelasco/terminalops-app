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
import { buildReportsFleetStatusDonutOption } from '@features/reports/utils/charts/fleet/reports-fleet-status-donut-option';
import { buildReportsFleetUnitsHorizontalBarOption } from '@features/reports/utils/charts/fleet/reports-fleet-units-horizontal-bar-option';
import { buildReportsFleetUnitProfitabilityStackedBarOption } from '@features/reports/utils/charts/fleet/reports-fleet-unit-profitability-stacked-bar-option';
import {
  REPORTS_FLEET_CHART_COLOR_OFFSET,
  reportsChartPrimary,
} from '@features/reports/utils/charts/reports-chart-palette';
import type { ReportsFilter } from '@features/reports/models/reports-view.models';
import { parseYmd } from '@features/reports/utils/reports-filter';
import { formatReportsMoneyMx } from '@features/reports/utils/charts/reports-chart-axis.util';
import type { ReportsFleetData } from '@shared/models/api/api-reports-fleet.model';
import { renewalBucketFromOverview } from '@features/fleet/utils/fleet-overview-view';
import { ToEchartsHostComponent } from '@shared/ui/to-echarts-host/to-echarts-host.component';
import { ToKpiCardComponent } from '@shared/ui/to-kpi-card/to-kpi-card.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableComponent,
  type ToTableColumn,
} from '@shared/ui/to-table/to-table.component';

function pluralEs(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function formatKm(value: number): string {
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value)} km`;
}

function formatLiters(value: number): string {
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value)} L`;
}

function formatDays(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const label = rounded === 1 ? 'día' : 'días';
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(rounded)} ${label}`;
}

function formatWeightTons(value: number): string {
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value)} t`;
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatEntryDate(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return '—';
  }
  const date = new Date(`${iso.trim()}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function maintenanceStatusLabel(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'concluido') {
    return 'Concluido';
  }
  if (normalized === 'programado') {
    return 'Programado';
  }
  if (normalized === 'registrado') {
    return 'Registrado';
  }
  return status.trim() || 'Registrado';
}

@Component({
  selector: 'app-reports-fleet-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToKpiCardComponent,
    ToEchartsHostComponent,
    ToSkeletonComponent,
    ToTableComponent,
  ],
  templateUrl: './reports-fleet-tab.component.html',
  styleUrl: './reports-fleet-tab.component.scss',
})
export class ReportsFleetTabComponent {
  private readonly reportsApi = inject(ReportsService);
  private readonly session = inject(SessionService);

  readonly filter = input.required<ReportsFilter>();

  private readonly pageState = toSignal(
    toObservable(this.filter).pipe(
      switchMap((params) =>
        this.reportsApi.getFleet(params).pipe(
          map((data) => ({ loading: false, data })),
          catchError(() => of({ loading: false, data: null })),
          startWith({ loading: true, data: null as ReportsFleetData | null }),
        ),
      ),
    ),
    { initialValue: { loading: true, data: null as ReportsFleetData | null } },
  );

  readonly loading = computed(() => this.pageState()?.loading ?? true);
  readonly summary = computed(() => this.pageState()?.data?.summary);
  readonly insights = computed(() => this.pageState()?.data?.insights);

  readonly chartShellColor = computed(() => {
    this.session.theme();
    return reportsChartPrimary();
  });

  readonly complianceColumns: ToTableColumn[] = [
    { key: 'unitCode', label: 'Unidad' },
    {
      key: 'fleetMaint',
      label: 'Mantenimiento',
      cell: 'fleet-maintenance-icon',
    },
    {
      key: 'fleetVerif',
      label: 'Verificaciones',
      cell: 'fleet-verification-icon',
    },
    { key: 'fleetIns', label: 'Seguro', cell: 'fleet-insurance-icon' },
  ];

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

  readonly statusMixOption = computed(() =>
    buildReportsFleetStatusDonutOption(
      this.insights()?.statusMix ?? [],
      REPORTS_FLEET_CHART_COLOR_OFFSET.statusMix,
      { primaryColor: this.chartShellColor() },
    ),
  );

  readonly topUnitsOption = computed(() =>
    buildReportsFleetUnitsHorizontalBarOption(
      this.insights()?.topUnitsByKm ?? [],
      REPORTS_FLEET_CHART_COLOR_OFFSET.topUnitsByKm,
      { primaryColor: this.chartShellColor() },
    ),
  );

  readonly unitProfitabilityOption = computed(() =>
    buildReportsFleetUnitProfitabilityStackedBarOption(
      this.insights()?.unitProfitability ?? [],
      { primaryColor: this.chartShellColor() },
    ),
  );

  readonly complianceTableRows = computed(() =>
    (this.insights()?.complianceUnits ?? []).map((row) => ({
      id: String(row.unitId),
      unitCode: row.unitCode,
      fleetMaint: renewalBucketFromOverview(row.maintenanceRenewal),
      fleetVerif: renewalBucketFromOverview(row.verificationRenewal),
      fleetIns: renewalBucketFromOverview(row.insuranceRenewal),
      fleetMaintNext: row.maintenanceNext ?? '—',
      fleetVerifNext: row.verificationNext ?? '—',
      fleetInsNext: row.insuranceNext ?? '—',
    })),
  );

  readonly tireWearRows = computed(() => this.insights()?.tireWearByUnit ?? []);
  readonly maintenanceEvents = computed(() => this.insights()?.maintenanceEvents ?? []);

  readonly hasComplianceUnits = computed(() => this.complianceTableRows().length > 0);
  readonly hasTireWearRows = computed(() => this.tireWearRows().length > 0);
  readonly hasMaintenanceEvents = computed(() => this.maintenanceEvents().length > 0);

  formatEntryDate = formatEntryDate;
  formatReportsMoneyMx = formatReportsMoneyMx;
  formatKm = formatKm;
  formatWeightTons = formatWeightTons;
  formatPercent = formatPercent;
  maintenanceStatusLabel = maintenanceStatusLabel;

  readonly operationalKmValue = computed(() =>
    formatKm(this.summary()?.totalOperationalKm ?? 0),
  );
  readonly operationalKmLegend = computed(() => 'Suma de maniobras completadas');

  readonly dieselValue = computed(() => formatLiters(this.summary()?.totalDieselLiters ?? 0));
  readonly dieselLegend = computed(() => {
    const amount = this.summary()?.totalDieselAmount ?? 0;
    return amount > 0 ? formatReportsMoneyMx(amount) : 'Sin monto registrado';
  });

  readonly maintenanceEventsValue = computed(() =>
    String(this.summary()?.maintenanceEventsInPeriod ?? 0),
  );
  readonly maintenanceEventsUnit = computed(() => {
    const n = this.summary()?.maintenanceEventsInPeriod ?? 0;
    return pluralEs(n, 'registro', 'registros');
  });
  readonly maintenanceEventsLegend = computed(() => {
    const spend = this.summary()?.maintenanceSpendInPeriod ?? 0;
    return spend > 0
      ? `${formatReportsMoneyMx(spend)} en gastos de mantenimiento`
      : 'Entradas en bitácora del periodo';
  });

  readonly idleDaysValue = computed(() =>
    formatDays(this.summary()?.avgDaysWithoutOperation ?? 0),
  );
  readonly idleDaysLegend = computed(
    () => 'Promedio por unidad activa (en ruta o programada = 0 días)',
  );
}
