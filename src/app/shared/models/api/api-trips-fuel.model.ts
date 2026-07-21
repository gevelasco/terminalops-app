/** POST /companies/{companyId}/trips/fuel-estimate */
export interface FuelEstimateRequest {
  distanceKm: number;
  configuration: 'sencillo' | 'full';
  approximateWeightTons: number;
  cargoType: string | null;
  containerType: string | null;
  unitId?: number | null;
  equipment1Id?: number | null;
  equipment2Id?: number | null;
  originLatitude?: number | null;
  originLongitude?: number | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
}

export interface FuelEstimateAdjustments {
  weightFactor: number;
  configurationFactor: number;
  routeFactor: number;
  roundTripFactor: number;
  effectiveDistanceKm: number;
}

export interface FuelEstimateResponse {
  routeDistanceKm: number;
  operationalDistanceKm: number;
  estimatedLiters: number;
  estimatedKmPerLiter: number;
  estimatedDieselCost: number;
  dieselPricePerLiter: number;
  calculationProfile: string;
  adjustments: FuelEstimateAdjustments;
}
