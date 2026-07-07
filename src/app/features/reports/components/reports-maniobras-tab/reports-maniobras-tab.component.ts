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
import { ReportsManiobrasGeoChartComponent } from '@features/reports/components/reports-maniobras-tab/reports-maniobras-geo-chart.component';
import { buildReportsGeneralDestinationsBarOption } from '@features/reports/utils/charts/general/reports-general-destinations-bar-option';
import { buildReportsManiobrasClientsHorizontalBarOption } from '@features/reports/utils/charts/maniobras/reports-maniobras-clients-horizontal-bar-option';
import { buildReportsManiobrasContainerTypeDonutOption } from '@features/reports/utils/charts/maniobras/reports-maniobras-container-type-donut-option';
import { buildReportsManiobrasCargoWeightBarOption } from '@features/reports/utils/charts/maniobras/reports-maniobras-cargo-weight-bar-option';
import { buildReportsManiobrasOperatorsHorizontalBarOption } from '@features/reports/utils/charts/maniobras/reports-maniobras-operators-horizontal-bar-option';
import {
  REPORTS_MANIOBRAS_CHART_COLOR_OFFSET,
  reportsChartPrimary,
} from '@features/reports/utils/charts/reports-chart-palette';
import type { ReportsFilter } from '@features/reports/models/reports-view.models';
import { parseYmd } from '@features/reports/utils/reports-filter';
import type { ReportsManiobrasData } from '@shared/models/api/api-reports-maniobras.model';
import type { TripStatus } from '@shared/models/logistics.models';
import { maneuverStatusPillClass } from '@shared/utils/maneuver-status-pill';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';
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

function priorPeriodDeltaTone(value: number | null | undefined): 'up' | 'down' | 'neutral' {
  if (value == null || value === 0) {
    return 'neutral';
  }
  return value > 0 ? 'up' : 'down';
}

function formatKm(value: number): string {
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value)} km`;
}

function formatTripDurationDays(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  const rounded = Math.round(value * 10) / 10;
  const label = rounded === 1 ? 'día' : 'días';
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(rounded)} ${label}`;
}

function formatManeuverCodesLabel(codes: readonly string[]): string {
  if (codes.length === 0) {
    return '—';
  }
  return codes.join(', ');
}

function formatIncidentDate(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

@Component({
  selector: 'app-reports-maniobras-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToKpiCardComponent,
    ToEchartsHostComponent,
    ToSkeletonComponent,
    ReportsManiobrasGeoChartComponent,
  ],
  templateUrl: './reports-maniobras-tab.component.html',
  styleUrl: './reports-maniobras-tab.component.scss',
})
export class ReportsManiobrasTabComponent {
  private readonly reportsApi = inject(ReportsService);
  private readonly session = inject(SessionService);

  readonly filter = input.required<ReportsFilter>();

