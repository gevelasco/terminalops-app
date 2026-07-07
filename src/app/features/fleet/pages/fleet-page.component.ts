import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  model,
  OnInit,
  signal,
} from '@angular/core';
import { OperationalFleetSyncService } from '@core/services/state/operational-fleet-sync.service';
import { SessionService } from '@core/services/state/session';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { FleetOverviewCardComponent } from '@features/fleet/components/fleet-overview-card/fleet-overview-card.component';
import { FleetEquipmentDetailDrawerComponent } from '@features/fleet/components/fleet-equipment-detail-drawer/fleet-equipment-detail-drawer.component';
import { FleetNewEquipmentDrawerComponent } from '@features/fleet/components/fleet-new-equipment-drawer/fleet-new-equipment-drawer.component';
import { FleetNewUnitDrawerComponent } from '@features/fleet/components/fleet-new-unit-drawer/fleet-new-unit-drawer.component';
import { FleetUnitDetailDrawerComponent } from '@features/fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer.component';
import { FleetFeatureService } from '@features/fleet/services/fleet.service';
import { FleetCatalogFeatureService } from '@features/fleet/services/fleet-catalog.service';
import { FleetOverviewFeatureService } from '@features/fleet/services/fleet-overview.service';
import { UnitsFeatureService } from '@features/fleet/services/units.service';
import { EquipmentFeatureService } from '@features/fleet/services/equipment.service';
import {
  buildOverviewEquipmentOperationalMap,
  buildOverviewUnitOperationalMap,
} from '@features/fleet/utils/fleet-overview-view';
import {
  buildFleetEquipmentTableRow,
  buildFleetUnitTableRow,
  operationalKey,
  operationalKeyEquipment,
} from '@features/fleet/utils/fleet-unit-table-row';
import {
  equipmentAssignedToUnit,
  fleetUnitConvoyTableLabel,
} from '@features/fleet/utils/unit-hitched-equipment';
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import { labelForUnitId } from '@shared/utils/fleet/unit-label';
import type { Equipment } from '@shared/models/logistics.models';
import {
  overviewCardEntryFromDto,
  overviewCardEntryFromEquipmentRow,
  overviewMatchesStatusFilter,
  overviewSortRank,
  attachOverviewCompliance,
  type FleetOverviewCardEntry,
} from '@features/fleet/utils/fleet-overview-view';
import {
  fleetOperationalKeyLabel,
  type FleetOperationalKey,
} from '@features/fleet/utils/fleet-unit-table-row';
import type { Unit } from '@shared/models/logistics.models';
import {
  ToSegmentControlComponent,
  type ToSegmentTab,
} from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
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

