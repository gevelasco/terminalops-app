import { DestroyRef, Injectable, computed, inject } from '@angular/core';
import { EquipmentFeatureService } from './equipment.service';
import { UnitsFeatureService } from './units.service';

/**
 * Orquestador del módulo Flota: sin estado propio ni copias de listas.
 * Delega en UnitsFeatureService y EquipmentFeatureService.
 */
@Injectable()
export class FleetFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly unitsFeature = inject(UnitsFeatureService);
  private readonly equipmentFeature = inject(EquipmentFeatureService);

  private moduleLoadStarted = false;
  private disposed = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly loading = computed(
    () => this.unitsFeature.loading() || this.equipmentFeature.loading(),
  );

  readonly units = this.unitsFeature.units;
  readonly equipment = this.equipmentFeature.equipment;
  readonly selectedUnit = this.unitsFeature.selectedUnit;
  readonly selectedEquipment = this.equipmentFeature.selectedEquipment;

  /** Dispara ambos listados una sola vez al entrar al módulo (2 requests en paralelo, sin duplicar). */
  loadFleetModule(): void {
    if (this.disposed || this.moduleLoadStarted) {
      return;
    }
    this.moduleLoadStarted = true;
    this.unitsFeature.loadUnits();
    this.equipmentFeature.loadEquipment();
  }

  selectUnit(unitId: string): void {
    this.equipmentFeature.clearSelection();
    this.unitsFeature.selectUnit(unitId);
  }

  selectEquipment(equipmentId: string): void {
    this.unitsFeature.clearSelection();
    this.equipmentFeature.selectEquipment(equipmentId);
  }

  clearUnitSelection(): void {
    this.unitsFeature.clearSelection();
  }

  clearEquipmentSelection(): void {
    this.equipmentFeature.clearSelection();
  }

  /** Destrucción terminal al salir del feature (no reutilizar instancia). */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.moduleLoadStarted = false;
    this.unitsFeature.dispose();
    this.equipmentFeature.dispose();
  }
}
