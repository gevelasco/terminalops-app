import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  resource,
} from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { UnitsService } from '@services/api/units';
import { labelForUnitId } from '@shared/utils/fleet/unit-label';
import { DashboardService } from '@services/api/dashboard';
import { CRITICAL_ALERT_ICON_PATHS } from '@features/dashboard/critical-alert-icon-paths';
import {
  buildOperationTypeSlicesFromTrips,
  buildWeeklyCompletedTripsByDay,
  filterTripsCreatedInCalendarMonth,
  type OperationTypeSlice,
  type WeeklyTripPoint,
} from '@features/reports/utils/dashboard-charts-from-trips';
import { TripEvaluationService } from '@shared/services/trip-evaluation.service';
import { TRIP_EVALUATION_PROVIDERS } from '@shared/services/trip-evaluation.providers';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { formatTripRouteLabel } from '@shared/utils/trip-route-label';
import { buildTripStatusSlices } from '@shared/utils/trip-status-slices';
import {
  Alert,
  CriticalAlert,
  CriticalSeverity,
  Trip,
  TripStatus,
  Unit,
} from '@shared/models/logistics.models';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import {
  ToBadgeComponent,
  ToBadgeVariant,
} from '@shared/ui/to-badge/to-badge.component';
import { ToCardComponent } from '@shared/ui/to-card/to-card.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

type DashboardBundle = {
  kpis: Alert[];
  critical: CriticalAlert[];
  maniobras: Trip[];
  units: Unit[];
};

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DateShortPipe, ...TRIP_EVALUATION_PROVIDERS],
  imports: [
    ToCardComponent,
    ToSkeletonComponent,
    ToTableComponent,
    ToBadgeComponent,
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent implements OnInit {
  private readonly dashboard = inject(DashboardService);
  private readonly unitsApi = inject(UnitsService);
  private readonly dateShort = inject(DateShortPipe);
  private readonly router = inject(Router);
  private readonly operationConfigsFeature = inject(OperationConfigurationsFeatureService);
  private readonly tripEvaluation = inject(TripEvaluationService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.operationConfigsFeature.dispose();
    });
  }

  ngOnInit(): void {
    this.operationConfigsFeature.loadOperationConfigurations();
  }

  private readonly dashResource = resource({
    loader: async (): Promise<DashboardBundle> => {
      const [kpis, critical, units] = await Promise.all([
        firstValueFrom(
          this.dashboard.getAlertsList().pipe(catchError(() => of([] as Alert[]))),
        ),
        firstValueFrom(
          this.dashboard
            .getCriticalAlertsList()
            .pipe(catchError(() => of([] as CriticalAlert[]))),
        ),
        firstValueFrom(
          this.unitsApi.getUnitsList().pipe(catchError(() => of([] as Unit[]))),
        ),
      ]);
      return { kpis, critical, maniobras: [] as Trip[], units };
    },
  });

  /** Solo skeleton en la carga inicial; recargas no ocultan el tablero. */
  readonly loading = computed(
    () => !this.dashResource.hasValue() && this.dashResource.isLoading(),
  );

  readonly alerts = computed(() => this.dashResource.value()?.kpis ?? []);

  /** Solo incidentes con prioridad «crítico» (alto/medio/bajo van al panel de notificaciones). */
  readonly criticalAlerts = computed(() =>
    (this.dashResource.value()?.critical ?? []).filter((a) => a.severity === 'critical'),
  );
  readonly tripRows = computed(() => {
    const v = this.dashResource.value();
    return this.mapTripRows(v?.maniobras ?? [], v?.units ?? []);
  });

  /** Maniobras del mes en curso (por `createdAt`) — mismas que alimentan el resumen mensual. */
  readonly tripsCreatedThisMonth = computed(() =>
    filterTripsCreatedInCalendarMonth(
      this.dashResource.value()?.maniobras ?? [],
      new Date(),
    ),
  );

  readonly tripStatusSlices = computed(() =>
    buildTripStatusSlices(this.tripsCreatedThisMonth()),
  );

  readonly weeklyTripVolume = computed<WeeklyTripPoint[]>(() =>
    buildWeeklyCompletedTripsByDay(this.dashResource.value()?.maniobras ?? []),
  );
  readonly operationTypeSlices = computed<OperationTypeSlice[]>(() =>
    buildOperationTypeSlicesFromTrips(this.tripsCreatedThisMonth(), this.tripEvaluation),
  );

  readonly criticalIconPaths = CRITICAL_ALERT_ICON_PATHS;

  readonly tripColumns: ToTableColumn[] = [
    { key: 'code', label: 'Código' },
    { key: 'route', label: 'Ruta' },
    { key: 'unitId', label: 'Unidad', cell: 'muted-badge' },
    { key: 'status', label: 'Estado', cell: 'maniobra-status' },
    { key: 'createdAt', label: 'Creada' },
  ];

  onTripRowClick(_row: Record<string, unknown>): void {
    void this.router.navigate(['/maniobra']);
  }

  iconPath(kind: CriticalAlert['kind']): string {
    return this.criticalIconPaths[kind];
  }

  formatDate(iso: string): string {
    return this.dateShort.transform(iso) ?? iso;
  }

  severityLabel(s: CriticalSeverity): string {
    switch (s) {
      case 'critical':
        return 'Crítico';
      case 'high':
        return 'Alto';
      case 'medium':
        return 'Medio';
      case 'low':
        return 'Bajo';
    }
  }

  badgeVariant(s: CriticalSeverity): ToBadgeVariant {
    switch (s) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'neutral';
      case 'low':
        return 'success';
    }
  }

  private mapTripRows(trips: Trip[], units: readonly Unit[]): Record<string, unknown>[] {
    const sorted = [...trips].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );
    const latest = sorted.slice(0, 10);
    return latest.map((t) => ({
      id: t.id,
      code: t.maneuverCode,
      route: formatTripRouteLabel(t.origin, t.destination),
      unitId: labelForUnitId(t.unitId, units),
      status: t.status,
      falseManeuver: t.falseManeuver === true,
      createdAt: this.formatDate(t.createdAt),
    }));
  }

  weeklyBarHeightPct(value: number): number {
    const series = this.weeklyTripVolume();
    const max = Math.max(...series.map((p) => p.value), 1);
    return Math.round((value / max) * 100);
  }

  statusFillClass(status: TripStatus): string {
    switch (status) {
      case 'in_transit':
        return 'dash-chart-bar__fill--transit';
      case 'scheduled':
        return 'dash-chart-bar__fill--scheduled';
      case 'completed':
        return 'dash-chart-bar__fill--completed';
      case 'cancelled':
        return 'dash-chart-bar__fill--cancelled';
    }
  }

  operationFillClass(tone: OperationTypeSlice['tone']): string {
    return this.tripEvaluation.chartFillClass(tone, 'dash');
  }
}
