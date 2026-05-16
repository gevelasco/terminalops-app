import type { Trip } from '@shared/models/logistics.models';

export interface ClientManeuverVolumeSummary {
  hasData: boolean;
  /** Meses calendario entre la primera y la última maniobra contabilizada (mínimo 1). */
  monthsWindow: number;
  /** Maniobras con cobro al cliente y válidas para promedios (mismo subconjunto que rentabilidad). */
  billableManeuverCount: number;
  /** Todas las maniobras (filas de viaje) con este `clientId` en el arreglo cargado. */
  allManeuverCount: number;
  maneuversPerMonth: number;
  billedPerMonth: number;
  operationalPerMonth: number;
  profitPerMonth: number;
}

function parseMoney(raw: string | undefined): number {
  if (raw == null || !String(raw).trim()) {
    return 0;
  }
  const n = Number(String(raw).replace(/\s/g, '').replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function tripMatchesClient(t: Trip, clientId: string): boolean {
  const id = clientId.trim();
  if (!id) {
    return false;
  }
  return (t.clientId ?? '').trim() === id;
}

/** Incluye cobro pactado; excluye canceladas «reales» sin cobro en falso. */
function isBillableForVolumeSummary(t: Trip): boolean {
  if (t.hasClientBilling === false) {
    return false;
  }
  if (t.status === 'cancelled' && t.falseManeuver !== true) {
    return false;
  }
  return true;
}

function parseProgrammedUtc(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Meses calendario inclusivos (UTC) entre dos fechas. */
function calendarMonthsInclusiveUtc(a: Date, b: Date): number {
  const t1 = a.getTime();
  const t2 = b.getTime();
  const lo = t1 <= t2 ? a : b;
  const hi = t1 <= t2 ? b : a;
  const months =
    (hi.getUTCFullYear() - lo.getUTCFullYear()) * 12 +
    (hi.getUTCMonth() - lo.getUTCMonth());
  return months + 1;
}

/**
 * Promedios mensuales simples a partir de maniobras del cliente (`clientId` =
 * id del catálogo). Usa `programmedAt` para la ventana de meses y suma
 * `clientCharge` y costos operativos (`dieselAmount`, `casetasAmount`, `operatorQuota`).
 */
export function buildClientManeuverVolumeSummary(
  clientId: string,
  trips: readonly Trip[],
): ClientManeuverVolumeSummary {
  const allManeuverCount = trips.filter((t) => tripMatchesClient(t, clientId)).length;

  const subset = trips.filter(
    (t) => tripMatchesClient(t, clientId) && isBillableForVolumeSummary(t),
  );

  let billedTotal = 0;
  let opsTotal = 0;
  for (const t of subset) {
    billedTotal += parseMoney(t.clientCharge);
    opsTotal +=
      parseMoney(t.dieselAmount) +
      parseMoney(t.casetasAmount) +
      parseMoney(t.operatorQuota);
  }

  const n = subset.length;

  if (n === 0) {
    return {
      hasData: false,
      monthsWindow: 0,
      billableManeuverCount: 0,
      allManeuverCount,
      maneuversPerMonth: 0,
      billedPerMonth: 0,
      operationalPerMonth: 0,
      profitPerMonth: 0,
    };
  }

  const dates: Date[] = [];
  for (const t of subset) {
    const d = parseProgrammedUtc(t.programmedAt);
    if (d) {
      dates.push(d);
    }
  }
  if (dates.length === 0) {
    return {
      hasData: false,
      monthsWindow: 0,
      billableManeuverCount: n,
      allManeuverCount,
      maneuversPerMonth: 0,
      billedPerMonth: 0,
      operationalPerMonth: 0,
      profitPerMonth: 0,
    };
  }

  const minT = Math.min(...dates.map((d) => d.getTime()));
  const maxT = Math.max(...dates.map((d) => d.getTime()));
  const min = new Date(minT);
  const max = new Date(maxT);
  const monthsWindow = Math.max(1, calendarMonthsInclusiveUtc(min, max));

  const billedPerMonth = billedTotal / monthsWindow;
  const operationalPerMonth = opsTotal / monthsWindow;
  const profitPerMonth = billedPerMonth - operationalPerMonth;

  return {
    hasData: true,
    monthsWindow,
    billableManeuverCount: n,
    allManeuverCount,
    maneuversPerMonth: n / monthsWindow,
    billedPerMonth,
    operationalPerMonth,
    profitPerMonth,
  };
}
