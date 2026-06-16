import type {
  Equipment,
  Expense,
  Trip,
} from '@shared/models/logistics.models';
import { isPlanaEquipment } from '@features/fleet/utils/unit-hitched-equipment';
import type { TripEvaluator } from '@shared/models/trip-evaluation.model';
import { OPERATIONAL_PROVISION_VENDOR } from '@shared/utils/operational-provision';

/**
 * Provisión operativa por maniobra (llantas + mantenimiento preventivo estimado).
 * Se reparte entre unidad (tracto) y cada equipo del convoy.
 *
 * Referencias de industria (aprox.):
 * - Llantas: CPK = (posiciones × costo llanta) ÷ vida útil km.
 * - Mantenimiento preventivo (sin llantas): ~0.12–0.18 USD/mi (~1.3–1.9 MXN/km).
 */

const AVG_TIRE_COST_MXN = 8_500;
const TIRE_LIFE_KM = 100_000;
const PM_RESERVE_CPK_MXN = 1.85;
const BASELINE_LOAD_TONS = 22;
/** Llantas típicas del tracto (3 ejes motrices + dirección). */
const TRACTOR_TIRE_POSITIONS = 10;

export function parseApproxWeightTons(raw: string | undefined): number {
  const n = Number.parseFloat(String(raw ?? '').replace(',', '.').trim());
  if (!Number.isFinite(n) || n <= 0) {
    return BASELINE_LOAD_TONS;
  }
  return n;
}

export function tirePositionsForTrip(
  trip: Pick<
    Trip,
    | 'operationType'
    | 'operationConfigurationId'
    | 'operationConfigurationNameSnapshot'
    | 'operationConfigurationVersionSnapshot'
    | 'operationConfigurationMaxEquipmentCountSnapshot'
    | 'equipment'
  >,
  evaluator?: TripEvaluator,
  equipmentById?: ReadonlyMap<string, Pick<Equipment, 'type'>>,
): number {
  if (evaluator) {
    return evaluator.evaluateTrip(trip, { equipmentById }).tirePositions;
  }
  for (const raw of trip.equipment ?? []) {
    const eq = equipmentById?.get(raw.trim());
    if (eq && isPlanaEquipment(eq as Equipment)) {
      return 16;
    }
  }
  return 18;
}

/** @deprecated Usar tirePositionsForTrip con TripEvaluationService. */
export function tirePositionsForOperation(
  operationType: string,
  evaluator?: TripEvaluator,
): number {
  return tirePositionsForTrip({ operationType, equipment: [] }, evaluator);
}

