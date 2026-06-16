import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { FleetApiService } from '@core/services/api/fleet';
import type {
  FleetBrand,
  FleetBrandDto,
  FleetBrandType,
  FleetBrandVersionDto,
} from '@shared/models/api/fleet-catalog.model';
import {
  fleetCatalogNamesMatch,
  fleetVersionNamesForBrand,
} from '@shared/utils/fleet/fleet-catalog-version-names';
import { fleetBrandNamesMatch } from '@shared/utils/fleet/fleet-brand-normalize';
import { createRequestGeneration } from '@shared/utils/request-generation';
import { finalize, tap, type Subscription } from 'rxjs';

function mapVersionDto(row: FleetBrandVersionDto) {
  return {
    id: String(row.id),
    name: row.name,
  };
}

function mapBrandDto(row: FleetBrandDto): FleetBrand {
  return {
    id: String(row.id),
    type: row.type,
    name: row.name,
    versions: (row.versions ?? []).map(mapVersionDto),
  };
}

/**
 * Catálogo de marcas y versiones de Flota en memoria.
 * GET /companies/{companyId}/fleet/catalog — al abrir drawer de alta/edición.
 */
@Injectable()
export class FleetCatalogFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(FleetApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _brands = signal<readonly FleetBrand[]>([]);
  private readonly _loading = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;

  readonly brands = this._brands.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly unitBrands = computed(() =>
    this._brands().filter((b) => b.type === 'UNIT'),
  );

  readonly equipmentBrands = computed(() =>
    this._brands().filter((b) => b.type === 'EQUIPMENT'),
  );

  readonly unitBrandNames = computed(() => this.unitBrands().map((b) => b.name));

  readonly equipmentBrandNames = computed(() =>
    this.equipmentBrands().map((b) => b.name),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  /** Carga bajo demanda; idempotente mientras el usuario permanezca en `/fleet`. */
  ensureCatalogLoaded(): void {
    if (this.disposed || this.initialLoadStarted || this._loading()) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  versionNamesFor(type: FleetBrandType, brandName: string): readonly string[] {
    return fleetVersionNamesForBrand(this._brands(), type, brandName);
  }

  refreshCatalog(): void {
    if (this.disposed) {
      return;
    }
    this.runFetch();
  }

  /** Añade marca y/o versión al estado local tras guardar (sin recargar el módulo). */
  registerLocalCatalogEntry(
    type: FleetBrandType,
    brandName: string,
    versionName?: string,
  ): void {
    const brandTrimmed = brandName.trim();
    if (!brandTrimmed) {
      return;
    }
    const versionTrimmed = versionName?.trim();
    const list = this._brands();
    const existingIdx = list.findIndex(
      (b) => b.type === type && fleetBrandNamesMatch(b.name, brandTrimmed),
    );

    if (existingIdx < 0) {
      const versions = versionTrimmed
        ? [{ id: `local-v-${Date.now()}`, name: versionTrimmed }]
        : [];
      this._brands.set([
        ...list,
        {
          id: `local-b-${type}-${Date.now()}`,
          type,
          name: brandTrimmed,
          versions,
        },
      ]);
      return;
    }

    if (!versionTrimmed) {
      return;
    }

    const brand = list[existingIdx];
    if (brand.versions.some((v) => fleetCatalogNamesMatch(v.name, versionTrimmed))) {
      return;
    }

    const next = [...list];
    next[existingIdx] = {
      ...brand,
      versions: [
        ...brand.versions,
        { id: `local-v-${Date.now()}`, name: versionTrimmed },
      ],
    };
    this._brands.set(next);
  }

  dispose(): void {
    this.disposed = true;
    this.initialLoadStarted = false;
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._brands.set([]);
    this._loading.set(false);
    this.requestGen.invalidate();
  }

  private runFetch(): void {
    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    this._loading.set(true);
    this.fetchSub = this.api
      .getFleetCatalog()
      .pipe(
        tap((res) => {
          if (this.requestGen.isCurrent(requestId)) {
            this._brands.set((res.brands ?? []).map(mapBrandDto));
          }
        }),
        finalize(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._loading.set(false);
          }
        }),
      )
      .subscribe();
  }
}
