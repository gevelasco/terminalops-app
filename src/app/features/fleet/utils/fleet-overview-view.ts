import {
  tripArrivalIso,
  tripCompletionIso,
  tripDepartureIso,
} from '@features/trips/utils/trip-schedule-accessors';
import type {
  FleetOverviewAssetStatus,
  FleetOverviewEquipmentRowDto,
  FleetOverviewHitchedEquipmentDto,
  FleetOverviewItemDto,
  FleetOverviewOperationalStatus,
  FleetOverviewRenewalStatus,
} from '@shared/models/api/fleet-overview.model';
import type { Equipment, Unit } from '@shared/models/logistics.models';
import {
  overviewOperationalKey,
  operationalKeyIsEnCurso,
  overviewOperationalStatusToFleetStatus,
} from '@shared/utils/fleet/fleet-status.resolver';
import {
  fleetOperationalKeyLabel,
  fleetOperationalPillClass,
  fleetComplianceFromEquipment,
  fleetComplianceFromUnitMeta,
  type FleetComplianceSummary,
  type FleetOperationalKey,
  type FleetRenewalBucket,
} from '@features/fleet/utils/fleet-unit-table-row';
import { operationConfigBadgeClass } from '@shared/utils/operation-configuration-display.utils';
import {
  equipmentTypeDisplayLabelFromRaw,
  fleetUnitConvoyTableLabel,
} from '@features/fleet/utils/unit-hitched-equipment';
import {
  convoyTrailerVisualFromType,
  schemaPrimaryAssetForVisual,
  schemaSecondaryAssetForVisual,
  SCHEMA_TRACTO_ASSET,
  type ConvoyTrailerVisual,
} from '@features/trips/utils/maniobra-schema-convoy-assets';

export type FleetOverviewCardKind = 'unit' | 'standalone-equipment';

export type FleetOverviewCardEntry = {
  kind: FleetOverviewCardKind;
  unitId: string;
  unitName: string;
  unitAlias: string;
  unitPlate: string;
  operational: FleetOperationalKey;
  panelMode: 'maneuver' | 'parked';
  statusPill: { className: string; label: string };
  convoy: { label: string; badgeClass: string; code: string };
  trip: FleetOverviewItemDto['trip'];
  maintenance: FleetOverviewItemDto['maintenance'];
  hitched: FleetOverviewItemDto['hitchedEquipment'];
  isFullConvoy: boolean;
  usesPlataforma: boolean;
  usesCajaSeca: boolean;
  trailerVisual: ConvoyTrailerVisual;
  daysWithoutManeuver?: number;
  /** Seguro y verificaciones desde fleetMeta local (misma lógica que drawer y tablas). */
  compliance?: FleetComplianceSummary;
};

/** Mapas autoritativos desde GET /fleet/overview (incluye maniobras activas). */
export function buildOverviewUnitOperationalMap(
  items: readonly FleetOverviewItemDto[],
): Map<string, FleetOperationalKey> {
  const map = new Map<string, FleetOperationalKey>();
  for (const item of items) {
    map.set(String(item.unitId), overviewOperationalKey(item.operationalStatus));
  }
  return map;
}

export function buildOverviewEquipmentOperationalMap(
  rows: readonly FleetOverviewEquipmentRowDto[],
): Map<string, FleetOperationalKey> {
  const map = new Map<string, FleetOperationalKey>();
  for (const row of rows) {
    map.set(String(row.equipmentId), overviewOperationalKey(row.operationalStatus));
  }
  return map;
}

export { overviewOperationalKey } from '@shared/utils/fleet/fleet-status.resolver';

export function renewalBucketFromOverview(
  value: FleetOverviewRenewalStatus | undefined,
): FleetRenewalBucket {
  if (value === 'ok' || value === 'soon' || value === 'due') {
    return value;
  }
  return 'na';
}

