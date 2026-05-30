import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  model,
  signal,
  OnInit,
} from '@angular/core';
import { ToastService } from '@core/notifications/toast.service';
import {
  maniobraListRowFromTrip,
  maniobraListRowMatchesSearch,
} from '@features/trips/utils/maniobra-list-row';
import { tripContainerTypeLabelMx } from '@features/trips/utils/trip-container-type-label';
import { tripCargoDescriptionDisplay } from '@features/trips/utils/trip-cargo-description';
import {
  approximateManeuverDaysLabel,
  approximateManeuverKmLabel,
  maneuverTimeProgress,
  type ManeuverTimeProgress,
} from '@features/trips/utils/maniobra-schema-eta';
import { formatTripIsoOneLine } from '@features/trips/utils/maniobra-trip-schema-timeline';
import {
  schemaOperationalStatusClass,
  schemaOperationalStatusLabel,
} from '@features/trips/utils/maniobra-schema-operational-status';
import {
  tripHasIncidents,
  tripIncidentPostedBy,
  tripIncidentsSorted,
} from '@features/trips/utils/trip-incidents';
import { snapshotTextOrDash } from '@features/trips/utils/maniobra-route-display';
import {
  schemaPrimaryTrailerAsset,
  schemaSecondaryTrailerAsset,
  SCHEMA_TRACTO_ASSET,
  tripSchemaUsesPlataformaConvoy,
} from '@features/trips/utils/maniobra-schema-convoy-assets';
import { OperationConfigurationResolverService } from '@shared/services/operation-configuration-resolver.service';
import { TRIP_EVALUATION_PROVIDERS } from '@shared/services/trip-evaluation.providers';
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
import { TripsDetailDrawerComponent } from '@features/trips/components/trips-detail-drawer/trips-detail-drawer.component';
import { TripsNewDrawerComponent } from '@features/trips/components/trips-new-drawer/trips-new-drawer.component';
import { TripsFeatureService } from '@features/trips/services/trips.service';
import { tripOperatorDisplayName, tripUnitDisplayCode, formatTripRouteSummary } from '@features/trips/utils/trip-display-labels';

export type TripsStatusFilter = TripStatus | 'all';

export type TripsViewMode = 'table' | 'route';

@Component({
  selector: 'app-trips-page',
  standalone: true,
  providers: [TripsFeatureService, ...TRIP_EVALUATION_PROVIDERS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToPageHeaderComponent,
    ToTableComponent,
    ToSkeletonComponent,
    ToButtonComponent,
    ToInputComponent,
    ToFilterTabsComponent,
    ToSegmentControlComponent,
    TripsNewDrawerComponent,
    TripsDetailDrawerComponent,
  ],
  templateUrl: './trips-page.component.html',
  styleUrl: './trips-page.component.scss',
})
export class TripsPageComponent implements OnInit {
  readonly schemaTractoAsset = SCHEMA_TRACTO_ASSET;

  private readonly destroyRef = inject(DestroyRef);
  protected readonly tripsFeature = inject(TripsFeatureService);
  private readonly opResolver = inject(OperationConfigurationResolverService);
  private readonly toast = inject(ToastService);
  readonly loading = this.tripsFeature.loading;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.tripsFeature.dispose();
    });
  }

  readonly newTripOpen = signal(false);

  /** Vista tabla vs. ruta (solo en tránsito + búsqueda en ruta). */
  readonly viewMode = signal<TripsViewMode>('table');
  readonly viewSegmentTabs: readonly ToSegmentTab<TripsViewMode>[] = [
    { id: 'table', label: 'Tabla', icon: 'grid', htmlId: 'maniobra-tab-table' },
    { id: 'route', label: 'Ruta', icon: 'route', htmlId: 'maniobra-tab-route' },
  ];

  readonly rows = computed(() => {
    const trips = this.tripsFeature.trips();
    return trips.map((t) => maniobraListRowFromTrip(t));
  });

  readonly tripsList = this.tripsFeature.trips;

  readonly statusFilter = signal<TripsStatusFilter>('all');

  readonly searchQuery = model('');

  readonly filterTabs: ReadonlyArray<ToFilterTab<TripsStatusFilter>> = [
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

  /** Vacío en listado: la vista ruta usa snapshots del trip (sin catálogo de equipment). */
  private readonly schemaEquipmentById = new Map<
    string,
    import('@shared/models/logistics.models').Equipment
  >();

  /**
   * Maniobras en tránsito para la vista Ruta (tablero operativo), con el mismo
   * criterio de búsqueda de texto que la tabla.
   */
  readonly schemaTrips = computed(() => {
    const trips = this.tripsFeature.trips();
    const q = this.searchQuery().trim().toLowerCase();
    return trips.filter((t) => {
      if (t.status !== 'in_transit') {
        return false;
      }
      if (!q) {
        return true;
      }
      const row = maniobraListRowFromTrip(t);
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

  ngOnInit(): void {
    this.tripsFeature.loadTrips();
  }

  tripContainerLabel(trip: Trip): string {
    return tripContainerTypeLabelMx(trip.containerType);
  }

  tripCargoDescriptionForTrip(trip: Trip): string {
    return tripCargoDescriptionDisplay(trip.cargoDescription);
  }

  unitLabelForTrip(trip: Trip): string {
    return tripUnitDisplayCode(trip);
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
    return tripOperatorDisplayName(trip);
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
    return tripSchemaUsesPlataformaConvoy(
      trip,
      this.schemaEquipmentById,
      this.opResolver,
    );
  }

  schemaPrimaryTrailerAssetForTrip(trip: Trip): string {
    return schemaPrimaryTrailerAsset(
      trip,
      this.schemaEquipmentById,
      this.opResolver,
    );
  }

  schemaSecondaryTrailerAssetForTrip(trip: Trip): string {
    return schemaSecondaryTrailerAsset(
      trip,
      this.schemaEquipmentById,
      this.opResolver,
    );
  }

  equipmentSlotsForTrip(trip: Trip): (string | null)[] {
    const max = this.opResolver.resolveMaxEquipment(this.opResolver.contextFromTrip(trip));
    const raw = (trip.equipment ?? [])
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0);
    const slots: (string | null)[] = [];
    for (let i = 0; i < max; i++) {
      slots.push(raw[i] ?? null);
    }
    return slots;
  }

  tripOperationDisplay(trip: Trip) {
    return this.opResolver.resolveTripDisplay(trip);
  }

  tripUsesMultiEquipment(trip: Trip): boolean {
    return this.opResolver.usesMultipleEquipment(this.opResolver.contextFromTrip(trip));
  }

  weightLineForTrip(trip: Trip): string {
    const w = trip.approximateWeightTons?.trim();
    return w ? `${w} t` : '—';
  }

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
    return formatTripRouteSummary(trip);
  }

  arrivalLineForTrip(trip: Trip): string {
    return formatTripIsoOneLine(trip.arrivedAt);
  }

  returnLineForTrip(trip: Trip): string {
    return formatTripIsoOneLine(trip.returnAt);
  }

  onStatusFilterSelect(value: TripsStatusFilter): void {
    if (this.viewMode() !== 'table') {
      return;
    }
    this.statusFilter.set(value);
  }

  onTripRowClick(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    if (!id) {
      return;
    }
    this.tripsFeature.selectTrip(id);
  }

  onDetailDismiss(): void {
    this.tripsFeature.clearSelection();
  }

  onTripCreated(_trip: Trip): void {
    this.toast.show('Maniobra programada.', 'success');
    this.newTripOpen.set(false);
  }
}