@Component({
  selector: 'app-fleet-page',
  standalone: true,
  providers: [
    FleetOverviewFeatureService,
    FleetCatalogFeatureService,
    UnitsFeatureService,
    EquipmentFeatureService,
    FleetFeatureService,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToPageHeaderComponent,
    ToButtonComponent,
    ToIconComponent,
    ToInputComponent,
    ToTableComponent,
    ToSkeletonComponent,
    ToFilterTabsComponent,
    ToSegmentControlComponent,
    FleetNewUnitDrawerComponent,
    FleetNewEquipmentDrawerComponent,
    FleetUnitDetailDrawerComponent,
    FleetEquipmentDetailDrawerComponent,
    FleetOverviewCardComponent,
  ],
  templateUrl: './fleet-page.component.html',
  styleUrl: './fleet-page.component.scss',
})
export class FleetPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly fleet = inject(FleetFeatureService);
  private readonly operationalSync = inject(OperationalFleetSyncService);
  private readonly session = inject(SessionService);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.fleet.dispose();
    });

    let fleetEpochBaseline = this.operationalSync.fleetMutationEpoch();
    effect(() => {
      const epoch = this.operationalSync.fleetMutationEpoch();
      if (epoch === fleetEpochBaseline) {
        return;
      }
      fleetEpochBaseline = epoch;
      this.fleet.refreshFleetModule();
    });
  }

  readonly tab = signal<FleetPageTab>('overview');
  readonly viewSegmentTabs: readonly ToSegmentTab<FleetPageTab>[] = [
    { id: 'overview', label: 'Flota', icon: 'truck', htmlId: 'fleet-tab-overview' },
    { id: 'units', label: 'Unidades', icon: 'unit', htmlId: 'fleet-tab-units' },
    {
      id: 'equipment',
      label: 'Equipo',
      icon: 'equipment',
      htmlId: 'fleet-tab-equipment',
    },
  ];

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

  readonly loadingOverview = this.fleet.loading;
  readonly loadingUnits = this.fleet.loading;
  readonly loadingEquipment = this.fleet.loading;

  readonly unitList = this.fleet.units;
  readonly equipmentList = this.fleet.equipment;
  readonly unitListMutable = computed(() => [...this.unitList()]);
  readonly equipmentListMutable = computed(() => [...this.equipmentList()]);

  ngOnInit(): void {
    this.fleet.loadFleetModule();
  }

  private readonly unitOperationalMap = computed(() =>
    buildOverviewUnitOperationalMap(this.fleet.overviewItems()),
  );

  private readonly equipmentOperationalMap = computed(() =>
    buildOverviewEquipmentOperationalMap(this.fleet.overviewEquipmentRows()),
  );

  readonly newUnitOpen = signal(false);
  readonly newEquipmentOpen = signal(false);
  readonly canWriteFleet = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.FLEET),
  );

  readonly detailUnitOnRoute = signal(false);
  readonly detailEquipmentOnRoute = signal(false);

  readonly detailEquipmentForDrawer = computed(() => this.fleet.selectedEquipment());

  readonly searchQuery = model('');

  readonly displayedUnitRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.unitList();
    const equipment = this.equipmentList();
    const rowOpts = (u: Unit) => {
      const hitched = equipmentAssignedToUnit(equipment, u.id);
      const operational = this.unitOperationalKey(u);
      return {
        onRoute: operational === 'on_route',
        operationalOverride: operational,
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
            fleetUnitConvoyTableLabel(hitched.length),
            u.id,
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
    return list
      .map((e) => {
        const operational = this.equipmentOperationalKey(e);
        return {
          e,
          row: buildFleetEquipmentTableRow(e, {
            onRoute: operational === 'on_route',
            operationalOverride: operational,
          }),
        };
      })
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
          m?.insuranceCarrierName,
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

  readonly overviewUnits = computed((): FleetOverviewCardEntry[] => {
    const status = this.overviewStatusFilter();
    const q = this.searchQuery().trim().toLowerCase();

    const unitEntries = this.fleet
      .overviewItems()
      .map((item) => overviewCardEntryFromDto(item))
      .map((entry) => attachOverviewCompliance(entry, this.unitList(), this.equipmentList()));
    const standaloneEntries = this.fleet
      .overviewEquipmentRows()
      .map((row) => overviewCardEntryFromEquipmentRow(row))
      .filter((entry): entry is FleetOverviewCardEntry => entry != null)
      .map((entry) => attachOverviewCompliance(entry, this.unitList(), this.equipmentList()));

    return [...unitEntries, ...standaloneEntries]
      .filter((entry) => {
        if (!overviewMatchesStatusFilter(entry, status)) {
          return false;
        }
        if (!q) {
          return true;
        }
        const blob = [
          entry.unitName,
          entry.unitPlate,
          entry.convoy.label,
          entry.statusPill.label,
          entry.trip?.maneuverCode,
          entry.trip?.clientName,
          entry.trip?.origin,
          ...entry.hitched.map((e) => e.operationalCode),
          ...entry.hitched.map((e) => e.equipmentType),
        ]
          .filter((x) => x != null && String(x).trim() !== '')
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => {
        const rankDiff = overviewSortRank(b) - overviewSortRank(a);
        if (rankDiff !== 0) {
          return rankDiff;
        }
        return a.unitName.localeCompare(b.unitName, 'es');
      });
  });

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
      key: 'fleetConfigBadges',
      label: 'Configuración',
      cell: 'operation-type-badges',
    },
  ];

  readonly equipmentColumns: ToTableColumn[] = [
    { key: 'fleetBrand', label: 'Marca' },
    { key: 'fleetModel', label: 'Modelo' },
    { key: 'fleetUnitType', label: 'Tipo de equipo' },
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

  onViewTabSelect(tab: FleetPageTab): void {
    this.tab.set(tab);
    this.searchQuery.set('');
  }

  onOverviewStatusFilterSelect(value: FleetOverviewStatusFilter): void {
    this.overviewStatusFilter.set(value);
  }

  onOverviewUnitActivate(entry: FleetOverviewCardEntry): void {
    this.detailUnitOnRoute.set(entry.operational === 'on_route');
    this.fleet.selectUnit(entry.unitId);
  }

  onOverviewEquipmentActivate(equipmentId: number): void {
    this.openOverviewEquipment(equipmentId);
  }

  private openOverviewEquipment(equipmentId: number): void {
    this.detailUnitOnRoute.set(false);
    const e = this.equipmentList().find((x) => x.id === String(equipmentId));
    this.detailEquipmentOnRoute.set(
      e ? this.equipmentOperationalKey(e) === 'on_route' : false,
    );
    this.fleet.selectEquipment(String(equipmentId));
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
    const unit = this.unitList().find((u) => u.id === id);
    this.detailUnitOnRoute.set(
      unit ? this.unitOperationalKey(unit) === 'on_route' : false,
    );
    this.fleet.selectUnit(id);
  }

  onUnitDetailDismiss(): void {
    this.fleet.clearUnitSelection();
    this.detailUnitOnRoute.set(false);
  }

  onUnitDetailViewEquipment(equipment: Equipment): void {
    this.fleet.clearUnitSelection();
    this.detailUnitOnRoute.set(false);
    this.tab.set('equipment');
    this.detailEquipmentOnRoute.set(
      this.equipmentOperationalKey(equipment) === 'on_route',
    );
    this.fleet.selectEquipment(equipment.id);
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
    this.detailEquipmentOnRoute.set(this.equipmentOperationalKey(e) === 'on_route');
    this.fleet.selectEquipment(id);
  }

  onEquipmentDetailDismiss(): void {
    this.fleet.clearEquipmentSelection();
    this.detailEquipmentOnRoute.set(false);
  }

  onEquipmentDetailViewUnit(unit: Unit): void {
    this.fleet.clearEquipmentSelection();
    this.detailEquipmentOnRoute.set(false);
    this.tab.set('units');
    this.detailUnitOnRoute.set(this.unitOperationalKey(unit) === 'on_route');
    this.fleet.selectUnit(unit.id);
  }

  onFleetDataChanged(): void {
    this.fleet.refreshFleetModule();
  }

  private unitOperationalKey(unit: Unit): FleetOperationalKey {
    return this.unitOperationalMap().get(unit.id) ?? operationalKey(unit, false);
  }

  private equipmentOperationalKey(equipment: Equipment): FleetOperationalKey {
    return (
      this.equipmentOperationalMap().get(equipment.id) ??
      operationalKeyEquipment(equipment, false)
    );
  }
}
