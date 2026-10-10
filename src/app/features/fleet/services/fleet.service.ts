import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { FleetDetailDrawerTab } from '@features/fleet/components/fleet-detail-drawer.types';
import { EquipmentFeatureService } from './equipment.service';
import { FleetCatalogFeatureService } from './fleet-catalog.service';
import { FleetCoverageExpensesFeatureService } from './fleet-coverage-expenses.service';
import { FleetOverviewFeatureService } from './fleet-overview.service';
import { UnitsFeatureService } from './units.service';
import type { FleetBrandType } from '@shared/models/api/fleet-catalog.model';

export type FleetModuleTab = 'overview' | 'units' | 'equipment';

/**
 * Orquestador del módulo Flota: cada tab carga su recurso
 * (`/overview`, `/units`, `/equipment`). El drawer de detalle pide GET por id.
 * El catálogo de marcas/versiones se carga al abrir un side drawer que lo usa.
 */
@Injectable()
export class FleetFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly overviewFeature = inject(FleetOverviewFeatureService);
  private readonly catalogFeature = inject(FleetCatalogFeatureService);
  private readonly unitsFeature = inject(UnitsFeatureService);
  private readonly equipmentFeature = inject(EquipmentFeatureService);
  private readonly coverageExpensesFeature = inject(FleetCoverageExpensesFeatureService);

  private disposed = false;
  private readonly _pendingDetailTab = signal<FleetDetailDrawerTab | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly unitsLoading = this.unitsFeature.loading;
  readonly unitsHydrated = this.unitsFeature.hydrated;
  readonly equipmentLoading = this.equipmentFeature.loading;
  readonly equipmentHydrated = this.equipmentFeature.hydrated;
  readonly overviewHydrated = this.overviewFeature.hydrated;
  readonly overviewLoading = this.overviewFeature.loading;

  readonly hasOverviewAssets = computed(
    () =>
      this.overviewFeature.items().length > 0 ||
      this.overviewFeature.equipmentRows().length > 0,
  );

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
  readonly coverageExpenses = this.coverageExpensesFeature.expenses;
  readonly selectedUnit = this.unitsFeature.selectedUnit;
  readonly selectedEquipment = this.equipmentFeature.selectedEquipment;
  readonly pendingDetailTab = this._pendingDetailTab.asReadonly();

  /**
   * Carga solo el recurso de la tab activa.
   * Overview = GET /fleet/overview. Unidades/equipo = su listado.
   * Gastos de seguro: solo tablas Unidades/Equipo (icono de póliza desde el ledger).
   * El drawer de cobertura pide gastos por activo; no hace falta el listado global al entrar.
   */
  ensureTabLoaded(tab: FleetModuleTab): void {
    if (this.disposed) {
      return;
    }
    if (tab === 'overview') {
      this.overviewFeature.loadOverview();
      return;
    }
    if (tab === 'units') {
      this.unitsFeature.loadUnits();
      this.coverageExpensesFeature.loadExpenses();
      return;
    }
    this.equipmentFeature.loadEquipment();
    this.coverageExpensesFeature.loadExpenses();
  }

  ensureUnitsLoaded(): void {
    if (this.disposed) {
      return;
    }
    this.unitsFeature.loadUnits();
  }

  ensureEquipmentLoaded(): void {
    if (this.disposed) {
      return;
    }
    this.equipmentFeature.loadEquipment();
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

  refreshFleetModule(options?: { skipUnits?: boolean; skipEquipment?: boolean }): void {
    if (this.disposed) {
      return;
    }
    if (!options?.skipUnits && this.unitsFeature.hasLoadedOnce()) {
      this.unitsFeature.refreshUnits();
    }
    if (!options?.skipEquipment && this.equipmentFeature.hasLoadedOnce()) {
      this.equipmentFeature.refreshEquipment();
    }
    if (this.overviewFeature.hasLoadedOnce()) {
      this.overviewFeature.refreshOverview();
    }
    if (this.coverageExpensesFeature.hasLoadedOnce()) {
      this.coverageExpensesFeature.refreshExpenses();
    }
  }

  refreshCoverageExpenses(): void {
    if (this.disposed) {
      return;
    }
    this.coverageExpensesFeature.refreshExpenses();
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
    // Overview / deep links: enganches viven en catálogo de equipos, no solo en GET unidad.
    this.equipmentFeature.loadEquipment();
    this.unitsFeature.loadUnits();
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
    this.overviewFeature.dispose();
    this.catalogFeature.dispose();
    this.unitsFeature.dispose();
    this.equipmentFeature.dispose();
    this.coverageExpensesFeature.dispose();
  }
}
