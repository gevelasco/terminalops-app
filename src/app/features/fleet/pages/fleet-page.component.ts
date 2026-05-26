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
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import {
  formatUnitTrailerOperationalId,
  labelForUnitId,
} from '@shared/utils/fleet/unit-label';
import { FleetEquipmentDetailDrawerComponent } from '@features/fleet/components/fleet-equipment-detail-drawer/fleet-equipment-detail-drawer.component';
import { FleetNewEquipmentDrawerComponent } from '@features/fleet/components/fleet-new-equipment-drawer/fleet-new-equipment-drawer.component';
import { FleetNewUnitDrawerComponent } from '@features/fleet/components/fleet-new-unit-drawer/fleet-new-unit-drawer.component';
import { FleetUnitDetailDrawerComponent } from '@features/fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer.component';
import { EquipmentService } from '@services/api/equipment';
import { UnitsService } from '@services/api/units';
import {
  buildFleetEquipmentTableRow,
  buildFleetUnitTableRow,
  fleetOperationalKeyLabel,
  operationalKey,
  type FleetOperationalKey,
  type FleetRenewalBucket,
} from '@features/fleet/utils/fleet-unit-table-row';
import {
  SCHEMA_TRACTO_ASSET,
  unitConvoyIsFull,
  unitConvoyPrimaryAsset,
  unitConvoySecondaryAsset,
  unitConvoyUsesPlataforma,
} from '@features/fleet/utils/fleet-unit-convoy-assets';
import { buildUnitCompletedTripStats } from '@features/fleet/utils/unit-completed-trip-stats';
import {
  equipmentAssignedToUnit,
  equipmentTypeDisplayLabel,
  hitchPositionLabel,
  unitConvoyFromEquipment,
} from '@features/fleet/utils/unit-hitched-equipment';
import {
  schemaPrimaryTrailerAsset,
  schemaSecondaryTrailerAsset,
  tripSchemaUsesPlataformaConvoy,
} from '@features/maniobra/utils/maniobra-schema-convoy-assets';
import {
  tripHasIncidents,
  tripIncidentPostedBy,
  tripIncidentsSorted,
} from '@features/maniobra/utils/trip-incidents';
import {
  activeTripForUnit,
  fleetOverviewArrivalLine,
  fleetOverviewDepartureLine,
  fleetOverviewEtaDays,
  fleetOverviewEtaKm,
  fleetOverviewInsuranceNext,
  fleetOverviewKmSinceMaintenance,
  fleetOverviewLastMaintenanceLabel,
  fleetOverviewNextMaintenanceLabel,
  fleetOverviewPanelMode,
  fleetOverviewProgress,
  fleetOverviewReturnLine,
  fleetOverviewRouteLabel,
  fleetOverviewSortRank,
  fleetOverviewStatusPill,
  fleetOverviewTireStatusApprox,
  fleetOverviewVerificationNext,
  fleetRenewalIconClass,
  unitMatchesOverviewStatusFilter,
  type FleetOverviewPanelMode,
} from '@features/fleet/utils/fleet-overview-card';
import { OperatorsService } from '@services/api/operators';
import {
  normalizeEquipmentFromApi,
  normalizeOperatorFromApi,
  normalizeUnitFromApi,
} from '@shared/utils/fleet/normalize-fleet-entities';
import { operatorNamesById } from '@shared/utils/operator-name-map';
import { resourceIdKey } from '@shared/utils/resource-id';
import { formatStackedMx } from '@shared/utils/format-datetime-mx';
import { tripOperationTypeBadgeLabel } from '@shared/utils/trip-operation-type-badge';
import {
  Equipment,
  Operator,
  Trip,
  TripIncident,
  Unit,
} from '@shared/models/logistics.models';
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

type FleetPageTab = 'overview' | 'units' | 'equipment';

export type FleetOverviewStatusFilter = Exclude<
  FleetOperationalKey,
  'in_use' | 'unknown'
> | 'all';

type FleetListBundle = {
  units: Unit[];
  equipment: Equipment[];
  operators: Operator[];
  operatorNames: Map<string, string>;
};

@Component({
  selector: 'app-fleet-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToPageHeaderComponent,
    ToButtonComponent,
    ToInputComponent,
    ToTableComponent,
    ToSkeletonComponent,
    ToFilterTabsComponent,
    ToSegmentControlComponent,
    FleetNewUnitDrawerComponent,
    FleetNewEquipmentDrawerComponent,
    FleetUnitDetailDrawerComponent,
    FleetEquipmentDetailDrawerComponent,
  ],
  templateUrl: './fleet-page.component.html',
  styleUrl: './fleet-page.component.scss',
})
export class FleetPageComponent {
  private readonly unitsApi = inject(UnitsService);
  private readonly equipmentApi = inject(EquipmentService);
  private readonly operatorsApi = inject(OperatorsService);

