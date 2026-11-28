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

export function parseUnitPerformanceKmL(raw: unknown): number | null {
  if (raw == null || raw === '') {
    return null;
  }
  const perf =
    typeof raw === 'number' ? raw : Number(String(raw).trim().replace(/,/g, '.'));
  if (Number.isFinite(perf) && perf > 0) {
    return perf;
  }
  return null;
}

/** Motivo por el que no se puede llamar fuel-estimate (UX / depuración). */
export function fuelEstimateBlockReason(params: {
  distanceKm: number | null;
  approximateWeightTons: string;
  unitId?: string;
  unitPerformanceKmL?: number | null;
}): string | null {
  const km = params.distanceKm;
  if (km == null || !Number.isFinite(km) || km <= 0) {
    return 'Captura la distancia de ruta (ida) en km.';
  }
  const weight = parseNonNegativeNumber(params.approximateWeightTons?.trim() ?? '');
  if (weight == null || weight <= 0) {
    return 'Captura el peso aproximado en toneladas.';
  }
  if (!params.unitId?.trim()) {
    return 'Selecciona una unidad.';
  }
  const perf = params.unitPerformanceKmL;
  if (perf == null || !Number.isFinite(perf) || perf <= 0) {
    return 'La unidad asignada debe tener rendimiento aprox. (km/L) en Flota.';
  }
  return null;
}

/** Id numérico de API cuando el id de unidad es dígitos; si no, se omite en el POST. */
function parseOptionalFuelEstimateUnitId(raw: string): number | undefined {
  const id = raw.trim();
  if (!id || !/^\d+$/.test(id)) {
    return undefined;
  }
  const n = Number.parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Estimación en backend solo con datos completos: km de ida, unidad asignada con rendimiento
 * (km/L) y peso capturado. El cálculo usa `unitPerformanceKmL`; `unitId` en el body es opcional.
 * El API aplica ida cargada + regreso vacío (tara 3.5 t).
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

  const weightRaw = params.approximateWeightTons?.trim() ?? '';
  if (!weightRaw) {
    return null;
  }
  const weight = parseNonNegativeNumber(weightRaw);
  if (weight == null || weight <= 0) {
    return null;
  }

  const unitIdRaw = params.unitId?.trim() ?? '';
  if (!unitIdRaw) {
    return null;
  }

  const perf = params.unitPerformanceKmL;
  const unitPerformanceKmL =
    perf != null && Number.isFinite(perf) && perf > 0 ? perf : null;
  if (unitPerformanceKmL == null) {
    return null;
  }

  const unitId = parseOptionalFuelEstimateUnitId(unitIdRaw);

  return {
    distanceKm: km,
    configuration: fuelConfigurationFromMaxEquipment(params.maxEquipmentCount ?? 1),
    approximateWeightTons: weight,
    cargoType: params.loadType,
    containerType: params.containerType,
    ...(unitId != null ? { unitId } : {}),
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
