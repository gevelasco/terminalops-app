import type { Equipment, Trip } from '@shared/models/logistics.models';

/** Entrada mínima del catálogo vivo (motor interno — no importar desde features). */
export interface OperationConfigCatalogEntry {
  readonly id?: string;
  readonly code: string;
  readonly name: string;
  readonly maxEquipmentCount?: number;
}

export interface OperationConfigResolveParams {
  operationConfigurationId?: string | null;
  code?: string | null;
  nameSnapshot?: string | null;
  catalog?: readonly OperationConfigCatalogEntry[];
  activeCatalog?: readonly OperationConfigCatalogEntry[];
  maxEquipmentCountOverride?: number;
}

export interface OperationConfigResolved {
  code: string;
  label: string;
  badgeClass: string;
  chartColor: string;
  groupingKey: string;
}

export interface OperationConfigDisplay {
  code: string;
  label: string;
  badgeClass: string;
  chartColor: string;
}

export type UnitConvoyKind = 'none' | 'single' | 'multi' | 'plataforma';

export interface UnitConvoyDisplay {
  kind: UnitConvoyKind;
  code: string | null;
  label: string;
  badgeClass: string;
  description: string;
}

const UNKNOWN_LABEL = 'Configuración desconocida';

const CHART_PALETTE = [
  '#6366f1',
  '#0ea5e9',
  '#a855f7',
  '#14b8a6',
  '#f59e0b',
  '#ef4444',
  '#64748b',
] as const;

const BADGE_TONE_COUNT = 6;

