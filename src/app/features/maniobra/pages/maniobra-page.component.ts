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
import { TripsService } from '@services/api/trips';
import type { CreateTripPayload } from '@shared/models/api/api-trips.model';
import {
  maniobraListRowFromTrip,
  maniobraListRowMatchesSearch,
} from '@features/maniobra/utils/maniobra-list-row';
import { tripContainerTypeLabelMx } from '@features/maniobra/utils/trip-container-type-label';
import { tripCargoDescriptionDisplay } from '@features/maniobra/utils/trip-cargo-description';
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
import {
  schemaPrimaryTrailerAsset,
  schemaSecondaryTrailerAsset,
  SCHEMA_TRACTO_ASSET,
  tripSchemaUsesPlataformaConvoy,
} from '@features/maniobra/utils/maniobra-schema-convoy-assets';
import { formatTripRouteLabel } from '@shared/utils/trip-route-label';
import {
  tripOperationTypeBadgeClass,
  tripOperationTypeBadgeLabel,
} from '@shared/utils/trip-operation-type-badge';
import { Trip, TripIncident, TripStatus } from '@shared/models/logistics.models';
import { formatStackedMx } from '@shared/utils/format-datetime-mx';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';
import {
  ToSegmentControlComponent,
  type ToSegmentTab,
} from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToFilterTabsComponent } from '@shared/ui/to-filter-tabs/to-filter-tabs.component';
import type { ToFilterTab } from '@shared/ui/to-filter-tabs/to-filter-tabs.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

export type ManiobraStatusFilter = TripStatus | 'all';

export type ManiobraViewMode = 'table' | 'route';

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
    ToFilterTabsComponent,
    ToSegmentControlComponent,
    ManiobraNewDrawerComponent,
    ManiobraDetailDrawerComponent,
  ],
  templateUrl: './maniobra-page.component.html',
  styleUrl: './maniobra-page.component.scss',
})
export class ManiobraPageComponent {
  readonly schemaTractoAsset = SCHEMA_TRACTO_ASSET;

  private readonly tripsApi = inject(TripsService);
  private readonly toast = inject(ToastService);

  private readonly listResource = resource({
    loader: async (): Promise<Trip[]> =>
      firstValueFrom(
        this.tripsApi.getTripsList().pipe(catchError(() => of([] as Trip[]))),
      ),
  });

  /** Solo skeleton en carga inicial; `reload()` tras guardar no parpadea. */
  readonly loading = computed(
    () => !this.listResource.hasValue() && this.listResource.isLoading(),
  );

  readonly newManiobraOpen = signal(false);

  /** Vista tabla vs. ruta (solo en tránsito + búsqueda en ruta). */
  readonly viewMode = signal<ManiobraViewMode>('table');
  readonly viewSegmentTabs: readonly ToSegmentTab<ManiobraViewMode>[] = [
    { id: 'table', label: 'Tabla', icon: 'grid', htmlId: 'maniobra-tab-table' },
    { id: 'route', label: 'Ruta', icon: 'route', htmlId: 'maniobra-tab-route' },
  ];

  readonly rows = computed(() => {
    const trips = this.listResource.value();
    if (!trips) {
      return [];
    }
    return trips.map((t) => maniobraListRowFromTrip(t, new Map(), []));
  });

  readonly tripsList = computed(() => this.listResource.value() ?? ([] as Trip[]));

  readonly operatorNameById = computed(() => new Map<string, string>());

  readonly detailTrip = signal<Trip | null>(null);
  readonly detailOperatorName = signal('');

  readonly statusFilter = signal<ManiobraStatusFilter>('all');

  readonly searchQuery = model('');

  readonly filterTabs: ReadonlyArray<ToFilterTab<ManiobraStatusFilter>> = [
    { id: 'all', label: 'Todos', icon: 'grid' },
    { id: 'in_transit', label: tripStatusUiLabel('in_transit'), icon: 'truck' },
    { id: 'scheduled', label: tripStatusUiLabel('scheduled'), icon: 'calendar' },
    { id: 'completed', label: tripStatusUiLabel('completed'), icon: 'checkCircle' },
    { id: 'cancelled', label: tripStatusUiLabel('cancelled'), icon: 'cancelCircle' },
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

  readonly unitsList = computed(() => [] as const);

  readonly equipmentById = computed(() => new Map<string, never>());

  /**
   * Maniobras en tránsito para la vista Ruta (tablero operativo), con el mismo
   * criterio de búsqueda de texto que la tabla.
   */
  readonly schemaTrips = computed(() => {
    const trips = this.listResource.value();
    if (!trips) {
      return [] as Trip[];
    }
    const q = this.searchQuery().trim().toLowerCase();
    return trips.filter((t) => {
      if (t.status !== 'in_transit') {
        return false;
      }
      if (!q) {
        return true;
      }
      const row = maniobraListRowFromTrip(t, new Map(), []);
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

  tripCargoDescriptionForTrip(trip: Trip): string {
    return tripCargoDescriptionDisplay(trip.cargoDescription);
  }

  unitLabelForTrip(trip: Trip): string {
    return trip.unitId?.trim() || 'Sin asignar';
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

  schemaUsesPlataformaConvoy(trip: Trip): boolean {
    return tripSchemaUsesPlataformaConvoy(trip, this.equipmentById());
  }

  schemaPrimaryTrailerAssetForTrip(trip: Trip): string {
    return schemaPrimaryTrailerAsset(trip, this.equipmentById());
  }

  schemaSecondaryTrailerAssetForTrip(trip: Trip): string {
    return schemaSecondaryTrailerAsset(trip, this.equipmentById());
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
    return tripIncidentPostedBy(inc, []);
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
    void firstValueFrom(this.tripsApi.getTripById(id))
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
    void firstValueFrom(this.tripsApi.postTrip(payload))
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
