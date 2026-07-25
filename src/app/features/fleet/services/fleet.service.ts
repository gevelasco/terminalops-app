import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { FleetDetailDrawerTab } from '@features/fleet/components/fleet-detail-drawer.types';
import { EquipmentFeatureService } from './equipment.service';
import { FleetCatalogFeatureService } from './fleet-catalog.service';
import { FleetOverviewFeatureService } from './fleet-overview.service';
import { UnitsFeatureService } from './units.service';
import type { FleetBrandType } from '@shared/models/api/fleet-catalog.model';

/**
 * Orquestador del módulo Flota: unidades + equipo al entrar;
 * overview solo si hay activos que mostrar.
 * El catálogo de marcas/versiones se carga al abrir un side drawer que lo usa.
 */
@Injectable()
export class FleetFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly overviewFeature = inject(FleetOverviewFeatureService);
  private readonly catalogFeature = inject(FleetCatalogFeatureService);
  private readonly unitsFeature = inject(UnitsFeatureService);
  private readonly equipmentFeature = inject(EquipmentFeatureService);

  private moduleLoadStarted = false;
  private disposed = false;
  private readonly _pendingDetailTab = signal<FleetDetailDrawerTab | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly listsLoading = computed(
    () => this.unitsFeature.loading() || this.equipmentFeature.loading(),
  );

  readonly listsHydrated = computed(
    () => this.unitsFeature.hydrated() && this.equipmentFeature.hydrated(),
  );

  readonly hasFleetAssets = computed(
    () => this.unitsFeature.units().length > 0 || this.equipmentFeature.equipment().length > 0,
  );

  readonly loading = computed(
    () =>
      this.listsLoading() ||
      (this.hasFleetAssets() && this.overviewFeature.loading()),
  );

  readonly overviewLoading = this.overviewFeature.loading;

  readonly catalogLoading = this.catalogFeature.loading;

  readonly overview = this.overviewFeature.overview;
  readonly overviewItems = this.overviewFeature.items;
  readonly overviewEquipmentRows = this.overviewFeature.equipmentRows;

  readonly brands = this.catalogFeature.brands;
  readonly unitBrands = this.catalogFeature.unitBrands;
  readonly equipmentBrands = this.catalogFeature.equipmentBrands;
  readonly unitBrandNames = this.catalogFeature.unitBrandNames;
  readonly equipmentBrandNames = this.catalogFeature.equipmentBrandNames;

  readonly units = this.unitsFeature.units;
  readonly equipment = this.equipmentFeature.equipment;
  readonly selectedUnit = this.unitsFeature.selectedUnit;
  readonly selectedEquipment = this.equipmentFeature.selectedEquipment;
  readonly pendingDetailTab = this._pendingDetailTab.asReadonly();

  /** Unidades + equipo (una vez). Overview bajo demanda si hay flota. */
  loadFleetModule(): void {
    if (this.disposed || this.moduleLoadStarted) {
      return;
    }
    this.moduleLoadStarted = true;
    this.unitsFeature.loadUnits();
    this.equipmentFeature.loadEquipment();
  }

  /** GET /fleet/overview solo cuando hay unidades o equipo. */
  ensureOverviewLoaded(): void {
    if (this.disposed) {
      return;
    }
    if (!this.hasFleetAssets()) {
      this.overviewFeature.clearIdle();
      return;
    }
    this.overviewFeature.loadOverview();
  }

  clearOverviewIdle(): void {
    if (this.disposed) {
      return;
    }
    this.overviewFeature.clearIdle();
  }

  /** GET /fleet/catalog — solo al abrir drawer de alta/edición con marcas. */
  ensureFleetCatalogLoaded(): void {
    if (this.disposed) {
      return;
    }
    this.catalogFeature.ensureCatalogLoaded();
  }

  versionNamesFor(type: FleetBrandType, brandName: string): readonly string[] {
    return this.catalogFeature.versionNamesFor(type, brandName);
  }

  registerLocalCatalogEntry(
    type: FleetBrandType,
    brandName: string,
    versionName?: string,
  ): void {
    if (this.disposed) {
      return;
    }
    this.catalogFeature.registerLocalCatalogEntry(type, brandName, versionName);
  }

  refreshFleetModule(): void {
    if (this.disposed) {
      return;
    }
    this.unitsFeature.refreshUnits();
    this.equipmentFeature.refreshEquipment();
    if (this.overviewFeature.hasLoadedOnce()) {
      this.overviewFeature.refreshOverview();
    } else if (this.hasFleetAssets()) {
      this.overviewFeature.loadOverview();
    }
  }

  requestDetailTab(tab: FleetDetailDrawerTab): void {
    this._pendingDetailTab.set(tab);
  }

  clearPendingDetailTab(): void {
    this._pendingDetailTab.set(null);
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

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.moduleLoadStarted = false;
    this.overviewFeature.dispose();
    this.catalogFeature.dispose();
    this.unitsFeature.dispose();
    this.equipmentFeature.dispose();
  }
}
