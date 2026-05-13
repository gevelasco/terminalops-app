import { Component, computed, inject, model, signal } from '@angular/core';
import { formatUnitTrailerLabel, labelForUnitId } from '@app/mock-data/mock-units';
import { FleetEquipmentDetailDrawerComponent } from '@features/fleet/components/fleet-equipment-detail-drawer/fleet-equipment-detail-drawer.component';
import { FleetNewEquipmentDrawerComponent } from '@features/fleet/components/fleet-new-equipment-drawer/fleet-new-equipment-drawer.component';
import { FleetNewUnitDrawerComponent } from '@features/fleet/components/fleet-new-unit-drawer/fleet-new-unit-drawer.component';
import { FleetUnitDetailDrawerComponent } from '@features/fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer.component';
import { EquipmentRepository } from '@features/fleet/data/equipment.repository';
import { UnitRepository } from '@features/fleet/data/unit.repository';
import { buildFleetUnitTableRow } from '@features/fleet/utils/fleet-unit-table-row';
import { ManiobraRepository } from '@features/maniobra/data/maniobra.repository';
import { Equipment, Trip, Unit } from '@shared/models/logistics.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import { ToTableColumn, ToTableComponent } from '@shared/ui/to-table/to-table.component';

@Component({
  selector: 'app-fleet-page',
  standalone: true,
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

  readonly tab = signal<'units' | 'equipment'>('units');

  readonly loadingUnits = signal(true);
  readonly loadingEquipment = signal(true);

  readonly unitList = signal<Unit[]>([]);
  readonly equipmentList = signal<Equipment[]>([]);
  /** Para cruzar unidades con maniobras `in_transit` (estado operativo «En ruta»). */
  readonly tripsList = signal<Trip[]>([]);

  readonly newUnitOpen = signal(false);
  readonly newEquipmentOpen = signal(false);

  readonly detailUnit = signal<Unit | null>(null);
  readonly detailUnitOnRoute = signal(false);
  readonly detailEquipment = signal<Equipment | null>(null);

  /** Texto de filtro para la tabla de la pestaña activa. */
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
    const filtered = q
      ? list.filter((u) => {
          const row = buildFleetUnitTableRow(u, { onRoute: onSet.has(u.id) });
          const blob = [
            row['fleetBrand'],
            row['fleetModel'],
            row['fleetPlate'],
            u.id,
            u.type,
            u.status,
            String(u.capacityKg ?? ''),
          ]
            .filter((x) => x != null && String(x).trim() !== '')
            .join(' ')
            .toLowerCase();
          return blob.includes(q);
        })
      : list;
    return filtered.map((u) =>
      buildFleetUnitTableRow(u, { onRoute: onSet.has(u.id) }),
    );
  });

  readonly displayedEquipmentRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.equipmentList();
    const filtered = q
      ? list.filter((e) => {
          const unitLabel = labelForUnitId(String(e.unitId));
          const blob = [
            e.id,
            e.unitId,
            unitLabel,
            e.name,
            e.serialNumber,
            e.lastServiceDate,
            e.axleConfiguration,
          ]
            .join(' ')
            .toLowerCase();
          return blob.includes(q);
        })
      : list;
    return filtered.map(
      (r) =>
        ({
          ...r,
          unitLabel: labelForUnitId(String(r.unitId)),
        }) as Record<string, unknown>,
    );
  });

  readonly unitSelectOptions = computed(() =>
    this.unitList().map((u) => ({
      value: u.id,
      label: formatUnitTrailerLabel(u),
    })),
  );

  readonly unitColumns: ToTableColumn[] = [
    { key: 'fleetBrand', label: 'Marca' },
    { key: 'fleetModel', label: 'Modelo' },
    { key: 'fleetPlate', label: 'Placa' },
    { key: 'fleetOperational', label: 'Estado operativo', cell: 'fleet-op-pill' },
    { key: 'fleetMaint', label: 'Mantenimiento', cell: 'fleet-maintenance-icon' },
    { key: 'fleetVerif', label: 'Verificaciones', cell: 'fleet-verification-icon' },
    { key: 'fleetIns', label: 'Seguro', cell: 'fleet-insurance-icon' },
  ];

  readonly equipmentColumns: ToTableColumn[] = [
    { key: 'unitLabel', label: 'Unidad' },
    { key: 'name', label: 'Equipo' },
    { key: 'serialNumber', label: 'Serie' },
    { key: 'axleConfiguration', label: 'Ejes' },
    { key: 'lastServiceDate', label: 'Último servicio' },
  ];

  constructor() {
    this.loadUnits();
    this.loadEquipment();
    this.maniobrasRepo.list().subscribe({
      next: (rows) => this.tripsList.set(rows),
      error: () => this.tripsList.set([]),
    });
  }

  loadUnits(): void {
    this.loadingUnits.set(true);
    this.unitsRepo.list().subscribe({
      next: (rows) => {
        this.unitList.set(rows);
        this.loadingUnits.set(false);
      },
      error: () => this.loadingUnits.set(false),
    });
  }

  loadEquipment(): void {
    this.loadingEquipment.set(true);
    this.equipmentRepo.list().subscribe({
      next: (rows) => {
        this.equipmentList.set(rows);
        this.loadingEquipment.set(false);
      },
      error: () => this.loadingEquipment.set(false),
    });
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

  onEquipmentRowClick(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    if (!id) {
      return;
    }
    const e = this.equipmentList().find((x) => x.id === id);
    if (!e) {
      return;
    }
    this.detailEquipment.set(e);
  }

  onEquipmentDetailDismiss(): void {
    this.detailEquipment.set(null);
  }
}