  private readonly pageState = toSignal(
    toObservable(this.filter).pipe(
      switchMap((params) =>
        this.reportsApi.getManiobras(params).pipe(
          map((data) => ({ loading: false, data })),
          catchError(() => of({ loading: false, data: null })),
          startWith({ loading: true, data: null as ReportsManiobrasData | null }),
        ),
      ),
    ),
    { initialValue: { loading: true, data: null as ReportsManiobrasData | null } },
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

  readonly recurringIncidentRoutes = computed(
    () => this.insights()?.recurringIncidentRoutes ?? [],
  );

  readonly hasRecurringIncidentRoutes = computed(
    () => this.recurringIncidentRoutes().length > 0,
  );

  readonly operatorsOption = computed(() =>
    buildReportsManiobrasOperatorsHorizontalBarOption(
      this.insights()?.topOperators ?? [],
      REPORTS_MANIOBRAS_CHART_COLOR_OFFSET.topOperators,
      { primaryColor: this.chartShellColor() },
    ),
  );

  readonly clientsOption = computed(() =>
    buildReportsManiobrasClientsHorizontalBarOption(
      this.insights()?.topClients ?? [],
      REPORTS_MANIOBRAS_CHART_COLOR_OFFSET.topClients,
      { primaryColor: this.chartShellColor() },
    ),
  );

  readonly destinationsOption = computed(() => {
    const rows = (this.insights()?.topDestinations ?? []).map((row) => ({
      destination: row.destination,
      tripCount: row.tripCount,
    }));
    return buildReportsGeneralDestinationsBarOption(
      rows,
      REPORTS_MANIOBRAS_CHART_COLOR_OFFSET.topDestinations,
      { primaryColor: this.chartShellColor() },
    );
  });

  readonly containerTypeOption = computed(() =>
    buildReportsManiobrasContainerTypeDonutOption(
      this.insights()?.containerTypeMix ?? [],
      REPORTS_MANIOBRAS_CHART_COLOR_OFFSET.containerTypeMix,
      { primaryColor: this.chartShellColor() },
    ),
  );

  readonly cargoWeightOption = computed(() =>
    buildReportsManiobrasCargoWeightBarOption(
      this.insights()?.cargoWeightByContainer ?? [],
      REPORTS_MANIOBRAS_CHART_COLOR_OFFSET.cargoWeightByContainer,
      { primaryColor: this.chartShellColor() },
    ),
  );

  readonly hasContainerTypeMix = computed(
    () => (this.insights()?.containerTypeMix?.length ?? 0) > 0,
  );

  readonly hasCargoWeight = computed(
    () => (this.insights()?.cargoWeightByContainer?.length ?? 0) > 0,
  );

  readonly geoMapTrips = computed(() => this.insights()?.geoMapTrips ?? []);

  readonly geoMapTripsCount = computed(() => this.geoMapTrips().length);

  formatTripDurationDays = formatTripDurationDays;
  formatManeuverCodesLabel = formatManeuverCodesLabel;
  formatIncidentDate = formatIncidentDate;

  readonly maneuverStatusPillClass = maneuverStatusPillClass;

  formatTripStatusLabel(status: TripStatus): string {
    return tripStatusUiLabel(status);
  }

  readonly completedValue = computed(() => String(this.summary()?.completedTripsCount ?? 0));

  readonly completedValueUnit = computed(() => {
    const n = this.summary()?.completedTripsCount ?? 0;
    return pluralEs(n, 'maniobra', 'maniobras');
  });

  readonly completedLegend = computed(() => 'Completadas en el periodo');

  readonly completedDelta = computed(() =>
    formatPriorPeriodPercent(this.summary()?.completedTripsPriorPeriodPercent),
  );

  readonly completedDeltaTone = computed(() =>
    priorPeriodDeltaTone(this.summary()?.completedTripsPriorPeriodPercent),
  );

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

  readonly cancelledValue = computed(() => String(this.summary()?.cancelledTripsCount ?? 0));

  readonly cancelledValueUnit = computed(() => {
    const n = this.summary()?.cancelledTripsCount ?? 0;
    return pluralEs(n, 'maniobra', 'maniobras');
  });

  readonly cancelledLegend = computed(() => 'Canceladas en el periodo');

  readonly delayedValue = computed(() => String(this.summary()?.delayedTripsCount ?? 0));

  readonly delayedValueUnit = computed(() => {
    const n = this.summary()?.delayedTripsCount ?? 0;
    return pluralEs(n, 'maniobra', 'maniobras');
  });

  readonly delayedLegend = computed(() => 'Fuera de ventana programada');

  readonly operationalKmValue = computed(() =>
    formatKm(this.summary()?.totalOperationalKm ?? 0),
  );

  readonly operationalKmLegend = computed(() => {
    const avg = this.summary()?.avgKmPerTrip ?? 0;
    return `${formatKm(avg)} promedio por maniobra`;
  });

  readonly avgDurationValue = computed(() =>
    formatTripDurationDays(this.summary()?.avgManeuverDurationDays ?? 0),
  );

  readonly avgDurationLegend = computed(() => 'Salida a llegada en maniobras completadas');

  readonly destinationsValue = computed(() => String(this.summary()?.uniqueDestinations ?? 0));

  readonly destinationsValueUnit = computed(() => {
    const n = this.summary()?.uniqueDestinations ?? 0;
    return pluralEs(n, 'destino', 'destinos');
  });

  readonly destinationsLegend = computed(() => 'Destinos distintos en el periodo');
}
