export type CyclicRenewalStatus = 'due' | 'soon' | 'ok';

export interface CyclicRenewalHint {
  readonly status: CyclicRenewalStatus;
  readonly nextDate: Date;
  readonly nextDateLabel: string;
  readonly daysUntil: number;
}

const CADENCE_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
};

/**
 * Ventana (en días) para avisar que el pago/renovación se acerca. Escala con
 * la periodicidad para no alertar con la misma anticipación en un pago mensual
 * que en uno trimestral o anual.
 */
const CADENCE_SOON_WINDOW_DAYS: Record<string, number> = {
  weekly: 2,
  monthly: 7,
  quarterly: 21,
  annual: 45,
};

const WEEK_MS = 7 * 86400000;

function parseYmd(s: string): Date | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return null;
  }
  const d = new Date(`${t}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

/** Avanza desde la fecha de contratación hasta el próximo pago/renovación >= hoy. */
function nextCycleDate(start: Date, cadence: string, today: Date): Date {
  if (cadence === 'weekly') {
    let next = new Date(start.getTime() + WEEK_MS);
    if (startOfDay(next) < today) {
      const weeks = Math.max(1, Math.ceil((today.getTime() - start.getTime()) / WEEK_MS));
      next = new Date(start.getTime() + weeks * WEEK_MS);
      while (startOfDay(next) < today) {
        next = new Date(next.getTime() + WEEK_MS);
      }
    }
    return next;
  }

  const step = CADENCE_MONTHS[cadence] ?? 12;
  let periods = 1;
  let next = addMonths(start, step * periods);
  while (startOfDay(next) < today) {
    periods += 1;
    next = addMonths(start, step * periods);
  }
  return next;
}

/**
 * Calcula la próxima fecha de pago/renovación real dentro del ciclo indicado
 * (avanzando periodo por periodo desde la contratación) y devuelve un aviso
 * solo cuando esa fecha se aproxima según la periodicidad.
 */
export function cyclicRenewalHint(iso: string, cadence: string): CyclicRenewalHint | null {
  const start = parseYmd(iso);
  if (!start) {
    return null;
  }
  const today = startOfDay(new Date());
  const nextDate = nextCycleDate(start, cadence, today);
  const daysUntil = daysBetween(today, nextDate);
  const window = CADENCE_SOON_WINDOW_DAYS[cadence] ?? 30;

  const status: CyclicRenewalStatus =
    daysUntil < 0 ? 'due' : daysUntil <= window ? 'soon' : 'ok';

  return {
    status,
    nextDate,
    nextDateLabel: new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(nextDate),
    daysUntil,
  };
}