export function resolveTripDistanceKm(
  trip: Pick<Trip, 'routeDistanceKm' | 'maneuverKind'>,
): number {
  const raw = trip.routeDistanceKm;
  if (raw != null && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  const kind = trip.maneuverKind?.trim().toLowerCase() ?? '';
  if (kind === 'local') {
    return 25;
  }
  if (kind === 'foránea' || kind === 'foranea') {
    return 450;
  }
  return 150;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function tireLoadFactor(weightTons: number): number {
  return 1 + clamp((weightTons - BASELINE_LOAD_TONS) * 0.012, 0, 0.35);
}

export function maintenanceLoadFactor(weightTons: number): number {
  return 1 + clamp((weightTons - BASELINE_LOAD_TONS) * 0.008, 0, 0.25);
}

export function resolveTripEquipmentIds(
  trip: Pick<Trip, 'equipmentIds' | 'equipment'>,
  catalog?: ReadonlyArray<Pick<Equipment, 'id'>>,
): string[] {
  const explicit = (trip.equipmentIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (explicit.length > 0) {
    return explicit;
  }
  const known = new Set((catalog ?? []).map((row) => row.id.trim()).filter(Boolean));
  if (known.size === 0) {
    return [];
  }
  return trip.equipment.map((entry) => entry.trim()).filter((entry) => known.has(entry));
}

function defaultEquipmentTirePositions(
  equipmentCount: number,
  trip: Pick<
    Trip,
    | 'operationType'
    | 'operationConfigurationId'
    | 'operationConfigurationNameSnapshot'
    | 'equipment'
  >,
  evaluator?: TripEvaluator,
): number[] {
  if (equipmentCount <= 0) {
    return [];
  }
  const convoyPositions = tirePositionsForTrip(trip, evaluator);
  const trailerTotal = Math.max(0, convoyPositions - TRACTOR_TIRE_POSITIONS);
  const base = Math.floor(trailerTotal / equipmentCount);
  const remainder = trailerTotal % equipmentCount;
  return Array.from({ length: equipmentCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function equipmentTirePositions(
  equipment: Pick<Equipment, 'fleetMeta'> | undefined,
  fallback: number,
): number {
  const configured = equipment?.fleetMeta?.equipmentTireCount;
  if (configured != null && configured > 0) {
    return configured;
  }
  return fallback;
}

function tireCpk(positions: number, weightTons: number): number {
  const baseCpk = (positions * AVG_TIRE_COST_MXN) / TIRE_LIFE_KM;
  return baseCpk * tireLoadFactor(weightTons);
}

function tireAmount(positions: number, distanceKm: number, weightTons: number): number {
  return Math.round(distanceKm * tireCpk(positions, weightTons));
}

export function estimateTripTireWearMxn(input: {
  distanceKm: number;
  operationType: string;
  weightTons: number;
  evaluator?: TripEvaluator;
  trip?: Pick<
    Trip,
    | 'operationType'
    | 'operationConfigurationId'
    | 'operationConfigurationNameSnapshot'
    | 'equipment'
  >;
}): { amount: number; cpk: number; description: string } {
  const positions = tirePositionsForTrip(
    input.trip ?? { operationType: input.operationType, equipment: [] },
    input.evaluator,
  );
  const cpk = tireCpk(positions, input.weightTons);
  const amount = Math.round(input.distanceKm * cpk);
  const description =
    `Provisión operativa: ~${positions} llantas, ` +
    `${input.distanceKm.toFixed(1)} km × ${cpk.toFixed(2)} MXN/km ` +
    `(carga ~${input.weightTons.toFixed(1)} t).`;
  return { amount, cpk, description };
}

export function estimateTripMaintenanceReserveMxn(input: {
  distanceKm: number;
  weightTons: number;
}): { amount: number; cpk: number; description: string } {
  const cpk = PM_RESERVE_CPK_MXN * maintenanceLoadFactor(input.weightTons);
  const amount = Math.round(input.distanceKm * cpk);
  const description =
    `Provisión preventiva: ${input.distanceKm.toFixed(1)} km × ${cpk.toFixed(2)} MXN/km ` +
    `(aceite, filtros, frenos programados; carga ~${input.weightTons.toFixed(1)} t).`;
  return { amount, cpk, description };
}

function splitAmountByWeights(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) {
    return [];
  }
  const sum = weights.reduce((acc, value) => acc + value, 0) || 1;
  const shares = weights.map((weight) => Math.round((total * weight) / sum));
  const diff = total - shares.reduce((acc, value) => acc + value, 0);
  if (diff !== 0) {
    shares[shares.length - 1] = (shares[shares.length - 1] ?? 0) + diff;
  }
  return shares;
}

export type OperationalProvisionBuildContext = {
  equipmentCatalog?: readonly Equipment[];
  evaluator?: TripEvaluator;
};

/** Gastos ledger estimados al programar la maniobra. */
export function buildDefaultTripOperationalProvisionExpenses(
  trip: Trip,
  context: OperationalProvisionBuildContext = {},
): Expense[] {
  const distanceKm = resolveTripDistanceKm(trip);
  const weightTons = parseApproxWeightTons(trip.approximateWeightTons);
  const incurredAt =
    trip.departureAt?.trim() || trip.plannedDepartureAt?.trim() || trip.createdAt;
  const equipmentCatalog = context.equipmentCatalog ?? [];
  const evaluator = context.evaluator;
  const equipmentIds = resolveTripEquipmentIds(trip, equipmentCatalog);

  if (equipmentIds.length === 0) {
    return buildLegacyCombinedProvisionExpenses(
      trip,
      distanceKm,
      weightTons,
      incurredAt,
      evaluator,
    );
  }

  const defaultEquipPositions = defaultEquipmentTirePositions(
    equipmentIds.length,
    trip,
    evaluator,
  );
  const unitPositions = TRACTOR_TIRE_POSITIONS;
  const equipmentRows = equipmentIds.map((id, index) => ({
    id,
    row: equipmentCatalog.find((entry) => entry.id === id),
    positions: equipmentTirePositions(
      equipmentCatalog.find((entry) => entry.id === id),
      defaultEquipPositions[index] ?? 8,
    ),
  }));

  const positionWeights = [
    unitPositions,
    ...equipmentRows.map((row) => row.positions),
  ];
  const totalPm = estimateTripMaintenanceReserveMxn({ distanceKm, weightTons });
  const pmShares = splitAmountByWeights(totalPm.amount, positionWeights);

  const expenses: Expense[] = [];

  const unitTires = tireAmount(unitPositions, distanceKm, weightTons);
  expenses.push(
    buildTireExpense({
      trip,
      idSuffix: 'llantas-und',
      amount: unitTires,
      incurredAt,
      relatedUnitId: trip.unitId,
      description:
        `Provisión operativa (unidad): ~${unitPositions} llantas, ` +
        `${distanceKm.toFixed(1)} km × ${tireCpk(unitPositions, weightTons).toFixed(2)} MXN/km ` +
        `(carga ~${weightTons.toFixed(1)} t).`,
    }),
  );

  equipmentRows.forEach((equipment, index) => {
    const positions = equipment.positions;
    const amount = tireAmount(positions, distanceKm, weightTons);
    expenses.push(
      buildTireExpense({
        trip,
        idSuffix: `llantas-eq${index + 1}`,
        amount,
        incurredAt,
        relatedEquipmentId: equipment.id,
        description:
          `Provisión operativa (equipo): ~${positions} llantas, ` +
          `${distanceKm.toFixed(1)} km × ${tireCpk(positions, weightTons).toFixed(2)} MXN/km ` +
          `(carga ~${weightTons.toFixed(1)} t).`,
      }),
    );
  });

  expenses.push(
    buildMaintenanceExpense({
      trip,
      idSuffix: 'pm-und',
      amount: pmShares[0] ?? 0,
      incurredAt,
      maintenanceTarget: 'unit',
      relatedUnitId: trip.unitId,
      description:
        `Provisión preventiva (unidad): ${distanceKm.toFixed(1)} km, ` +
        `parte proporcional del servicio programado (carga ~${weightTons.toFixed(1)} t).`,
    }),
  );

  equipmentRows.forEach((equipment, index) => {
    expenses.push(
      buildMaintenanceExpense({
        trip,
        idSuffix: `pm-eq${index + 1}`,
        amount: pmShares[index + 1] ?? 0,
        incurredAt,
        maintenanceTarget: 'equipment',
        relatedEquipmentId: equipment.id,
        description:
          `Provisión preventiva (equipo): ${distanceKm.toFixed(1)} km, ` +
          `parte proporcional del servicio programado (carga ~${weightTons.toFixed(1)} t).`,
      }),
    );
  });

  return expenses.filter((expense) => expense.amount > 0);
}

function buildLegacyCombinedProvisionExpenses(
  trip: Trip,
  distanceKm: number,
  weightTons: number,
  incurredAt: string,
  evaluator?: TripEvaluator,
): Expense[] {
  const tires = estimateTripTireWearMxn({
    distanceKm,
    operationType: trip.operationType,
    weightTons,
    trip,
    evaluator,
  });
  const pm = estimateTripMaintenanceReserveMxn({ distanceKm, weightTons });

  return [
    buildTireExpense({
      trip,
      idSuffix: 'llantas',
      amount: tires.amount,
      incurredAt,
      relatedUnitId: trip.unitId,
      description: tires.description,
    }),
    buildMaintenanceExpense({
      trip,
      idSuffix: 'pm',
      amount: pm.amount,
      incurredAt,
      maintenanceTarget: 'unit',
      relatedUnitId: trip.unitId,
      description: pm.description,
    }),
  ];
}

function buildTireExpense(input: {
  trip: Trip;
  idSuffix: string;
  amount: number;
  incurredAt: string;
  description: string;
  relatedUnitId?: string;
  relatedEquipmentId?: string;
}): Expense {
  return {
    id: `${input.trip.id}-prov-${input.idSuffix}`,
    tripId: input.trip.id,
    category: 'Llantas (desgaste aprox.)',
    amount: input.amount,
    currency: 'MXN',
    incurredAt: input.incurredAt,
    kind: 'tires',
    isOperationalProvision: true,
    description: input.description,
    vendor: OPERATIONAL_PROVISION_VENDOR,
    relatedUnitId: input.relatedUnitId,
    relatedEquipmentId: input.relatedEquipmentId,
    paymentMethod: 'cash',
    invoiceRequired: false,
  };
}

function buildMaintenanceExpense(input: {
  trip: Trip;
  idSuffix: string;
  amount: number;
  incurredAt: string;
  description: string;
  maintenanceTarget: 'unit' | 'equipment';
  relatedUnitId?: string;
  relatedEquipmentId?: string;
}): Expense {
  return {
    id: `${input.trip.id}-prov-${input.idSuffix}`,
    tripId: input.trip.id,
    category: 'Mantenimiento preventivo (aprox.)',
    amount: input.amount,
    currency: 'MXN',
    incurredAt: input.incurredAt,
    kind: 'maintenance',
    maintenanceTarget: input.maintenanceTarget,
    isOperationalProvision: true,
    description: input.description,
    vendor: OPERATIONAL_PROVISION_VENDOR,
    relatedUnitId: input.relatedUnitId,
    relatedEquipmentId: input.relatedEquipmentId,
    paymentMethod: 'cash',
    invoiceRequired: false,
  };
}
