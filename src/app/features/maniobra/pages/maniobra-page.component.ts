import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
  resource,
  signal,
} from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { ManiobraDetailDrawerComponent } from '@features/maniobra/components/maniobra-detail-drawer/maniobra-detail-drawer.component';
import { ManiobraNewDrawerComponent } from '@features/maniobra/components/maniobra-new-drawer/maniobra-new-drawer.component';
import {
  CreateTripPayload,
  ManiobraRepository,
} from '@features/maniobra/data/maniobra.repository';
import {
  maniobraListRowFromTrip,
  maniobraListRowMatchesSearch,
} from '@features/maniobra/utils/maniobra-list-row';
import { tripContainerTypeLabelMx } from '@features/maniobra/utils/trip-container-type-label';
import {
  approximateManeuverDaysLabel,
  approximateManeuverKmLabel,
  maneuverTimeProgress,
  type ManeuverTimeProgress,
} from '@features/maniobra/utils/maniobra-schema-eta';
import { formatTripIsoOneLine } from '@features/maniobra/utils/maniobra-trip-schema-timeline';
import {
  schemaOperationalStatusClass,
  schemaOperationalStatusLabel,
} from '@features/maniobra/utils/maniobra-schema-operational-status';
import {
  tripHasIncidents,
  tripIncidentPostedBy,
  tripIncidentsSorted,
} from '@features/maniobra/utils/trip-incidents';
import { snapshotTextOrDash } from '@features/maniobra/utils/maniobra-route-display';
import { UnitRepository } from '@features/fleet/data/unit.repository';
import { labelForUnitId } from '@app/sim-db/utils/unit-label';
import { formatTripRouteLabel } from '@shared/utils/trip-route-label';
import {
  tripOperationTypeBadgeClass,
  tripOperationTypeBadgeLabel,
} from '@shared/utils/trip-operation-type-badge';
import { OperatorRepository } from '@features/operators/data/operator.repository';
import { operatorNamesById } from '@shared/utils/operator-name-map';
import {
  Operator,
  Trip,
  TripIncident,
  TripStatus,
  Unit,
} from '@shared/models/logistics.models';
import { formatStackedMx } from '@shared/utils/format-datetime-mx';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

export type ManiobraStatusFilter = TripStatus | 'all';

export type ManiobraViewMode = 'table' | 'schema';

type ManiobraListBundle = {
  trips: Trip[];
  operators: Operator[];
  operatorNames: Map<string, string>;
  units: Unit[];
};

