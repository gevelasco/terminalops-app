import type { Alert, Equipment, Expense, Trip, Unit } from '@shared/models/logistics.models';

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function tripCompletionDayLocal(t: Trip): string | null {
  if (t.status !== 'completed') {
    return null;
  }
  const iso = (t.arrivedAt ?? t.returnAt ?? t.scheduledAt ?? '').trim();
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return localYmd(d);
}

function monthPrefix(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function normStatus(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function tripsProgrammedCountInMonth(
  trips: readonly Trip[],
  year: number,
  /** 1–12 */
  month1: number,
): number {
  return trips.filter((t) => {
    const d = new Date(t.programmedAt);
    if (Number.isNaN(d.getTime())) {
      return false;
    }
    return d.getFullYear() === year && d.getMonth() + 1 === month1;
  }).length;
}

/** Variación % de maniobras con `programmedAt` en el mes actual vs el mes calendario anterior. */
function monthOverMonthProgrammedLegend(trips: readonly Trip[], now: Date): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const prev = new Date(y, m - 2, 15);
  const curCount = tripsProgrammedCountInMonth(trips, y, m);
  const prevCount = tripsProgrammedCountInMonth(
    trips,
    prev.getFullYear(),
    prev.getMonth() + 1,
  );
  if (prevCount === 0) {
    return curCount > 0 ? 'Sin base mes pasado' : 'Sin comparación';
  }
  const pct = Math.round(((curCount - prevCount) / prevCount) * 100);
  if (pct > 0) {
    return `${pct}% más vs mes pasado`;
  }
  if (pct < 0) {
    return `${-pct}% menos vs mes pasado`;
  }
  return 'Igual al mes pasado';
}

const mxn0 = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

/** Meta fija demo (MXN) para la tarjeta de gastos — alinear con API futura. */
const KPI_EXPENSE_TARGET_LABEL = 'Meta: 1000k';

/**
 * Desglose de tractores que **suma** `units.length`: disp. · en maniobra · mant. · otros
 */
function unitFleetLegend(units: readonly Unit[], trips: readonly Trip[]): string {
  const catalogIds = new Set(units.map((u) => u.id.trim()).filter(Boolean));
  const maintIds = new Set(
    units.filter((u) => normStatus(u.status) === 'maintenance').map((u) => u.id.trim()),
  );

  const activeTripUnitIds = new Set(
    trips
      .filter((t) => t.status === 'in_transit' || t.status === 'scheduled')
      .map((t) => t.unitId.trim())
      .filter((id) => id && catalogIds.has(id)),
  );

  const enManiobraIds = new Set<string>();
  for (const id of activeTripUnitIds) {
    if (!maintIds.has(id)) {
      enManiobraIds.add(id);
    }
  }
  for (const u of units) {
    const id = u.id.trim();
    if (!id || maintIds.has(id)) {
      continue;
    }
    const s = normStatus(u.status);
    if (s === 'in_use' || s === 'scheduled') {
      enManiobraIds.add(id);
    }
  }

  const disp = units.filter(
    (u) =>
      normStatus(u.status) === 'available' &&
      !enManiobraIds.has(u.id.trim()) &&
      !maintIds.has(u.id.trim()),
  ).length;

  const mant = maintIds.size;
  const enM = enManiobraIds.size;
  const otros = Math.max(0, units.length - disp - enM - mant);

  const parts: string[] = [`${disp} disp.`, `${enM} en maniobra.`, `${mant} mant.`];
  if (otros > 0) {
    parts.push(`${otros} otros`);
  }
  return parts.join(' · ');
}

/**
 * Desglose de remolques que **suma** `equipment.length`.
 */
function remolqueFleetLegend(equipment: readonly Equipment[], trips: readonly Trip[]): string {
  const catalogIds = new Set(equipment.map((e) => e.id.trim()).filter(Boolean));
  const maintIds = new Set(
    equipment
      .filter((e) => normStatus(e.status) === 'maintenance')
      .map((e) => e.id.trim()),
  );

  const activeTripEqIds = new Set<string>();
  for (const t of trips) {
    if (t.status !== 'in_transit' && t.status !== 'scheduled') {
      continue;
    }
    for (const raw of t.equipment ?? []) {
      const id = raw.trim();
      if (id && catalogIds.has(id)) {
        activeTripEqIds.add(id);
      }
    }
  }

  const enManiobraIds = new Set<string>();
  for (const id of activeTripEqIds) {
    if (!maintIds.has(id)) {
      enManiobraIds.add(id);
    }
  }
  for (const e of equipment) {
    const id = e.id.trim();
    if (!id || maintIds.has(id)) {
      continue;
    }
    const s = normStatus(e.status);
    if (s === 'in_use' || s === 'scheduled') {
      enManiobraIds.add(id);
    }
  }

  const disp = equipment.filter(
    (e) =>
      normStatus(e.status) === 'available' &&
      !enManiobraIds.has(e.id.trim()) &&
      !maintIds.has(e.id.trim()),
  ).length;

  const mant = maintIds.size;
  const enM = enManiobraIds.size;
  const otros = Math.max(0, equipment.length - disp - enM - mant);

  const parts: string[] = [`${disp} disp.`, `${enM} en maniobra.`, `${mant} mant.`];
  if (otros > 0) {
    parts.push(`${otros} otros`);
  }
  return parts.join(' · ');
}

/**
 * Cuatro KPIs del dashboard, calculados como haría un endpoint agregando
 * `trips`, `units`, `equipment` y `expenses`.
 */
export function buildDashboardKpisFromTables(input: {
  trips: readonly Trip[];
  units: readonly Unit[];
  equipment: readonly Equipment[];
  expenses: readonly Expense[];
  /** Referencia temporal (inyectable en tests). */
  now?: Date;
}): Alert[] {
  const now = input.now ?? new Date();
  const createdAt = now.toISOString();
  const trips = input.trips;
  const units = input.units;
  const equipment = input.equipment;
  const expenses = input.expenses;

  const inTransit = trips.filter((t) => t.status === 'in_transit').length;

  const pref = monthPrefix(now);
  const monthExpenses = expenses.filter(
    (e) =>
      e.currency === 'MXN' &&
      typeof e.incurredAt === 'string' &&
      e.incurredAt.startsWith(pref),
  );
  const expenseSum = monthExpenses.reduce((a, e) => a + e.amount, 0);

  const momLegend = monthOverMonthProgrammedLegend(trips, now);
  const unitLegend = unitFleetLegend(units, trips);
  const remolqueLegend = remolqueFleetLegend(equipment, trips);

  return [
    {
      id: 'kpi-maniobras-curso',
      severity: 'warning',
      title: 'Maniobras en curso',
      titleIcon: 'maniobras',
      message: String(inTransit),
      legend: momLegend,
      createdAt,
    },
    {
      id: 'kpi-unidades',
      severity: 'neutral',
      title: 'Unidades',
      titleIcon: 'units',
      message: String(units.length),
      legend: unitLegend,
      createdAt,
    },
    {
      id: 'kpi-equipos',
      severity: 'neutral',
      title: 'Remolques',
      titleIcon: 'equipment',
      message: String(equipment.length),
      legend: remolqueLegend,
      createdAt,
    },
    {
      id: 'kpi-gastos-costos',
      severity: 'neutral',
      title: 'Gastos del mes',
      titleIcon: 'revenue',
      message: mxn0.format(expenseSum),
      legend: KPI_EXPENSE_TARGET_LABEL,
      createdAt,
    },
  ];
}

export { tripCompletionDayLocal, localYmd };