/** Enriquece tarjetas de overview con cumplimiento calculado en cliente (fuente única con drawer). */
export function attachOverviewCompliance(
  entry: FleetOverviewCardEntry,
  units: readonly Unit[],
  equipment: readonly Equipment[],
): FleetOverviewCardEntry {
  if (entry.kind === 'standalone-equipment') {
    const equipmentId = entry.hitched[0]?.equipmentId;
    if (equipmentId == null) {
      return entry;
    }
    const e = equipment.find((row) => row.id === String(equipmentId));
    if (!e) {
      return entry;
    }
    return { ...entry, compliance: fleetComplianceFromEquipment(e) };
  }

  const unit = units.find((row) => row.id === entry.unitId);
  if (!unit) {
    return entry;
  }
  return { ...entry, compliance: fleetComplianceFromUnitMeta(unit.fleetMeta) };
}

function isPlanaType(type: string): boolean {
  const v = type.trim().toLowerCase();
  return v === 'plataforma' || v.includes('plana') || v.includes('flatbed');
}

function overviewAssetStatusFromOperational(
  status: FleetOverviewOperationalStatus,
): FleetOverviewAssetStatus {
  switch (overviewOperationalStatusToFleetStatus(status)) {
    case 'in_use':
      return 'in_use';
    case 'scheduled':
      return 'scheduled';
    case 'maintenance':
      return 'maintenance';
    default:
      return 'available';
  }
}

/** Etiqueta de convoy en overview según enganches (no config operativa de maniobra). */
export function overviewUnitConvoyLabel(item: FleetOverviewItemDto): string {
  if (item.equipment.type === 'full' && item.hitchedEquipment.length < 2) {
    return 'Doble articulado';
  }
  return fleetUnitConvoyTableLabel(item.hitchedEquipment.length);
}

export function overviewCardEntryFromDto(item: FleetOverviewItemDto): FleetOverviewCardEntry {
  const operational = overviewOperationalKey(item.operationalStatus);
  const trip = item.trip;
  const panelMode: 'maneuver' | 'parked' = trip ? 'maneuver' : 'parked';
  const configCode = item.configuration?.code?.trim() ?? '';
  const convoyLabel = overviewUnitConvoyLabel(item);
  const hitched = item.hitchedEquipment;
  const trailerVisual =
    hitched.length > 0
      ? convoyTrailerVisualFromType(hitched[0]!.equipmentType)
      : ('remolque' as const);
  const usesPlataforma = trailerVisual === 'plataforma';
  const usesCajaSeca = trailerVisual === 'caja_seca';

  const statusPill = {
    className: fleetOperationalPillClass(operational),
    label: fleetOperationalKeyLabel(operational),
  };

  return {
    kind: 'unit',
    unitId: String(item.unitId),
    unitName: item.unitName,
    unitAlias: item.unitAlias?.trim() || '',
    unitPlate: item.unitPlate,
    operational,
    panelMode,
    statusPill,
    convoy: {
      label: convoyLabel,
      badgeClass: operationConfigBadgeClass(convoyLabel),
      code: configCode,
    },
    trip,
    maintenance: item.maintenance,
    hitched,
    isFullConvoy: item.equipment.type === 'full' || hitched.length >= 2,
    usesPlataforma,
    usesCajaSeca,
    trailerVisual,
    daysWithoutManeuver: item.daysWithoutManeuver,
  };
}

/** Equipo en patio sin tractora asignada (`equipment.unitId === null`). */
export function overviewCardEntryFromEquipmentRow(
  row: FleetOverviewEquipmentRowDto,
): FleetOverviewCardEntry | null {
  if (row.unitId != null) {
    return null;
  }

  const operational = overviewOperationalKey(row.operationalStatus);
  const hitched: FleetOverviewHitchedEquipmentDto[] = [
    {
      equipmentId: row.equipmentId,
      operationalCode: row.operationalCode,
      alias: row.alias,
      equipmentType: row.equipmentType,
      status: overviewAssetStatusFromOperational(row.operationalStatus),
    },
  ];
  const usesPlataforma = isPlanaType(row.equipmentType);
  const trailerVisual = convoyTrailerVisualFromType(row.equipmentType);
  const usesCajaSeca = trailerVisual === 'caja_seca';
  const convoyLabel = equipmentTypeDisplayLabelFromRaw(row.equipmentType);

  return {
    kind: 'standalone-equipment',
    unitId: `eq-${row.equipmentId}`,
    unitName: row.operationalCode,
    unitAlias: row.alias?.trim() || '',
    unitPlate: row.plate,
    operational,
    panelMode: 'parked',
    statusPill: {
      className: fleetOperationalPillClass(operational),
      label: fleetOperationalKeyLabel(operational),
    },
    convoy: {
      label: convoyLabel,
      badgeClass: operationConfigBadgeClass(convoyLabel),
      code: '',
    },
    trip: undefined,
    maintenance: row.maintenance,
    hitched,
    isFullConvoy: false,
    usesPlataforma,
    usesCajaSeca,
    trailerVisual,
  };
}