  private readonly fleetResource = resource({
    loader: async (): Promise<FleetListBundle> => {
      const [units, equipment, operators] = await Promise.all([
        firstValueFrom(
          this.unitsApi.getUnitsList().pipe(catchError(() => of([] as Unit[]))),
        ),
        firstValueFrom(
          this.equipmentApi
            .getEquipmentList()
            .pipe(catchError(() => of([] as Equipment[]))),
        ),
        firstValueFrom(
          this.operatorsApi
            .getOperatorsList()
            .pipe(catchError(() => of([] as Operator[]))),
        ),
      ]);
      const normalizedUnits = units.map(normalizeUnitFromApi);
      const normalizedEquipment = equipment.map(normalizeEquipmentFromApi);
      const normalizedOperators = operators.map(normalizeOperatorFromApi);
      return {
        units: normalizedUnits,
        equipment: normalizedEquipment,
        operators: normalizedOperators,
        operatorNames: operatorNamesById(normalizedOperators),
      };
    },
  });

  readonly tab = signal<FleetPageTab>('overview');
  readonly viewSegmentTabs: readonly ToSegmentTab<FleetPageTab>[] = [
    { id: 'overview', label: 'Flota', icon: 'truck', htmlId: 'fleet-tab-overview' },
    { id: 'units', label: 'Unidades', icon: 'list', htmlId: 'fleet-tab-units' },
    {
      id: 'equipment',
      label: 'Equipo',
      icon: 'equipment',
      htmlId: 'fleet-tab-equipment',
    },
  ];

  readonly schemaTractoAsset = SCHEMA_TRACTO_ASSET;
  readonly formatUnitTrailerOperationalId = formatUnitTrailerOperationalId;

  readonly overviewStatusFilter = signal<FleetOverviewStatusFilter>('all');

  readonly overviewFilterTabs: ReadonlyArray<
    ToFilterTab<FleetOverviewStatusFilter>
  > = [
    { id: 'all', label: 'Todos', icon: 'grid' },
    { id: 'available', label: fleetOperationalKeyLabel('available'), icon: 'available' },
    { id: 'scheduled', label: fleetOperationalKeyLabel('scheduled'), icon: 'calendar' },
    { id: 'on_route', label: fleetOperationalKeyLabel('on_route'), icon: 'truck' },
    { id: 'maintenance', label: fleetOperationalKeyLabel('maintenance'), icon: 'maintenance' },
  ];

  readonly loadingOverview = computed(
    () => !this.fleetResource.hasValue() && this.fleetResource.isLoading(),
  );
  readonly loadingUnits = this.loadingOverview;
  readonly loadingEquipment = this.loadingOverview;

  readonly unitList = computed(
    () => this.fleetResource.value()?.units ?? [],
  );
  readonly equipmentList = computed(
    () => this.fleetResource.value()?.equipment ?? [],
  );
  readonly tripsList = computed((): Trip[] => []);

  readonly equipmentById = computed(() => {
    const map = new Map<string, Equipment>();
    for (const e of this.equipmentList()) {
      map.set(e.id, e);
    }
    return map;
  });

  readonly operatorNames = computed(
    () => this.fleetResource.value()?.operatorNames ?? new Map<string, string>(),
  );

  readonly unitTripStats = computed(() =>
    buildUnitCompletedTripStats(this.tripsList()),
  );

  readonly newUnitOpen = signal(false);
  readonly newEquipmentOpen = signal(false);

  readonly detailUnit = signal<Unit | null>(null);
  readonly detailUnitOnRoute = signal(false);
  readonly detailEquipment = signal<Equipment | null>(null);
  readonly detailEquipmentOnRoute = signal(false);

  /** `Equipment` del drawer con campos UI (`uiTractorCompletedTripDistanceKm`). */
  readonly detailUnitHitchedEquipment = computed(() => {
    const u = this.detailUnit();
    if (!u) {
      return [];
    }
    return equipmentAssignedToUnit(this.equipmentList(), u.id);
  });

