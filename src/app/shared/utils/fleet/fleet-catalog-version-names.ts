import type { FleetBrand, FleetBrandType } from '@shared/models/api/fleet-catalog.model';
import { fleetBrandNamesMatch } from '@shared/utils/fleet/fleet-brand-normalize';

export function fleetVersionNamesForBrand(
  brands: readonly FleetBrand[],
  type: FleetBrandType,
  brandName: string,
): readonly string[] {
  const key = brandName.trim();
  if (!key) {
    return [];
  }
  const brand = brands.find(
    (b) => b.type === type && fleetBrandNamesMatch(b.name, key),
  );
  return brand?.versions.map((v) => v.name) ?? [];
}

export function fleetCatalogNamesMatch(a: string, b: string): boolean {
  return fleetBrandNamesMatch(a, b);
}
