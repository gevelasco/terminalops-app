import { isPlanaEquipment } from '@features/fleet/utils/unit-hitched-equipment';
import { resolveTripDistanceKm } from '@features/trips/utils/trip-operational-provision';
import type { OperationConfiguration } from '@shared/models/operation-configuration.models';
import type {
  TripEvaluationContext,
  TripEvaluationPick,
  TripEvaluationResult,
  TripProfitabilityInputs,
} from '@shared/models/trip-evaluation.model';
import type { Equipment } from '@shared/models/logistics.models';
import {
  operationConfigBadgeTone,
  operationConfigChartColor,
  operationConfigChartFillClass,
} from '@shared/utils/operation-configuration-display.utils';

/** Clave estructural de agrupación — nunca labels de UI. */
export function structuralGroupingKey(
  configurationId?: string | null,
  configurationCode?: string | null,
): string {
  const id = configurationId?.trim();
  if (id) {
    return `id:${id}`;
  }
  const code = configurationCode?.trim().toLowerCase();
  if (code) {
    return `code:${code}`;
  }
  return 'unknown';
}

/** Leyenda de reportes solo desde datos estructurales / snapshot persistido. */
export function reportSliceLabel(result: TripEvaluationResult): string {
  const snap = result.configurationNameSnapshot?.trim();
  if (snap) {
    return snap;
  }
  const code = result.configurationCode?.trim();
  if (code) {
    return code;
  }
  return result.groupingKey;
}

export function chartColorForGroupingKey(groupingKey: string): string {
  return operationConfigChartColor(groupingKey);
}

export function chartFillClassForTone(tone: number, scope: 'dash' | 'reports'): string {
  return operationConfigChartFillClass(tone, scope);
}

function configEntrySuggestsPlataforma(entry: Pick<OperationConfiguration, 'code' | 'name'>): boolean {
  const t = `${entry.code} ${entry.name}`.toLowerCase();
  return t.includes('plana') || t.includes('plataforma') || t.includes('flatbed');
}

function codeSuggestsPlataforma(code: string): boolean {
  const t = code.trim().toLowerCase();
  return t.includes('plana') || t.includes('plataforma') || t.includes('flatbed');
}

function findCatalogEntry(
  catalog: readonly OperationConfiguration[],
  configurationId?: string,
  code?: string,
): OperationConfiguration | null {
  const id = configurationId?.trim();
  if (id) {
    const byId = catalog.find((c) => c.id === id);
    if (byId) {
      return byId;
    }
  }
  const normalized = code?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return catalog.find((c) => c.code.trim().toLowerCase() === normalized) ?? null;
}

function tirePositionsForFacts(input: {
  maxEquipmentCount: number;
  suggestsPlataformaConvoy: boolean;
}): number {
  if (input.maxEquipmentCount >= 2) {
    return 22;
  }
  if (input.suggestsPlataformaConvoy) {
    return 16;
  }
  return 18;
}

function equipmentSuggestsPlataforma(
  trip: TripEvaluationPick,
  equipmentById?: ReadonlyMap<string, Pick<Equipment, 'type'>>,
): boolean {
  for (const raw of trip.equipment ?? []) {
    const id = raw.trim();
    if (!id) {
      continue;
    }
    const eq = equipmentById?.get(id);
    if (eq && isPlanaEquipment(eq as Equipment)) {
      return true;
    }
  }
  return false;
}

function buildResult(input: {
  groupingKey: string;
  configurationCode: string;
  configurationId?: string;
  configurationVersion: number;
  configurationNameSnapshot?: string;
  maxEquipmentCount: number;
  operationalDistanceKm: number;
  suggestsPlataformaConvoy: boolean;
}): TripEvaluationResult {
  const profitabilityInputs: TripProfitabilityInputs = {
    groupingKey: input.groupingKey,
    configurationCode: input.configurationCode,
    configurationId: input.configurationId,
    maxEquipmentCount: input.maxEquipmentCount,
    operationalDistanceKm: input.operationalDistanceKm,
    configurationVersion: input.configurationVersion,
  };

  const tirePositions = tirePositionsForFacts({
    maxEquipmentCount: input.maxEquipmentCount,
    suggestsPlataformaConvoy: input.suggestsPlataformaConvoy,
  });

  return {
    groupingKey: input.groupingKey,
    configurationCode: input.configurationCode,
    configurationId: input.configurationId,
    configurationVersion: input.configurationVersion,
    configurationNameSnapshot: input.configurationNameSnapshot,
    dieselCostBasis: input.maxEquipmentCount >= 2 ? 'full' : 'sencillo',
    operationalDistanceKm: input.operationalDistanceKm,
    maxEquipmentMode: input.maxEquipmentCount >= 2 ? 'multi' : 'single',
    maxEquipmentCount: input.maxEquipmentCount,
    chartTone: operationConfigBadgeTone(input.groupingKey),
    suggestsPlataformaConvoy: input.suggestsPlataformaConvoy,
    tirePositions,
    profitabilityInputs,
  };
}

/**
 * Maniobra persistida — solo campos congelados en trip + heurística de equipo.
 * No catálogo vivo, no resolver, no humanize.
 */
export function evaluatePersistedTrip(
  trip: TripEvaluationPick,
  context: TripEvaluationContext = {},
): TripEvaluationResult {
  const configurationCode = trip.operationType?.trim().toLowerCase() ?? '';
  const configurationId = trip.operationConfigurationId?.trim() || undefined;
  const maxEquipmentCount = Math.max(
    1,
    trip.operationConfigurationMaxEquipmentCountSnapshot ?? 1,
  );
  const configurationVersion = trip.operationConfigurationVersionSnapshot ?? 1;
  const configurationNameSnapshot =
    trip.operationConfigurationNameSnapshot?.trim() || undefined;
  const groupingKey = structuralGroupingKey(configurationId, configurationCode);
  const operationalDistanceKm = resolveTripDistanceKm(trip);
  const suggestsPlataformaConvoy =
    codeSuggestsPlataforma(configurationCode) ||
    equipmentSuggestsPlataforma(trip, context.equipmentById);

  return buildResult({
    groupingKey,
    configurationCode,
    configurationId,
    configurationVersion,
    configurationNameSnapshot,
    maxEquipmentCount,
    operationalDistanceKm,
    suggestsPlataformaConvoy,
  });
}

/**
 * Borrador / cálculo activo — catálogo vivo, sin snapshots de trip.
 */
export function evaluateDraftTrip(
  context: TripEvaluationContext,
  catalog: readonly OperationConfiguration[],
): TripEvaluationResult {
  const configurationCode = context.draftOperationCode?.trim().toLowerCase() ?? '';
  const configurationId = context.draftOperationConfigurationId?.trim() || undefined;
  const entry = findCatalogEntry(catalog, configurationId, configurationCode);
  const maxEquipmentCount = Math.max(
    1,
    context.draftMaxEquipmentCount ?? entry?.maxEquipmentCount ?? 1,
  );
  const configurationVersion = entry?.version ?? 1;
  const groupingKey = structuralGroupingKey(entry?.id ?? configurationId, entry?.code ?? configurationCode);
  const suggestsPlataformaConvoy =
    (entry ? configEntrySuggestsPlataforma(entry) : codeSuggestsPlataforma(configurationCode));

  return buildResult({
    groupingKey,
    configurationCode: entry?.code ?? configurationCode,
    configurationId: entry?.id ?? configurationId,
    configurationVersion,
    maxEquipmentCount,
    operationalDistanceKm: 0,
    suggestsPlataformaConvoy,
  });
}