  readonly detailEquipmentForDrawer = computed((): Equipment | null => {
    const e = this.detailEquipment();
    if (!e) {
      return null;
    }
    const km =
      this.unitTripStats().completedDistanceKmSumByUnitId.get(e.unitId) ??
      null;
    return { ...e, uiTractorCompletedTripDistanceKm: km };
  });

  readonly searchQuery = model('');

  readonly unitsInTransitIds = computed(() => {
    const ids = new Set<string>();
    for (const t of this.tripsList()) {
      if (t.status === 'in_transit') {
        ids.add(resourceIdKey(t.unitId));
      }
    }
    return ids;
  });

  readonly displayedUnitRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.unitList();
    const onSet = this.unitsInTransitIds();
    const kmById = this.unitTripStats().completedDistanceKmSumByUnitId;
    const equipment = this.equipmentList();
    const rowOpts = (u: Unit) => {
      const hitched = equipmentAssignedToUnit(equipment, u.id);
      return {
        onRoute: onSet.has(u.id),
        completedTripKm: kmById.get(u.id) ?? null,
        hitchedEquipment: hitched,
      };
    };
    const filtered = q
      ? list.filter((u) => {
          const hitched = equipmentAssignedToUnit(equipment, u.id);
          const row = buildFleetUnitTableRow(u, rowOpts(u));
          const blob = [
            row['fleetBrand'],
            row['fleetModel'],
            row['fleetPlate'],
            tripOperationTypeBadgeLabel(row['fleetConfig']),
            unitConvoyFromEquipment(hitched).label,
            u.id,
            u.type,
            u.status,
            u.serialNumber,
            u.name,
            String(u.capacityKg ?? ''),
          ]
            .filter((x) => x != null && String(x).trim() !== '')
            .join(' ')
            .toLowerCase();
          return blob.includes(q);
        })
      : list;
    return filtered.map((u) => buildFleetUnitTableRow(u, rowOpts(u)));
  });

  readonly displayedEquipmentRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.equipmentList();
    const units = this.unitList();
    const onSet = this.unitsInTransitIds();
    const kmById = this.unitTripStats().completedDistanceKmSumByUnitId;
    return list
      .map((e) => ({
        e,
        row: buildFleetEquipmentTableRow(e, {
          onRoute: onSet.has(e.unitId),
          completedTripKm: kmById.get(e.unitId) ?? null,
        }),
      }))
      .filter(({ e, row }) => {
        if (!q) {
          return true;
        }
        const m = e.fleetMeta;
        const blob = [
          row['fleetBrand'],
          row['fleetModel'],
          row['fleetUnitType'],
          row['fleetPlate'],
          row['id'],
          row['fleetVerifNext'],
          row['fleetMaintNext'],
          formatEquipmentOperationalId(e),
          e.unitId,
          labelForUnitId(e.unitId, units),
          e.name,
          e.serialNumber,
          e.lastServiceDate,
          e.trailerBrandAbbr,
          e.trailerYear,
          m?.trailerBrandName,
          m?.trailerVersion,
          m?.insurancePolicyNumber,
          m?.verificationPhysMechDate,
        ]
          .filter((x) => x != null && String(x).trim() !== '')
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      })
      .map(({ row }) => row);
  });

  readonly overviewUnits = computed(() => {
    const list = this.unitList();
    const equipment = this.equipmentList();
    const trips = this.tripsList();
    const onSet = this.unitsInTransitIds();
    const status = this.overviewStatusFilter();
    const q = this.searchQuery().trim().toLowerCase();
    const kmById = this.unitTripStats().completedDistanceKmSumByUnitId;

    return list
      .map((unit) => {
        const hitched = equipmentAssignedToUnit(equipment, unit.id);
        const onRoute = onSet.has(unit.id);
        const operational = operationalKey(unit, onRoute);
        const convoy = unitConvoyFromEquipment(hitched);
        const activeTrip = activeTripForUnit(unit.id, trips);
        const panelMode = fleetOverviewPanelMode(operational, activeTrip);
        const statusPill = fleetOverviewStatusPill(activeTrip, operational);
        const completedTripKm = kmById.get(unit.id) ?? null;
        const tableRow = buildFleetUnitTableRow(unit, {
          onRoute,
          completedTripKm,
          hitchedEquipment: hitched,
        });
        return {
          unit,
          hitched,
          onRoute,
          operational,
          convoy,
          activeTrip,
          panelMode,
          statusPill,
          tableRow,
          completedTripKm,
        };
      })
      .filter((entry) => {
        if (
          !unitMatchesOverviewStatusFilter(
            entry.operational,
            entry.activeTrip,
            status,
          )
        ) {
          return false;
        }
        if (!q) {
          return true;
        }
        const blob = [
          formatUnitTrailerOperationalId(entry.unit),
          entry.tableRow['fleetBrand'],
          entry.tableRow['fleetPlate'],
          entry.tableRow['fleetModel'],
          tripOperationTypeBadgeLabel(entry.tableRow['fleetConfig']),
          entry.convoy.label,
          entry.unit.id,
          entry.statusPill.label,
          entry.activeTrip?.maneuverCode,
          entry.activeTrip?.clientName,
          entry.activeTrip?.origin,
          entry.activeTrip?.destination,
          ...entry.hitched.map((e) => formatEquipmentOperationalId(e)),
        ]
          .filter((x) => x != null && String(x).trim() !== '')
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => {
        const rankDiff =
          fleetOverviewSortRank(a.operational, a.activeTrip) -
          fleetOverviewSortRank(b.operational, b.activeTrip);
        if (rankDiff !== 0) {
          return rankDiff;
        }
        return formatUnitTrailerOperationalId(a.unit).localeCompare(
          formatUnitTrailerOperationalId(b.unit),
          'es',
        );
      });
  });

  readonly unitSelectOptions = computed(() =>
    this.unitList().map((u) => ({
      value: u.id,
      label: formatUnitTrailerOperationalId(u),
    })),
  );

  readonly unitColumns: ToTableColumn[] = [
    { key: 'fleetBrand', label: 'Marca' },
    { key: 'fleetModel', label: 'Modelo' },
    { key: 'fleetPlate', label: 'Placa' },
    {
      key: 'fleetOperational',
      label: 'Estado operativo',
      cell: 'fleet-op-pill',
    },
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
    {
      key: 'fleetConfig',
      label: 'Configuración',
      cell: 'operation-type',
    },
  ];

  readonly equipmentColumns: ToTableColumn[] = [
    { key: 'fleetBrand', label: 'Marca' },
    { key: 'fleetModel', label: 'Modelo' },
    { key: 'fleetUnitType', label: 'Tipo de remolque' },
    { key: 'fleetPlate', label: 'Placa' },
    {
      key: 'fleetOperational',
      label: 'Estado operativo',
      cell: 'fleet-op-pill',
    },
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

  loadUnits(): void {
    void this.fleetResource.reload();
  }

  loadEquipment(): void {
    void this.fleetResource.reload();
  }

  onViewTabSelect(tab: FleetPageTab): void {
    this.tab.set(tab);
    this.searchQuery.set('');
  }

  showOverview(): void {
    this.onViewTabSelect('overview');
  }

  showUnits(): void {
    this.onViewTabSelect('units');
  }

  showEquipment(): void {
    this.onViewTabSelect('equipment');
  }

  onOverviewStatusFilterSelect(value: FleetOverviewStatusFilter): void {
    this.overviewStatusFilter.set(value);
  }

  overviewUsesPlataformaForEntry(entry: {
    panelMode: FleetOverviewPanelMode;
    activeTrip: Trip | null;
    hitched: Equipment[];
  }): boolean {
    if (entry.panelMode === 'maneuver' && entry.activeTrip) {
      return tripSchemaUsesPlataformaConvoy(
        entry.activeTrip,
        this.equipmentById(),
      );
    }
    return unitConvoyUsesPlataforma(entry.hitched);
  }

  overviewIsFullForEntry(entry: {
    panelMode: FleetOverviewPanelMode;
    activeTrip: Trip | null;
    hitched: Equipment[];
  }): boolean {
    if (entry.panelMode === 'maneuver' && entry.activeTrip) {
      return entry.activeTrip.operationType === 'full';
    }
    return unitConvoyIsFull(entry.hitched);
  }

  overviewPrimaryAssetForEntry(entry: {
    panelMode: FleetOverviewPanelMode;
    activeTrip: Trip | null;
    hitched: Equipment[];
  }): string {
    if (entry.panelMode === 'maneuver' && entry.activeTrip) {
      return schemaPrimaryTrailerAsset(entry.activeTrip, this.equipmentById());
    }
    return unitConvoyPrimaryAsset(entry.hitched);
  }

  overviewSecondaryAssetForEntry(entry: {
    panelMode: FleetOverviewPanelMode;
    activeTrip: Trip | null;
    hitched: Equipment[];
  }): string {
    if (entry.panelMode === 'maneuver' && entry.activeTrip) {
      return schemaSecondaryTrailerAsset(entry.activeTrip, this.equipmentById());
    }
    return unitConvoySecondaryAsset(entry.hitched);
  }

  overviewEquipmentLabel(eq: Equipment): string {
    return formatEquipmentOperationalId(eq);
  }

  overviewEquipmentTypeLabel(eq: Equipment): string {
    return equipmentTypeDisplayLabel(eq);
  }

  overviewHitchLabel(index: number, total: number): string {
    return hitchPositionLabel(index, total);
  }

  readonly tripHasIncidents = tripHasIncidents;
  readonly tripIncidentsSorted = tripIncidentsSorted;
  readonly formatStackedMx = formatStackedMx;

  overviewTripIncidentAuthor(inc: TripIncident): string {
    const operators = this.fleetResource.value()?.operators ?? [];
    return tripIncidentPostedBy(inc, operators);
  }

  overviewTripIncidentAria(trip: Trip): string {
    if (!tripHasIncidents(trip)) {
      return 'Sin incidentes';
    }
    const n = tripIncidentsSorted(trip).length;
    if (n > 0) {
      return `${n} incidente${n === 1 ? '' : 's'} registrado${n === 1 ? '' : 's'}`;
    }
    return 'Incidente registrado';
  }

  overviewRenewalIconClass(bucket: unknown): string {
    return fleetRenewalIconClass(bucket as FleetRenewalBucket);
  }

  overviewLastMaint = fleetOverviewLastMaintenanceLabel;
  overviewNextMaint = fleetOverviewNextMaintenanceLabel;
  overviewKmSinceMaint = fleetOverviewKmSinceMaintenance;
  overviewInsNext = fleetOverviewInsuranceNext;
  overviewVerifNext = fleetOverviewVerificationNext;
  overviewTireStatus = fleetOverviewTireStatusApprox;
  overviewDepartureLine = fleetOverviewDepartureLine;
  overviewRouteLabel = fleetOverviewRouteLabel;
  overviewArrivalLine = fleetOverviewArrivalLine;
  overviewReturnLine = fleetOverviewReturnLine;
  overviewEtaDays = fleetOverviewEtaDays;
  overviewEtaKm = fleetOverviewEtaKm;
  overviewProgress = fleetOverviewProgress;

  onOverviewUnitClick(unit: Unit): void {
    this.detailUnitOnRoute.set(this.unitsInTransitIds().has(unit.id));
    this.detailUnit.set(unit);
  }

  onOverviewEquipmentClick(event: Event, equipment: Equipment): void {
    event.stopPropagation();
    this.detailUnit.set(null);
    this.detailUnitOnRoute.set(false);
    const unitRef = resourceIdKey(equipment.unitId);
    this.detailEquipmentOnRoute.set(
      Boolean(unitRef) && this.unitsInTransitIds().has(unitRef),
    );
    this.detailEquipment.set(equipment);
  }

  openNewEquipment(): void {
    if (this.unitList().length === 0) {
      return;
    }
    this.newEquipmentOpen.set(true);
  }

  onUnitRowClick(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    if (!id) {
      return;
    }
    const u = this.unitList().find((x) => x.id === id);
    if (!u) {
      return;
    }
    this.detailUnitOnRoute.set(this.unitsInTransitIds().has(id));
    this.detailUnit.set(u);
  }

  onUnitDetailDismiss(): void {
    this.detailUnit.set(null);
    this.detailUnitOnRoute.set(false);
  }

  onDetailUnitChange(unit: Unit): void {
    this.detailUnit.set(unit);
    this.loadUnits();
  }

  onUnitDetailViewEquipment(e: Equipment): void {
    this.detailUnit.set(null);
    this.detailUnitOnRoute.set(false);
    this.tab.set('equipment');
    const unitRef = resourceIdKey(e.unitId);
    this.detailEquipmentOnRoute.set(
      Boolean(unitRef) && this.unitsInTransitIds().has(unitRef),
    );
    this.detailEquipment.set(e);
  }

  onEquipmentRowClick(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    if (!id) {
      return;
    }
    const e = this.equipmentList().find((x) => x.id === id);
    if (!e) {
      return;
    }
    const unitRef = resourceIdKey(e.unitId);
    this.detailEquipmentOnRoute.set(
      Boolean(unitRef) && this.unitsInTransitIds().has(unitRef),
    );
    this.detailEquipment.set(e);
  }

  onEquipmentDetailDismiss(): void {
    this.detailEquipment.set(null);
    this.detailEquipmentOnRoute.set(false);
  }
}