function stableHash(input: string): number {
  let h = 0;
  const t = input.trim().toLowerCase();
  for (let i = 0; i < t.length; i++) {
    h = (h * 31 + t.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function findCatalogEntryById(
  catalog: readonly OperationConfigCatalogEntry[] | undefined,
  id: string,
): OperationConfigCatalogEntry | null {
  const normalized = id.trim();
  if (!normalized || !catalog?.length) {
    return null;
  }
  return catalog.find((c) => c.id === normalized) ?? null;
}

export function findCatalogEntryByCode(
  catalog: readonly OperationConfigCatalogEntry[] | undefined,
  code: string,
): OperationConfigCatalogEntry | null {
  const normalized = code.trim().toLowerCase();
  if (!normalized || !catalog?.length) {
    return null;
  }
  return catalog.find((c) => c.code.trim().toLowerCase() === normalized) ?? null;
}

function catalogEntrySuggestsPlataforma(entry: OperationConfigCatalogEntry): boolean {
  const t = `${entry.code} ${entry.name}`.toLowerCase();
  return t.includes('plana') || t.includes('plataforma') || t.includes('flatbed');
}

function groupingKeyFromParts(params: {
  label: string;
  operationConfigurationId?: string;
  code?: string;
}): string {
  if (params.label !== UNKNOWN_LABEL) {
    return params.label;
  }
  const id = params.operationConfigurationId?.trim();
  if (id) {
    return `id:${id}`;
  }
  const code = params.code?.trim();
  if (code) {
    return `code:${code}`;
  }
  return 'unknown';
}

/**
 * Motor determinista — orden:
 * 1) snapshot
 * 2) catálogo activo por id
 * 3) catálogo activo por code
 * 4) catálogo completo por id
 * 5) catálogo completo por code
 * 6) desconocido
 */
export function resolveOperationConfiguration(
  params: OperationConfigResolveParams,
): OperationConfigResolved {
  const snap = params.nameSnapshot?.trim();
  const id = params.operationConfigurationId?.trim();
  const code = (params.code ?? '').trim();
  const full = params.catalog ?? [];
  const active = params.activeCatalog ?? full;

  let label = UNKNOWN_LABEL;

  if (snap) {
    label = snap;
  } else if (id) {
    label =
      findCatalogEntryById(active, id)?.name?.trim() ||
      findCatalogEntryById(full, id)?.name?.trim() ||
      UNKNOWN_LABEL;
  } else if (code) {
    label =
      findCatalogEntryByCode(active, code)?.name?.trim() ||
      findCatalogEntryByCode(full, code)?.name?.trim() ||
      UNKNOWN_LABEL;
  }

  const badgeKey = label !== UNKNOWN_LABEL ? label : code || id || 'unknown';
  const groupingKey = groupingKeyFromParts({
    label,
    operationConfigurationId: id,
    code,
  });

  return {
    code,
    label,
    badgeClass: operationConfigBadgeClass(badgeKey),
    chartColor: operationConfigChartColor(badgeKey),
    groupingKey,
  };
}

/** @deprecated Usar OperationConfigurationResolverService.resolveLabel */
export function resolveOperationConfigLabel(params: OperationConfigResolveParams): string {
  return resolveOperationConfiguration(params).label;
}

/** @deprecated Usar OperationConfigurationResolverService */
export function resolveOperationConfigDisplay(
  params: OperationConfigResolveParams,
): OperationConfigDisplay {
  const resolved = resolveOperationConfiguration(params);
  return {
    code: resolved.code,
    label: resolved.label,
    badgeClass: resolved.badgeClass,
    chartColor: resolved.chartColor,
  };
}

export function configMaxEquipmentCount(params: OperationConfigResolveParams): number {
  if (params.maxEquipmentCountOverride != null) {
    return Math.max(1, params.maxEquipmentCountOverride);
  }

  const full = params.catalog ?? [];
  const active = params.activeCatalog ?? full;
  const id = params.operationConfigurationId?.trim();

  if (id) {
    const byActive = findCatalogEntryById(active, id);
    if (byActive?.maxEquipmentCount != null) {
      return Math.max(1, byActive.maxEquipmentCount);
    }
    const byFull = findCatalogEntryById(full, id);
    if (byFull?.maxEquipmentCount != null) {
      return Math.max(1, byFull.maxEquipmentCount);
    }
    return 1;
  }

  const byActiveCode = findCatalogEntryByCode(active, params.code ?? '');
  if (byActiveCode?.maxEquipmentCount != null) {
    return Math.max(1, byActiveCode.maxEquipmentCount);
  }
  const byFullCode = findCatalogEntryByCode(full, params.code ?? '');
  if (byFullCode?.maxEquipmentCount != null) {
    return Math.max(1, byFullCode.maxEquipmentCount);
  }

  return 1;
}

export function configUsesMultipleEquipment(params: OperationConfigResolveParams): boolean {
  return configMaxEquipmentCount(params) >= 2;
}

export function operationConfigSuggestsPlataformaConvoy(
  code?: string | null,
  catalog?: readonly OperationConfigCatalogEntry[],
  activeCatalog?: readonly OperationConfigCatalogEntry[],
): boolean {
  const active = activeCatalog ?? catalog;
  const fromActive = findCatalogEntryByCode(active, code ?? '');
  if (fromActive && catalogEntrySuggestsPlataforma(fromActive)) {
    return true;
  }
  const fromFull = findCatalogEntryByCode(catalog, code ?? '');
  if (fromFull && catalogEntrySuggestsPlataforma(fromFull)) {
    return true;
  }
  return false;
}

function inferConvoyConfigCode(
  trailerCount: number,
  isPlataformaTrailer: boolean,
  catalog?: readonly OperationConfigCatalogEntry[],
): string {
  const list = catalog ?? [];
  if (trailerCount <= 0 || list.length === 0) {
    return '';
  }
  if (trailerCount >= 2) {
    const multi = list.filter((c) => (c.maxEquipmentCount ?? 1) >= 2);
    multi.sort(
      (a, b) => (b.maxEquipmentCount ?? 1) - (a.maxEquipmentCount ?? 1),
    );
    return multi[0]?.code ?? list[0]!.code;
  }
  if (isPlataformaTrailer) {
    const plataforma = list.filter(
      (c) => (c.maxEquipmentCount ?? 1) === 1 && catalogEntrySuggestsPlataforma(c),
    );
    if (plataforma[0]) {
      return plataforma[0].code;
    }
  }
  const single = list.filter(
    (c) => (c.maxEquipmentCount ?? 1) === 1 && !catalogEntrySuggestsPlataforma(c),
  );
  return (
    single[0]?.code ??
    list.find((c) => (c.maxEquipmentCount ?? 1) === 1)?.code ??
    list[0]!.code
  );
}

function convoyKind(trailerCount: number, isPlataforma: boolean): UnitConvoyKind {
  if (trailerCount === 0) {
    return 'none';
  }
  if (trailerCount >= 2) {
    return 'multi';
  }
  return isPlataforma ? 'plataforma' : 'single';
}

export function resolveUnitConvoyFromEquipment(
  list: Equipment[],
  catalog?: readonly OperationConfigCatalogEntry[],
  isPlataformaEquipment: (e: Equipment) => boolean = () => false,
): UnitConvoyDisplay {
  const n = list.length;
  if (n === 0) {
    return {
      kind: 'none',
      code: null,
      label: 'Sin enganche',
      badgeClass: operationConfigBadgeClass('Sin enganche'),
      description:
        'No hay remolques asignados a esta tractora. Enganche remolques según la configuración operacional requerida.',
    };
  }

  const isPlataforma = n === 1 && isPlataformaEquipment(list[0]!);
  const code = inferConvoyConfigCode(n, isPlataforma, catalog);
  const display = resolveOperationConfiguration({ code, catalog });
  const kind = convoyKind(n, isPlataforma);
  const description =
    kind === 'multi'
      ? `${n} remolques enganchados (${display.label}).`
      : kind === 'plataforma'
        ? `Un remolque tipo plataforma (${display.label}).`
        : `Un remolque enganchado (${display.label}).`;

  return {
    kind,
    code: code || null,
    label: display.label,
    badgeClass: display.badgeClass,
    description,
  };
}

export function operationConfigBadgeTone(key: string): number {
  return stableHash(key || 'unknown') % BADGE_TONE_COUNT;
}

export function operationConfigBadgeClass(key: string): string {
  const tone = operationConfigBadgeTone(key);
  return `to-table-badge to-table-badge--op to-table-badge--op-tone-${tone}`;
}

export function operationConfigChartColor(key: string): string {
  const idx = stableHash(key || 'unknown') % CHART_PALETTE.length;
  return CHART_PALETTE[idx] ?? CHART_PALETTE[CHART_PALETTE.length - 1];
}

export function operationConfigChartFillClass(
  tone: number,
  scope: 'dash' | 'reports',
): string {
  const n = ((tone % BADGE_TONE_COUNT) + BADGE_TONE_COUNT) % BADGE_TONE_COUNT;
  return scope === 'dash'
    ? `dash-chart-bar__fill--op-${n}`
    : `reports-chart-bar__fill--op-${n}`;
}

export function catalogFromOperationConfigurations(
  configs: readonly {
    id: string;
    code: string;
    name: string;
    maxEquipmentCount: number;
  }[],
): OperationConfigCatalogEntry[] {
  return configs.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    maxEquipmentCount: c.maxEquipmentCount,
  }));
}
