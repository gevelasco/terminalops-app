export type OperatorPaymentSchedule =
  | 'maneuver'
  | 'weekly'
  | 'biweekly'
  | 'monthly';

export function normalizeOperatorPaymentSchedule(
  raw: string | null | undefined,
): OperatorPaymentSchedule {
  if (raw === 'weekly' || raw === 'biweekly' || raw === 'monthly') {
    return raw;
  }
  return 'maneuver';
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`);
}

function lastDayOfMonthYmd(year: number, monthIndex: number): string {
  return localYmd(new Date(year, monthIndex + 1, 0, 12, 0, 0));
}

function monthPayCandidates(year: number, monthIndex: number): string[] {
  const ym = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  return [`${ym}-15`, lastDayOfMonthYmd(year, monthIndex)];
}

export function nextWeeklyPayDueYmd(asOfYmd: string): string {
  const d = parseYmd(asOfYmd);
  const day = d.getDay();
  const daysUntilSaturday = day === 6 ? 0 : (6 - day + 7) % 7;
  d.setDate(d.getDate() + daysUntilSaturday);
  return localYmd(d);
}

export function previousWeeklyPayDueYmd(asOfYmd: string): string | null {
  const d = parseYmd(asOfYmd);
  const day = d.getDay();
  const daysSinceSaturday = day === 6 ? 7 : (day + 1) % 7 || 7;
  d.setDate(d.getDate() - daysSinceSaturday);
  return localYmd(d);
}

export function nextBiweeklyPayDueYmd(asOfYmd: string): string {
  const start = parseYmd(asOfYmd);
  let year = start.getFullYear();
  let month = start.getMonth();
  for (let i = 0; i < 24; i += 1) {
    for (const candidate of monthPayCandidates(year, month)) {
      if (candidate >= asOfYmd) {
        return candidate;
      }
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return asOfYmd;
}

export function previousBiweeklyPayDueYmd(asOfYmd: string): string | null {
  const start = parseYmd(asOfYmd);
  let year = start.getFullYear();
  let month = start.getMonth();
  const prior: string[] = [];
  for (let i = 0; i < 24; i += 1) {
    prior.push(...monthPayCandidates(year, month));
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  const filtered = prior.filter((ymd) => ymd < asOfYmd).sort();
  return filtered.length > 0 ? filtered[filtered.length - 1]! : null;
}

export function nextMonthlyPayDueYmd(asOfYmd: string): string {
  const start = parseYmd(asOfYmd);
  let year = start.getFullYear();
  let month = start.getMonth();
  for (let i = 0; i < 24; i += 1) {
    const candidate = lastDayOfMonthYmd(year, month);
    if (candidate >= asOfYmd) {
      return candidate;
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return asOfYmd;
}

export function previousMonthlyPayDueYmd(asOfYmd: string): string | null {
  const start = parseYmd(asOfYmd);
  let year = start.getFullYear();
  let month = start.getMonth();
  const prior: string[] = [];
  for (let i = 0; i < 24; i += 1) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    prior.push(lastDayOfMonthYmd(year, month));
  }
  const filtered = prior.filter((ymd) => ymd < asOfYmd).sort();
  return filtered.length > 0 ? filtered[filtered.length - 1]! : null;
}

export function nextPeriodicPayDueYmd(
  schedule: Exclude<OperatorPaymentSchedule, 'maneuver'>,
  asOfYmd: string,
): string {
  switch (schedule) {
    case 'weekly':
      return nextWeeklyPayDueYmd(asOfYmd);
    case 'biweekly':
      return nextBiweeklyPayDueYmd(asOfYmd);
    case 'monthly':
      return nextMonthlyPayDueYmd(asOfYmd);
  }
}

export function previousPeriodicPayDueYmd(
  schedule: Exclude<OperatorPaymentSchedule, 'maneuver'>,
  asOfYmd: string,
): string | null {
  switch (schedule) {
    case 'weekly':
      return previousWeeklyPayDueYmd(asOfYmd);
    case 'biweekly':
      return previousBiweeklyPayDueYmd(asOfYmd);
    case 'monthly':
      return previousMonthlyPayDueYmd(asOfYmd);
  }
}

export function tripCompletionAnchorYmd(trip: {
  returnAt?: string | null;
  plannedCompletionAt?: string | null;
  completedAt?: string | null;
  arrivedAt?: string | null;
}): string | null {
  for (const value of [
    trip.returnAt,
    trip.completedAt,
    trip.arrivedAt,
    trip.plannedCompletionAt,
  ]) {
    if (!value?.trim()) {
      continue;
    }
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return localYmd(d);
    }
  }
  return null;
}

export function resolveOperatorPayAlertDueYmd(
  schedule: OperatorPaymentSchedule,
  asOfYmd: string,
  unpaidTripCompletionYmds: readonly string[],
): string | null {
  if (unpaidTripCompletionYmds.length === 0) {
    return null;
  }

  if (schedule === 'maneuver') {
    return [...unpaidTripCompletionYmds].sort()[0] ?? null;
  }

  const previous = previousPeriodicPayDueYmd(schedule, asOfYmd);
  const hasOverdueCycle =
    previous != null &&
    previous < asOfYmd &&
    unpaidTripCompletionYmds.some((ymd) => ymd <= previous);

  if (hasOverdueCycle) {
    return previous;
  }

  return nextPeriodicPayDueYmd(schedule, asOfYmd);
}

export function resolveTripPayRowDueYmd(
  schedule: OperatorPaymentSchedule,
  asOfYmd: string,
  tripCompletionYmd: string | null,
  batchDueYmd: string | null,
): string {
  if (schedule === 'maneuver') {
    return tripCompletionYmd ?? asOfYmd;
  }
  return batchDueYmd ?? tripCompletionYmd ?? asOfYmd;
}
