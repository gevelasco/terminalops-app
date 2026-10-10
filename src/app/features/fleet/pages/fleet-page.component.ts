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
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '@core/notifications/toast.service';
import { OperationalFleetSyncService } from '@core/services/state/operational-fleet-sync.service';
import { SessionService } from '@core/services/state/session';
import { PlanEntitlementService } from '@shared/billing/plan-entitlement.service';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { FleetOverviewCardComponent } from '@features/fleet/components/fleet-overview-card/fleet-overview-card.component';
import { FleetEquipmentDetailDrawerComponent } from '@features/fleet/components/fleet-equipment-detail-drawer/fleet-equipment-detail-drawer.component';
import type { FleetDetailDrawerTab } from '@features/fleet/components/fleet-detail-drawer.types';
import { FleetNewEquipmentDrawerComponent } from '@features/fleet/components/fleet-new-equipment-drawer/fleet-new-equipment-drawer.component';
import { FleetNewUnitDrawerComponent } from '@features/fleet/components/fleet-new-unit-drawer/fleet-new-unit-drawer.component';
import { FleetUnitDetailDrawerComponent } from '@features/fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer.component';
import { FleetFeatureService } from '@features/fleet/services/fleet.service';
import { FleetCatalogFeatureService } from '@features/fleet/services/fleet-catalog.service';
import { FleetInsuranceTableComplianceFeatureService } from '@features/fleet/services/fleet-insurance-table-compliance.service';
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
  fleetOperationalKeyLabel,
  operationalKey,
  operationalKeyEquipment,
  type FleetOperationalKey,
} from '@features/fleet/utils/fleet-unit-table-row';
import {
  equipmentAssignedToUnit,
  fleetUnitConvoyTableLabel,
} from '@features/fleet/utils/unit-hitched-equipment';
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import { labelForUnitId } from '@shared/utils/fleet/unit-label';
import { injectIsMobileViewport } from '@shared/utils/viewport';
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
  buildFleetEquipmentCsv,
  buildFleetUnitsCsv,
  downloadFleetCsv,
} from '@features/fleet/utils/fleet-export-csv';
import {
  fleetEquipmentListExportRowFromTableRow,
  fleetUnitListExportRowFromTableRow,
} from '@features/fleet/utils/fleet-list-export.util';
import {
  FLEET_OVERVIEW_PAGE_SIZE,
  FLEET_TABLE_PAGE_SIZE_OPTIONS,
} from '@shared/utils/list-display-cap';
import type { Unit } from '@shared/models/logistics.models';
import { companyMaintenancePolicyFromSession } from '@shared/models/company-operational-settings.models';
import { resourceIdsEqual } from '@shared/utils/resource-id';
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
    FleetInsuranceTableComplianceFeatureService,
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly fleet = inject(FleetFeatureService);
  private readonly operationalSync = inject(OperationalFleetSyncService);
  private readonly session = inject(SessionService);
  private readonly planEntitlements = inject(PlanEntitlementService);
  private readonly toast = inject(ToastService);
  protected readonly isMobileViewport = injectIsMobileViewport();

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
      const tab = this.tab();
      this.fleet.refreshFleetModule({
        skipExpenses: tab !== 'units' && tab !== 'equipment',
      });
    });

    effect(() => {
      const tab = this.tab();
      untracked(() => this.fleet.ensureTabLoaded(tab));
    });

    effect(() => {
      if (this.overviewDefaultApplied || this.tab() !== 'overview') {
        return;
      }
      if (this.fleet.overviewLoading() || !this.fleet.overviewHydrated()) {
        return;
      }
      this.overviewDefaultApplied = true;
      if (!this.fleet.hasOverviewAssets()) {
        untracked(() => this.tab.set('units'));
      }
    });

    effect(() => {
      if (!this.pendingNewEquipment()) {
        return;
      }
      if (this.fleet.unitsLoading() || !this.fleet.unitsHydrated()) {
        return;
      }
      if (this.fleet.equipmentLoading() || !this.fleet.equipmentHydrated()) {
        return;
      }
      untracked(() => {
        this.pendingNewEquipment.set(false);
        this.tryOpenNewEquipmentDrawer();
      });
    });

    effect(() => {
      if (!this.pendingNewUnit()) {
        return;
      }
      if (this.fleet.unitsLoading() || !this.fleet.unitsHydrated()) {
        return;
      }
      untracked(() => {
        this.pendingNewUnit.set(false);
        this.tryOpenNewUnitDrawer();
      });
    });

    effect(() => {
      this.searchQuery();
      this.overviewStatusFilter();
      this.overviewVisibleCount.set(FLEET_OVERVIEW_PAGE_SIZE);
    });
  }

  private readonly pendingNewEquipment = signal(false);
  private readonly pendingNewUnit = signal(false);
  /** Solo la primera hidratación de overview decide Flota vs Unidades por defecto. */
  private overviewDefaultApplied = false;

  readonly tab = signal<FleetPageTab>(this.resolveInitialTab());
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

  readonly overviewViewLoading = computed(
    () => !this.fleet.overviewHydrated() || this.fleet.overviewLoading(),
  );

  readonly overviewViewEmpty = computed(
    () =>
      this.fleet.overviewHydrated() &&
      !this.fleet.overviewLoading() &&
      !this.fleet.hasOverviewAssets(),
  );

  readonly loadingOverview = this.overviewViewLoading;
  readonly loadingUnits = computed(
    () => !this.fleet.unitsHydrated() || this.fleet.unitsLoading(),
  );
  readonly loadingEquipment = computed(
    () => !this.fleet.equipmentHydrated() || this.fleet.equipmentLoading(),
  );

  readonly unitList = this.fleet.units;
  readonly equipmentList = this.fleet.equipment;

  readonly companyMaintPolicy = computed(() =>
    companyMaintenancePolicyFromSession({
      maintenanceKmControlEnabled: this.planEntitlements.effectiveMaintenanceKmEnabled(),
      maintenanceKmIntervalDefault: this.session.maintenanceKmIntervalDefault(),
      maintenanceDateControlEnabled:
        this.planEntitlements.effectiveMaintenanceDateEnabled(),
      maintenanceDatePeriodDefault: this.session.maintenanceDatePeriodDefault(),
    }),
  );
  readonly unitListMutable = computed(() => [...this.unitList()]);
  readonly equipmentListMutable = computed(() => [...this.equipmentList()]);

  ngOnInit(): void {
    const snap = this.route.snapshot.queryParamMap;
    this.openFleetFromQuery(
      snap.get('unitId'),
      snap.get('equipmentId'),
      snap.get('fleetTab'),
    );
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.openFleetFromQuery(
          params.get('unitId'),
          params.get('equipmentId'),
          params.get('fleetTab'),
        );
      });
  }

  private resolveInitialTab(): FleetPageTab {
    const snap = this.route.snapshot.queryParamMap;
    if (snap.get('unitId')?.trim()) {
      return 'units';
    }
    if (snap.get('equipmentId')?.trim()) {
      return 'equipment';
    }
    return 'overview';
  }

  private openFleetFromQuery(
    unitId: string | null,
    equipmentId: string | null,
    fleetTab: string | null,
  ): void {
    const unit = unitId?.trim();
    const equipment = equipmentId?.trim();
    const tab = fleetTab?.trim();
    if (tab === 'cob' || tab === 'ficha') {
      this.fleet.requestDetailTab(tab as FleetDetailDrawerTab);
    }
    if (unit) {
      this.tab.set('units');
      this.fleet.selectUnit(unit);
    } else if (equipment) {
      this.tab.set('equipment');
      this.fleet.selectEquipment(equipment);
    }
    if (!unit && !equipment) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { unitId: null, equipmentId: null, fleetTab: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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

  /** Tablas unidades/equipo: mismo patrón que maniobras/gastos. */
  readonly tablePageSize = model(15);
  readonly tablePageSizeOptions = FLEET_TABLE_PAGE_SIZE_OPTIONS;

  /**
   * Overview: no renderiza cientos de tarjetas de golpe.
   * Se reinicia al cambiar búsqueda o filtro de estado.
   */
  readonly overviewVisibleCount = signal(FLEET_OVERVIEW_PAGE_SIZE);

  readonly tableExportDisabled = computed(() => {
    const tab = this.tab();
    if (tab === 'units') {
      return this.loadingUnits();
    }
    if (tab === 'equipment') {
      return this.loadingEquipment();
    }
    return true;
  });

  readonly displayedUnitRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.unitList();
    const equipment = this.equipmentList();
    const insuranceTable = this.fleet.insuranceTableCompliance();
    const rowOpts = (u: Unit) => {
      const hitched = u.hitchedEquipment ?? equipmentAssignedToUnit(equipment, u.id);
      const operational = this.unitOperationalKey(u);
      return {
        onRoute: operational === 'on_route',
        operationalOverride: operational,
        hitchedEquipment: hitched,
        insuranceCompliance: insuranceTable.units[u.id],
        policy: this.companyMaintPolicy(),
      };
    };
    const filtered = q
      ? list.filter((u) => {
          const hitched = u.hitchedEquipment ?? equipmentAssignedToUnit(equipment, u.id);
          const row = buildFleetUnitTableRow(u, rowOpts(u));
          const blob = [
            row['fleetBrand'],
            row['fleetModel'],
            row['fleetPlate'],
            fleetUnitConvoyTableLabel(hitched.length, u.transportType),
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
    const insuranceTable = this.fleet.insuranceTableCompliance();
    return list
      .map((e) => {
        const operational = this.equipmentOperationalKey(e);
        const tractor = units.find((u) => resourceIdsEqual(u.id, e.unitId));
        return {
          e,
          row: buildFleetEquipmentTableRow(e, {
            onRoute: operational === 'on_route',
            operationalOverride: operational,
            insuranceCompliance: insuranceTable.equipment[e.id],
            policy: this.companyMaintPolicy(),
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
      .map((entry) =>
        attachOverviewCompliance(
          entry,
          this.unitList(),
          this.equipmentList(),
          this.fleet.insuranceTableCompliance(),
        ),
      );
    const standaloneEntries = this.fleet
      .overviewEquipmentRows()
      .map((row) => overviewCardEntryFromEquipmentRow(row))
      .filter((entry): entry is FleetOverviewCardEntry => entry != null)
      .map((entry) =>
        attachOverviewCompliance(
          entry,
          this.unitList(),
          this.equipmentList(),
          this.fleet.insuranceTableCompliance(),
        ),
      );

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
          entry.trip?.origin?.trim() || '',
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

  readonly displayedOverviewUnits = computed(() =>
    this.overviewUnits().slice(0, this.overviewVisibleCount()),
  );

  readonly overviewHasMore = computed(
    () => this.overviewUnits().length > this.overviewVisibleCount(),
  );

  readonly overviewRemainingCount = computed(() =>
    Math.max(0, this.overviewUnits().length - this.overviewVisibleCount()),
  );

  showMoreOverviewUnits(): void {
    this.overviewVisibleCount.update((n) => n + FLEET_OVERVIEW_PAGE_SIZE);
  }

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
    this.detailEquipmentOnRoute.set(
      this.equipmentOperationalMap().get(String(equipmentId)) === 'on_route',
    );
    this.fleet.selectEquipment(String(equipmentId));
  }

  openNewUnit(): void {
    this.fleet.ensureUnitsLoaded();
    if (this.fleet.unitsLoading() || !this.fleet.unitsHydrated()) {
      this.pendingNewUnit.set(true);
      return;
    }
    this.tryOpenNewUnitDrawer();
  }

  private tryOpenNewUnitDrawer(): void {
    if (!this.planEntitlements.canAddUnit(this.unitList().length)) {
      this.toast.show(this.planEntitlements.unitLimitMessage(), 'warning');
      return;
    }
    this.newUnitOpen.set(true);
  }

  openNewEquipment(): void {
    this.fleet.ensureUnitsLoaded();
    this.fleet.ensureEquipmentLoaded();
    if (
      this.fleet.unitsLoading() ||
      !this.fleet.unitsHydrated() ||
      this.fleet.equipmentLoading() ||
      !this.fleet.equipmentHydrated()
    ) {
      this.pendingNewEquipment.set(true);
      return;
    }
    this.tryOpenNewEquipmentDrawer();
  }

  private tryOpenNewEquipmentDrawer(): void {
    if (this.unitList().length === 0) {
      return;
    }
    if (!this.planEntitlements.canAddEquipment(this.equipmentList().length)) {
      this.toast.show(this.planEntitlements.equipmentLimitMessage(), 'warning');
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
    this.fleet.clearPendingDetailTab();
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
    this.fleet.clearPendingDetailTab();
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
    const tab = this.tab();
    this.fleet.refreshFleetModule({
      skipExpenses: tab !== 'units' && tab !== 'equipment',
    });
  }

  exportCurrentTable(): void {
    if (this.tab() === 'units') {
      this.exportUnits();
      return;
    }
    if (this.tab() === 'equipment') {
      this.exportEquipment();
    }
  }

  private exportUnits(): void {
    const rows = this.displayedUnitRows();
    if (rows.length === 0) {
      this.toast.show(
        'No hay unidades para exportar con los filtros actuales.',
        'warning',
      );
      return;
    }
    const csv = buildFleetUnitsCsv(
      rows.map((row) => fleetUnitListExportRowFromTableRow(row)),
    );
    downloadFleetCsv(csv, 'unidades.csv');
    this.toast.show(`Exportadas ${rows.length} unidades.`, 'success');
  }

  private exportEquipment(): void {
    const rows = this.displayedEquipmentRows();
    if (rows.length === 0) {
      this.toast.show(
        'No hay equipo para exportar con los filtros actuales.',
        'warning',
      );
      return;
    }
    const csv = buildFleetEquipmentCsv(
      rows.map((row) => fleetEquipmentListExportRowFromTableRow(row)),
    );
    downloadFleetCsv(csv, 'equipo.csv');
    this.toast.show(`Exportados ${rows.length} equipos.`, 'success');
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
