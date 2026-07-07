/** Días antes del vencimiento en que se habilita registrar el pago del ciclo. */
export const INSURANCE_PAYMENT_CONFIRM_WINDOW_DAYS = 10;

export type FleetInsurancePaymentMeta = {
  insurancePolicyNumber?: string;
  insuranceCarrierName?: string;
  insuranceContractDate?: string;
  insuranceLastPaymentDate?: string;
  insurancePaymentCadence?: string;
  insuranceCost?: number;
};

function parseYmd(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    return null;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function cadenceToMonths(cad: string | undefined): number {
  const raw = (cad ?? '').trim().toLowerCase();
  if (raw === 'weekly' || raw === 'semanal') {
    return 0;
  }
  if (raw === 'monthly' || raw === 'mensual') {
    return 1;
  }
  if (raw === 'quarterly' || raw === 'trimestral') {
    return 3;
  }
  if (raw === 'annual' || raw === 'anual') {
    return 12;
  }
  return 12;
}

/** Ancla del ciclo: último pago registrado o, si no hay, fecha de contratación. */
export function insurancePaymentAnchor(
  meta: FleetInsurancePaymentMeta | undefined,
): string | null {
  const last = meta?.insuranceLastPaymentDate?.trim();
  if (last) {
    return last;
  }
  const contract = meta?.insuranceContractDate?.trim();
  return contract || null;
}

export function nextInsurancePaymentDate(
  meta: FleetInsurancePaymentMeta | undefined,
): Date | null {
  const iso = insurancePaymentAnchor(meta);
  if (!iso) {
    return null;
  }
  const start = parseYmd(iso);
  if (!start) {
    return null;
  }
  const months = cadenceToMonths(meta?.insurancePaymentCadence);
  return months === 0
    ? new Date(start.getTime() + 7 * 86400000)
    : addMonths(start, months);
}

export function daysUntilInsurancePayment(
  meta: FleetInsurancePaymentMeta | undefined,
  today: Date = startOfToday(),
): number | null {
  const next = nextInsurancePaymentDate(meta);
  if (!next) {
    return null;
  }
  const ms = next.getTime() - today.getTime();
  return Math.round(ms / 86400000);
}

export function hasInsuranceBillingSchedule(
  meta: FleetInsurancePaymentMeta | undefined,
): boolean {
  if (!insurancePaymentAnchor(meta)) {
    return false;
  }
  const cost = meta?.insuranceCost;
  return cost != null && Number.isFinite(cost) && cost > 0;
}

export function canConfirmInsurancePayment(
  meta: FleetInsurancePaymentMeta | undefined,
  today?: Date,
): boolean {
  if (!hasInsuranceBillingSchedule(meta)) {
    return false;
  }
  const days = daysUntilInsurancePayment(meta, today);
  return days != null && days <= INSURANCE_PAYMENT_CONFIRM_WINDOW_DAYS;
}

export function insurancePaymentConfirmHint(
  meta: FleetInsurancePaymentMeta | undefined,
  today?: Date,
): string {
  const days = daysUntilInsurancePayment(meta, today);
  if (days == null) {
    return '';
  }
  if (days < 0) {
    return 'El pago está vencido. Regístralo para actualizar.';
  }
  if (days === 0) {
    return 'El pago del ciclo vence hoy.';
  }
  if (days === 1) {
    return 'El pago del ciclo vence mañana.';
  }
  return `El pago del ciclo vence en ${days} días.`;
}