export function overviewTrailerVisualAt(
  entry: FleetOverviewCardEntry,
  index: number,
): ConvoyTrailerVisual {
  const type = entry.hitched[index]?.equipmentType;
  if (!type?.trim()) {
    return entry.trailerVisual;
  }
  return convoyTrailerVisualFromType(type);
}

export function overviewAssetAt(entry: FleetOverviewCardEntry, index: number): string {
  const visual = overviewTrailerVisualAt(entry, index);
  if (index === 0) {
    return schemaPrimaryAssetForVisual(visual);
  }
  return schemaSecondaryAssetForVisual(visual);
}

export function overviewPrimaryAsset(entry: FleetOverviewCardEntry): string {
  return overviewAssetAt(entry, 0);
}

export function overviewSecondaryAsset(entry: FleetOverviewCardEntry): string {
  return overviewAssetAt(entry, 1);
}

export const SCHEMA_TRACTO = SCHEMA_TRACTO_ASSET;

export type FleetOverviewConvoySortKind =
  | 'doble-articulado'
  | 'sencillo'
  | 'tracto'
  | 'remolque';

/** Maniobra activa en tránsito (pill «En curso»). */
export function overviewIsEnCurso(entry: FleetOverviewCardEntry): boolean {
  return operationalKeyIsEnCurso(entry.operational);
}

/** Tipo de convoy para ordenar dentro de cada bloque operativo. */
export function overviewConvoySortKind(
  entry: FleetOverviewCardEntry,
): FleetOverviewConvoySortKind {
  if (entry.kind === 'standalone-equipment') {
    return 'remolque';
  }
  if (entry.isFullConvoy || entry.convoy.label === 'Doble articulado') {
    return 'doble-articulado';
  }
  if (entry.hitched.length >= 1 || entry.convoy.label === 'Sencillo') {
    return 'sencillo';
  }
  return 'tracto';
}

const OVERVIEW_CONVOY_SORT_RANK: Record<FleetOverviewConvoySortKind, number> = {
  'doble-articulado': 40,
  sencillo: 30,
  tracto: 20,
  remolque: 10,
};

/** Orden de tarjetas en overview: primero en curso, luego disponible; dentro, doble → sencillo → tracto → remolque. */
export function overviewSortRank(entry: FleetOverviewCardEntry): number {
  const statusRank = overviewIsEnCurso(entry) ? 200 : 100;
  return statusRank + OVERVIEW_CONVOY_SORT_RANK[overviewConvoySortKind(entry)];
}

export function overviewMatchesStatusFilter(
  entry: FleetOverviewCardEntry,
  filter: FleetOperationalKey | 'all',
): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'on_route') {
    return operationalKeyIsEnCurso(entry.operational);
  }
  if (filter === 'scheduled') {
    return entry.operational === 'scheduled';
  }
  return entry.operational === filter;
}

function overviewEffectiveDateTimeLine(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  const date = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return `${date} · ${time}`;
}

/** Salida: real si existe; si no, plan operativo. */
export function overviewTripDepartureLine(trip: NonNullable<FleetOverviewItemDto['trip']>): string {
  return overviewEffectiveDateTimeLine(tripDepartureIso(trip));
}

/** Entrega: real si existe; si no, plan operativo. */
export function overviewTripArrivalLine(trip: NonNullable<FleetOverviewItemDto['trip']>): string {
  return overviewEffectiveDateTimeLine(tripArrivalIso(trip));
}
