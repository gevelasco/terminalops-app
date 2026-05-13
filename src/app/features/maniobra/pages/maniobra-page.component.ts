import { Component, computed, inject, model, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { ManiobraDetailDrawerComponent } from '@features/maniobra/components/maniobra-detail-drawer/maniobra-detail-drawer.component';
import { ManiobraNewDrawerComponent } from '@features/maniobra/components/maniobra-new-drawer/maniobra-new-drawer.component';
import {
  CreateTripPayload,
  ManiobraRepository,
} from '@features/maniobra/data/maniobra.repository';
import { OperatorRepository } from '@features/operators/data/operator.repository';
import { labelForUnitId } from '@app/mock-data/mock-units';
import { Operator, Trip, TripStatus } from '@shared/models/logistics.models';
import { formatStackedMx } from '@shared/utils/format-datetime-mx';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

export type ManiobraStatusFilter = TripStatus | 'all';

@Component({
  selector: 'app-maniobra-page',
  standalone: true,
  imports: [
    ToPageHeaderComponent,
    ToTableComponent,
    ToSkeletonComponent,
    ToButtonComponent,
    ToInputComponent,
    ManiobraNewDrawerComponent,
    ManiobraDetailDrawerComponent,
  ],
  templateUrl: './maniobra-page.component.html',
  styleUrl: './maniobra-page.component.scss',
})
export class ManiobraPageComponent {
  private readonly maniobrasRepo = inject(ManiobraRepository);
  private readonly operatorsRepo = inject(OperatorRepository);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly newManiobraOpen = signal(false);
  readonly rows = signal<Record<string, unknown>[]>([]);

  /** Mapa operador id → nombre (detalle lateral). */
  private readonly operatorNameById = signal<Map<string, string>>(new Map());

  readonly detailTrip = signal<Trip | null>(null);
  readonly detailOperatorName = signal('');

  /** Filtro rápido por estado (tab superior). */
  readonly statusFilter = signal<ManiobraStatusFilter>('all');

  readonly searchQuery = model('');

  readonly filterTabs: ReadonlyArray<{
    value: ManiobraStatusFilter;
    label: string;
  }> = [
    { value: 'all', label: 'Todos' },
    { value: 'in_transit', label: 'En curso' },
    { value: 'scheduled', label: 'Programado' },
    { value: 'completed', label: 'Completado' },
    { value: 'cancelled', label: 'Cancelado' },
  ];

  readonly filteredRows = computed(() => {
    const list = this.rows();
    const f = this.statusFilter();
    const byStatus =
      f === 'all' ? list : list.filter((row) => row['status'] === f);
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) {
      return byStatus;
    }
    return byStatus.filter((row) => this.rowMatchesSearch(row, q));
  });

  readonly columns: ToTableColumn[] = [
    { key: 'code', label: 'Código' },
    { key: 'route', label: 'Ruta' },
    { key: 'clientName', label: 'Cliente' },
    { key: 'operatorName', label: 'Operador' },
    { key: 'unitId', label: 'Unidad', cell: 'muted-badge' },
    { key: 'status', label: 'Estado', cell: 'maniobra-status' },
    { key: 'departureAt', label: 'Salida', cell: 'datetime-stacked' },
    { key: 'arrivedAt', label: 'Llegada', cell: 'datetime-stacked' },
    { key: 'operationType', label: 'Configuración', cell: 'operation-type' },
    { key: 'hasIncident', label: 'Incidente', cell: 'incident-dot' },
  ];

  constructor() {
    this.loadManiobras();
  }

  loadManiobras(options?: { showLoading?: boolean }): void {
    const showLoading = options?.showLoading !== false;
    if (showLoading) {
      this.loading.set(true);
    }
    forkJoin({
      maniobras: this.maniobrasRepo.list(),
      operators: this.operatorsRepo.list(),
    }).subscribe({
      next: ({ maniobras, operators }) => {
        const opNames = this.operatorNameMap(operators);
        this.operatorNameById.set(opNames);
        this.rows.set(maniobras.map((t) => this.mapRow(t, opNames)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onManiobraRowClick(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    if (!id) {
      return;
    }
    this.maniobrasRepo.get(id).subscribe({
      next: (trip) => {
        if (!trip) {
          return;
        }
        this.detailOperatorName.set(
          this.operatorNameById().get(trip.operatorId) ?? trip.operatorId,
        );
        this.detailTrip.set(trip);
      },
    });
  }

  onDetailDismiss(): void {
    this.detailTrip.set(null);
    this.detailOperatorName.set('');
  }

  onDetailTripUpdated(trip: Trip): void {
    this.detailTrip.set(trip);
    this.detailOperatorName.set(
      this.operatorNameById().get(trip.operatorId) ?? trip.operatorId,
    );
    this.loadManiobras({ showLoading: false });
  }

  onManiobraSaved(payload: CreateTripPayload): void {
    this.maniobrasRepo.create(payload).subscribe({
      next: () => {
        this.toast.show('Maniobra programada.', 'success');
        this.newManiobraOpen.set(false);
        this.loadManiobras();
      },
    });
  }

  private operatorNameMap(operators: Operator[]): Map<string, string> {
    return new Map(operators.map((o) => [o.id, o.name]));
  }

  private rowMatchesSearch(row: Record<string, unknown>, q: string): boolean {
    const status = String(row['status'] ?? '');
    const statusExtra = this.statusSearchHints(status);
    const hasInc = row['hasIncident'] === true || row['hasIncident'] === 'true';
    const blob = [
      row['code'],
      row['route'],
      row['clientName'],
      row['operatorName'],
      row['unitId'],
      status,
      statusExtra,
      row['departureAt'],
      row['arrivedAt'],
      row['operationType'],
      hasInc ? 'incidente' : '',
    ]
      .map((x) => String(x ?? '').toLowerCase())
      .join(' ');
    return blob.includes(q);
  }

  private statusSearchHints(status: string): string {
    const hints: Record<string, string> = {
      in_transit: 'en curso transito ruta',
      scheduled: 'programado',
      completed: 'completado terminado',
      cancelled: 'cancelado',
    };
    return hints[status] ?? '';
  }

  private mapRow(
    t: Trip,
    operatorNames: Map<string, string>,
  ): Record<string, unknown> {
    return {
      id: t.id,
      code: t.maneuverCode,
      route: `${t.origin} → ${t.destination}`,
      clientName: t.clientName,
      operatorName: operatorNames.get(t.operatorId) ?? t.operatorId,
      unitId: labelForUnitId(t.unitId),
      status: t.status,
      falseManeuver: t.falseManeuver === true,
      departureAt: formatStackedMx(t.departureAt),
      arrivedAt: formatStackedMx(t.arrivedAt),
      operationType: t.operationType,
      hasIncident: (t.incidents?.length ?? 0) > 0 || t.hasIncident,
    };
  }
}
