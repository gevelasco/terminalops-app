export type FleetBrandType = 'UNIT' | 'EQUIPMENT';

export interface FleetBrandVersion {
  id: string;
  name: string;
}

export interface FleetBrand {
  id: string;
  type: FleetBrandType;
  name: string;
  versions: readonly FleetBrandVersion[];
}

export interface FleetCatalogResponseDto {
  brands: FleetBrandDto[];
}

export interface FleetBrandVersionDto {
  id: number;
  name: string;
}

export interface FleetBrandDto {
  id: number;
  type: FleetBrandType;
  name: string;
  versions: FleetBrandVersionDto[];
}
