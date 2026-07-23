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

/**
 * Nota: la estimación del backend es heurística (distancia, configuración,
 * tipo de carga y peso); la unidad/equipos seleccionados no alteran el cálculo,
 * por eso no forman parte de la petición ni disparan re-estimaciones.
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
}): FuelEstimateRequest | null {
  const km = params.distanceKm;
  if (km == null || !Number.isFinite(km) || km <= 0) {
    return null;
  }

  // Sin datos de carga completos la estimación sería especulativa: no estimar
  // hasta tener configuración, tipo de contenedor, tipo de carga y peso.
  if (
    !params.operationType.trim() ||
    !String(params.loadType).trim() ||
    !String(params.containerType).trim()
  ) {
    return null;
  }
  const weight = parseNonNegativeNumber(params.approximateWeightTons);
  if (weight == null) {
    return null;
  }

  return {
    distanceKm: km,
    configuration: fuelConfigurationFromMaxEquipment(params.maxEquipmentCount ?? 1),
    approximateWeightTons: weight,
    cargoType: params.loadType,
    containerType: params.containerType,
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
