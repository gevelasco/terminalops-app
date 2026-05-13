import { Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AlertRepository } from '@features/dashboard/data/alert.repository';
import { CriticalAlertRepository } from '@features/dashboard/data/critical-alert.repository';
import { CRITICAL_ALERT_ICON_PATHS } from '@features/dashboard/critical-alert-icon-paths';
import { ManiobraRepository } from '@features/maniobra/data/maniobra.repository';
import {
  MOCK_OPERATION_TYPE_SLICES,
  MOCK_WEEKLY_TRIP_VOLUME,
  OperationTypeSlice,
  WeeklyTripPoint,
} from '@app/mock-data/mock-dashboard-charts';
import { labelForUnitId } from '@app/mock-data/mock-units';
import {
  Alert,
  CriticalAlert,
  CriticalSeverity,
  Trip,
  TripStatus,
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

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  providers: [DateShortPipe],
  imports: [
    ToCardComponent,
    ToSkeletonComponent,
    ToTableComponent,
    ToBadgeComponent,
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent {
  private readonly alertsRepo = inject(AlertRepository);
  private readonly criticalAlertsRepo = inject(CriticalAlertRepository);
  private readonly maniobrasRepo = inject(ManiobraRepository);
  private readonly dateShort = inject(DateShortPipe);

  readonly loading = signal(true);
  readonly alerts = signal<Alert[]>([]);
  readonly criticalAlerts = signal<CriticalAlert[]>([]);
  readonly tripRows = signal<Record<string, unknown>[]>([]);
  /** Distribución por estado (todas las maniobras del mock). */
  readonly tripStatusSlices = signal<
    { label: string; count: number; pct: number; status: TripStatus }[]
  >([]);
  readonly weeklyTripVolume = signal<WeeklyTripPoint[]>(
    MOCK_WEEKLY_TRIP_VOLUME,
  );
  readonly operationTypeSlices = signal<OperationTypeSlice[]>(
    MOCK_OPERATION_TYPE_SLICES,
  );

  readonly criticalIconPaths = CRITICAL_ALERT_ICON_PATHS;

  readonly tripColumns: ToTableColumn[] = [
    { key: 'code', label: 'Maniobras' },
    { key: 'route', label: 'Ruta' },
    { key: 'unitId', label: 'Unidad', cell: 'muted-badge' },
    { key: 'status', label: 'Estado', cell: 'maniobra-status' },
    { key: 'programmedAt', label: 'Programado' },
  ];

  constructor() {
    forkJoin({
      kpis: this.alertsRepo.list(),
      critical: this.criticalAlertsRepo.list(),
      maniobras: this.maniobrasRepo.list(),
    }).subscribe({
      next: ({ kpis, critical, maniobras }) => {
        this.alerts.set(kpis);
        this.criticalAlerts.set(critical);
        this.tripRows.set(this.mapTripRows(maniobras));
        this.tripStatusSlices.set(this.buildTripStatusSlices(maniobras));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
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
    }
  }

  private mapTripRows(trips: Trip[]): Record<string, unknown>[] {
    const sorted = [...trips].sort(
      (a, b) =>
        new Date(b.programmedAt).getTime() - new Date(a.programmedAt).getTime(),
    );
    const top = sorted.slice(0, 10);
    return top.map((t) => ({
      id: t.id,
      code: t.maneuverCode,
      route: `${t.origin} → ${t.destination}`,
      unitId: labelForUnitId(t.unitId),
      status: t.status,
      programmedAt: this.formatDate(t.programmedAt),
    }));
  }

  private tripStatusLabel(status: TripStatus): string {
    switch (status) {
      case 'scheduled':
        return 'Programado';
      case 'in_transit':
        return 'En curso';
      case 'completed':
        return 'Completado';
      case 'cancelled':
        return 'Cancelado';
    }
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
    switch (tone) {
      case 'a':
        return 'dash-chart-bar__fill--op-a';
      case 'b':
        return 'dash-chart-bar__fill--op-b';
      case 'c':
        return 'dash-chart-bar__fill--op-c';
    }
  }

  private buildTripStatusSlices(trips: Trip[]): {
    label: string;
    count: number;
    pct: number;
    status: TripStatus;
  }[] {
    const order: TripStatus[] = [
      'in_transit',
      'scheduled',
      'completed',
      'cancelled',
    ];
    const counts = new Map<TripStatus, number>();
    for (const s of order) {
      counts.set(s, 0);
    }
    for (const t of trips) {
      counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    }
    const total = trips.length || 1;
    return order.map((status) => ({
      status,
      label: this.tripStatusLabel(status),
      count: counts.get(status) ?? 0,
      pct: Math.round(((counts.get(status) ?? 0) / total) * 100),
    }));
  }
}
