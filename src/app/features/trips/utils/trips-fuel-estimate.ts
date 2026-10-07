import type { FuelEstimateRequest } from '@shared/models/api/api-trips-fuel.model';
import type { TripContainerType, TripLoadType } from '@shared/models/logistics.models';
import type { LatLon } from '@shared/services/osrm-driving-route.service';
import { parseNonNegativeNumber } from '@features/trips/utils/parse-non-negative';
import { formatGroupedNumber } from '@shared/utils/format-grouped-number';

/** Mapeo exclusivo para API de combustible (backend diesel). */
export function fuelConfigurationFromMaxEquipment(maxEquipmentCount: number): 'sencillo' | 'full' {
  return maxEquipmentCount >= 2 ? 'full' : 'sencillo';
}

export function formatFuelEstimateLiters(value: number): string {
  return value.toLocaleString('es-MX', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatFuelEstimateMoney(value: number): string {
  return formatGroupedNumber(value, {
    minFractionDigits: 2,
    maxFractionDigits: 2,
  });
}

/** Espera tras el último cambio de km (OSRM u override) antes de llamar fuel-estimate. */
export const FUEL_ESTIMATE_DEBOUNCE_MS = 800;

/**
 * Estimación en backend: distancia operativa (×2) y, si existe,
 * rendimiento aprox. de la unidad (km/L); si no, heurística por configuración/carga/peso.
 */
export function buildFuelEstimateRequest(params: {
  distanceKm: number | null;
  operationType: string;
  maxEquipmentCount?: number;
  loadType: TripLoadType;
  containerType: TripContainerType;
  approximateWeightTons: string;
  originCoords: LatLon | null;
  destinationCoords: LatLon | null;
  unitId?: string;
  unitPerformanceKmL?: number | null;
}): FuelEstimateRequest | null {
  const km = params.distanceKm;
  if (km == null || !Number.isFinite(km) || km <= 0) {
    return null;
  }

  const weight = parseNonNegativeNumber(params.approximateWeightTons) ?? 0;
  const unitIdRaw = params.unitId?.trim() ?? '';
  const unitIdParsed = unitIdRaw ? Number(unitIdRaw) : NaN;
  const unitId =
    unitIdRaw && Number.isFinite(unitIdParsed) && unitIdParsed > 0
      ? unitIdParsed
      : null;
  const perf = params.unitPerformanceKmL;
  const unitPerformanceKmL =
    perf != null && Number.isFinite(perf) && perf > 0 ? perf : null;

  return {
    distanceKm: km,
    configuration: fuelConfigurationFromMaxEquipment(params.maxEquipmentCount ?? 1),
    approximateWeightTons: weight,
    cargoType: params.loadType,
    containerType: params.containerType,
    unitId,
    unitPerformanceKmL,
    originLatitude: params.originCoords?.lat ?? null,
    originLongitude: params.originCoords?.lon ?? null,
    destinationLatitude: params.destinationCoords?.lat ?? null,
    destinationLongitude: params.destinationCoords?.lon ?? null,
  };
}

/** Huella estable de inputs que disparan estimación (evita requests duplicados). */
export function fuelEstimateInputsFingerprint(
  req: FuelEstimateRequest,
): string {
  return JSON.stringify(req);
}