@Component({
  selector: 'app-maniobra-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  /** Partes del convoy en esquema (PNG en `public/`). */
  readonly schemaTractoAsset = 'maniobra-schema-tracto.png';
  readonly schemaRemolqueAsset = 'maniobra-schema-remolque.png';
  readonly schemaEngancheAsset = 'maniobra-schema-enganche.png';

  private readonly maniobrasRepo = inject(ManiobraRepository);
  private readonly operatorsRepo = inject(OperatorRepository);
  private readonly unitsRepo = inject(UnitRepository);
  private readonly toast = inject(ToastService);

  private readonly listResource = resource({
    loader: async (): Promise<ManiobraListBundle> => {
      const [maniobras, operators, units] = await Promise.all([
        firstValueFrom(
          this.maniobrasRepo.list().pipe(catchError(() => of([] as Trip[]))),
        ),
        firstValueFrom(
          this.operatorsRepo
            .list()
            .pipe(catchError(() => of([] as Operator[]))),
        ),
        firstValueFrom(
          this.unitsRepo.list().pipe(catchError(() => of([] as Unit[]))),
        ),
      ]);
      return {
        trips: maniobras,
        operators,
        operatorNames: operatorNamesById(operators),
        units,
      };
    },
  });

  /** Solo skeleton en carga inicial; `reload()` tras guardar no parpadea. */
  readonly loading = computed(
    () => !this.listResource.hasValue() && this.listResource.isLoading(),
  );

  readonly newManiobraOpen = signal(false);

  /** Vista tabla vs. esquema (solo en tránsito + búsqueda en esquema). */
  readonly viewMode = signal<ManiobraViewMode>('table');

  readonly rows = computed(() => {
    const v = this.listResource.value();
    if (!v) {
      return [];
    }
    return v.trips.map((t) =>
      maniobraListRowFromTrip(t, v.operatorNames, v.units),
    );
  });

  readonly operatorNameById = computed(
    () => this.listResource.value()?.operatorNames ?? new Map<string, string>(),
  );

  readonly detailTrip = signal<Trip | null>(null);
  readonly detailOperatorName = signal('');

  readonly statusFilter = signal<ManiobraStatusFilter>('all');

  readonly searchQuery = model('');

  readonly filterTabs: ReadonlyArray<{
    value: ManiobraStatusFilter;
    label: string;
  }> = [
    { value: 'all', label: 'Todos' },
    { value: 'in_transit', label: tripStatusUiLabel('in_transit') },
    { value: 'scheduled', label: tripStatusUiLabel('scheduled') },
    { value: 'completed', label: tripStatusUiLabel('completed') },
    { value: 'cancelled', label: tripStatusUiLabel('cancelled') },
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
    return byStatus.filter((row) => maniobraListRowMatchesSearch(row, q));
  });

  readonly unitsList = computed(
    () => this.listResource.value()?.units ?? ([] as readonly Unit[]),
  );

  /**
   * Maniobras en tránsito para el esquema (tablero operativo), con el mismo
   * criterio de búsqueda de texto que la tabla.
   */
  readonly schemaTrips = computed(() => {
    const v = this.listResource.value();
    if (!v) {
      return [] as Trip[];
    }
    const q = this.searchQuery().trim().toLowerCase();
    return v.trips.filter((t) => {
      if (t.status !== 'in_transit') {
        return false;
      }
      if (!q) {
        return true;
      }
      const row = maniobraListRowFromTrip(t, v.operatorNames, v.units);
      return maniobraListRowMatchesSearch(row, q);
    });
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

  loadManiobras(_options?: { showLoading?: boolean }): void {
    void this.listResource.reload();
  }

  tripContainerLabel(trip: Trip): string {
    return tripContainerTypeLabelMx(trip.containerType);
  }

  unitLabelForTrip(trip: Trip): string {
    return labelForUnitId(trip.unitId, this.unitsList());
  }

  departureLineForTrip(trip: Trip): string {
    const dep = formatStackedMx(trip.departureAt);
    if (dep) {
      return `${dep.date} · ${dep.time}`;
    }
    const sch = formatStackedMx(trip.scheduledAt);
    if (sch) {
      return `Salida prevista: ${sch.date} · ${sch.time}`;
    }
    return '—';
  }

  operatorLabelForTrip(trip: Trip): string {
    return this.operatorNameById().get(trip.operatorId) ?? trip.operatorId;
  }

  operatorLicenseForTrip(trip: Trip): string {
    return snapshotTextOrDash(trip.operatorLicenseNumber);
  }

  schemaEtaDaysLabel(trip: Trip): string {
    return approximateManeuverDaysLabel(trip);
  }

  schemaEtaKmLabel(trip: Trip): string {
    return approximateManeuverKmLabel(trip);
  }

  schemaProgressForTrip(trip: Trip): ManeuverTimeProgress | null {
    return maneuverTimeProgress(trip);
  }

  /** Códigos de equipo a mostrar (1 sencillo/plana, 2 full). */
  equipmentSlotsForTrip(trip: Trip): (string | null)[] {
    const max = trip.operationType === 'full' ? 2 : 1;
    const raw = (trip.equipment ?? [])
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0);
    const slots: (string | null)[] = [];
    for (let i = 0; i < max; i++) {
      slots.push(raw[i] ?? null);
    }
    return slots;
  }

  weightLineForTrip(trip: Trip): string {
    const w = trip.approximateWeightTons?.trim();
    return w ? `${w} t` : '—';
  }

  readonly tripOperationTypeBadgeClass = tripOperationTypeBadgeClass;
  readonly tripOperationTypeBadgeLabel = tripOperationTypeBadgeLabel;
  readonly schemaOperationalStatusClass = schemaOperationalStatusClass;
  readonly schemaOperationalStatusLabel = schemaOperationalStatusLabel;
  readonly tripHasIncidents = tripHasIncidents;
  readonly tripIncidentsSorted = tripIncidentsSorted;
  readonly formatStackedMx = formatStackedMx;

  incidentAuthorLabel(inc: TripIncident): string {
    const operators = this.listResource.value()?.operators ?? [];
    return tripIncidentPostedBy(inc, operators);
  }

  tripIncidentAriaLabel(trip: Trip): string {
    if (!tripHasIncidents(trip)) {
      return 'Sin incidentes';
    }
    const n = tripIncidentsSorted(trip).length;
    if (n > 0) {
      return `${n} incidente${n === 1 ? '' : 's'} registrado${n === 1 ? '' : 's'}`;
    }
    return 'Incidente registrado';
  }

  routeLabelForTrip(trip: Trip): string {
    return formatTripRouteLabel(trip.origin, trip.destination);
  }

  arrivalLineForTrip(trip: Trip): string {
    return formatTripIsoOneLine(trip.arrivedAt);
  }

  returnLineForTrip(trip: Trip): string {
    return formatTripIsoOneLine(trip.returnAt);
  }

  openTripDetail(trip: Trip): void {
    this.detailOperatorName.set(this.operatorLabelForTrip(trip));
    this.detailTrip.set(trip);
  }

  onStatusFilterSelect(value: ManiobraStatusFilter): void {
    if (this.viewMode() !== 'table') {
      return;
    }
    this.statusFilter.set(value);
  }

  onManiobraRowClick(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    if (!id) {
      return;
    }
    void firstValueFrom(this.maniobrasRepo.get(id))
      .then((trip) => {
        if (!trip) {
          return;
        }
        this.openTripDetail(trip);
      })
      .catch(() => {
        /* detalle no disponible o error de red */
      });
  }

  onDetailDismiss(): void {
    this.detailTrip.set(null);
    this.detailOperatorName.set('');
  }

  onDetailTripUpdated(trip: Trip): void {
    this.openTripDetail(trip);
    this.loadManiobras({ showLoading: false });
  }

  onManiobraSaved(payload: CreateTripPayload): void {
    void firstValueFrom(this.maniobrasRepo.create(payload))
      .then(() => {
        this.toast.show('Maniobra programada.', 'success');
        this.newManiobraOpen.set(false);
        this.loadManiobras();
      })
      .catch(() => {
        this.toast.show('No se pudo guardar la maniobra.', 'error');
      });
  }
}
