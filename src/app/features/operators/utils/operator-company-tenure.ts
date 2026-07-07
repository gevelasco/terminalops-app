type TenureParts = { years: number; months: number; days: number };

function parseHireDate(hireIso: string): Date | null {
  const t = hireIso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return null;
  }
  const hire = new Date(`${t}T12:00:00`);
  return Number.isNaN(hire.getTime()) ? null : hire;
}

function todayAtNoon(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

function tenureParts(hire: Date, today: Date): TenureParts | null {
  let totalMonths =
    (today.getFullYear() - hire.getFullYear()) * 12 +
    (today.getMonth() - hire.getMonth());
  if (today.getDate() < hire.getDate()) {
    totalMonths -= 1;
  }
  if (totalMonths < 0) {
    return null;
  }

  const anchor = new Date(
    hire.getFullYear(),
    hire.getMonth(),
    hire.getDate(),
    12,
    0,
    0,
  );
  anchor.setMonth(anchor.getMonth() + totalMonths);

  const days = Math.max(
    0,
    Math.floor((today.getTime() - anchor.getTime()) / 86_400_000),
  );

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days,
  };
}

function spanishUnit(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString('es-MX')} ${n === 1 ? singular : plural}`;
}

function joinEsParts(parts: string[]): string {
  if (parts.length === 0) {
    return '—';
  }
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length === 2) {
    return `${parts[0]} y ${parts[1]}`;
  }
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

/** Días completos desde la fecha de ingreso (ISO `YYYY-MM-DD`). */
export function companyTenureDays(hireIso: string): number | null {
  const hire = parseHireDate(hireIso);
  if (!hire) {
    return null;
  }
  const today = todayAtNoon();
  const hireDay = new Date(
    hire.getFullYear(),
    hire.getMonth(),
    hire.getDate(),
    12,
    0,
    0,
  );
  const diffMs = today.getTime() - hireDay.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  return days >= 0 ? days : null;
}

/** Antigüedad legible (es-MX) desde fecha de ingreso ISO `YYYY-MM-DD`. */
export function companyTenureLabelEs(hireIso: string): string {
  const hire = parseHireDate(hireIso);
  if (!hire) {
    return '—';
  }
  const parts = tenureParts(hire, todayAtNoon());
  if (!parts) {
    return '—';
  }
  const labels: string[] = [];
  if (parts.years > 0) {
    labels.push(spanishUnit(parts.years, 'año', 'años'));
  }
  if (parts.months > 0) {
    labels.push(spanishUnit(parts.months, 'mes', 'meses'));
  }
  if (labels.length === 0) {
    return spanishUnit(0, 'mes', 'meses');
  }
  return joinEsParts(labels);
}

/** Antigüedad con meses y días residuales (es-MX), p. ej. «2 meses y 17 días». */
export function companyTenureMonthsDaysLabelEs(hireIso: string): string {
  const hire = parseHireDate(hireIso);
  if (!hire) {
    return '—';
  }
  const parts = tenureParts(hire, todayAtNoon());
  if (!parts) {
    return '—';
  }

  const labels: string[] = [];
  if (parts.years > 0) {
    labels.push(spanishUnit(parts.years, 'año', 'años'));
  }
  if (parts.months > 0) {
    labels.push(spanishUnit(parts.months, 'mes', 'meses'));
  }
  if (parts.days > 0) {
    labels.push(spanishUnit(parts.days, 'día', 'días'));
  }

  if (labels.length === 0) {
    return spanishUnit(0, 'día', 'días');
  }
  return joinEsParts(labels);
}
