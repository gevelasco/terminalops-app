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
import { formatEquipmentOperationalId } from '@app/sim-db/utils/fleet-id-builders';
import {
  formatUnitTrailerOperationalId,
  labelForUnitId,
} from '@app/sim-db/utils/unit-label';
import { FleetEquipmentDetailDrawerComponent } from '@features/fleet/components/fleet-equipment-detail-drawer/fleet-equipment-detail-drawer.component';
import { FleetNewEquipmentDrawerComponent } from '@features/fleet/components/fleet-new-equipment-drawer/fleet-new-equipment-drawer.component';
import { FleetNewUnitDrawerComponent } from '@features/fleet/components/fleet-new-unit-drawer/fleet-new-unit-drawer.component';
import { FleetUnitDetailDrawerComponent } from '@features/fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer.component';
import { EquipmentRepository } from '@features/fleet/data/equipment.repository';
import { UnitRepository } from '@features/fleet/data/unit.repository';
import {
  buildFleetEquipmentTableRow,
  buildFleetUnitTableRow,
} from '@features/fleet/utils/fleet-unit-table-row';
import { buildUnitCompletedTripStats } from '@features/fleet/utils/unit-completed-trip-stats';
import {
  equipmentAssignedToUnit,
  unitConvoyFromEquipment,
} from '@features/fleet/utils/unit-hitched-equipment';
import { tripOperationTypeBadgeLabel } from '@shared/utils/trip-operation-type-badge';
import { ManiobraRepository } from '@features/maniobra/data/maniobra.repository';
import { Equipment, Trip, Unit } from '@shared/models/logistics.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

type FleetListBundle = {
  trips: Trip[];
  units: Unit[];
  equipment: Equipment[];
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
    FleetNewUnitDrawerComponent,
    FleetNewEquipmentDrawerComponent,
    FleetUnitDetailDrawerComponent,
    FleetEquipmentDetailDrawerComponent,
  ],
  templateUrl: './fleet-page.component.html',
  styleUrl: './fleet-page.component.scss',
})
export class FleetPageComponent {
  private readonly unitsRepo = inject(UnitRepository);
  private readonly equipmentRepo = inject(EquipmentRepository);
  private readonly maniobrasRepo = inject(ManiobraRepository);

  private readonly fleetResource = resource({
    loader: async (): Promise<FleetListBundle> => {
      const [trips, units, equipment] = await Promise.all([
        firstValueFrom(
          this.maniobrasRepo.list().pipe(catchError(() => of([] as Trip[]))),
        ),
        firstValueFrom(
          this.unitsRepo.list().pipe(catchError(() => of([] as Unit[]))),
        ),
        firstValueFrom(
          this.equipmentRepo
            .list()
            .pipe(catchError(() => of([] as Equipment[]))),
        ),
      ]);
      return { trips, units, equipment };
    },
  });

  readonly tab = signal<'units' | 'equipment'>('units');

  readonly loadingUnits = computed(
    () => !this.fleetResource.hasValue() && this.fleetResource.isLoading(),
  );
  readonly loadingEquipment = this.loadingUnits;

  readonly unitList = computed(
    () => this.fleetResource.value()?.units ?? [],
  );
  readonly equipmentList = computed(
    () => this.fleetResource.value()?.equipment ?? [],
  );
  readonly tripsList = computed(
    () => this.fleetResource.value()?.trips ?? [],
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
        ids.add(t.unitId);
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
          labelForUnitId(String(e.unitId), units),
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

  showUnits(): void {
    this.tab.set('units');
    this.searchQuery.set('');
  }

  showEquipment(): void {
    this.tab.set('equipment');
    this.searchQuery.set('');
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

  onUnitDetailViewEquipment(e: Equipment): void {
    this.detailUnit.set(null);
    this.detailUnitOnRoute.set(false);
    this.tab.set('equipment');
    this.detailEquipmentOnRoute.set(
      Boolean(e.unitId?.trim()) &&
        this.unitsInTransitIds().has(e.unitId.trim()),
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
    this.detailEquipmentOnRoute.set(
      Boolean(e.unitId?.trim()) &&
        this.unitsInTransitIds().has(e.unitId.trim()),
    );
    this.detailEquipment.set(e);
  }

  onEquipmentDetailDismiss(): void {
    this.detailEquipment.set(null);
    this.detailEquipmentOnRoute.set(false);
  }
}
