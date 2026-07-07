/** Días antes del vencimiento en que se habilita registrar el pago del ciclo GPS. */
export const GPS_PAYMENT_CONFIRM_WINDOW_DAYS = 10;

export type FleetGpsPaymentMeta = {
  hasGps?: boolean;
  gpsProviderBrand?: string;
  gpsContractDate?: string;
  gpsLastPaymentDate?: string;
  gpsPaymentCadence?: string;
  gpsPrice?: number;
};

export function gpsFleetFormHasContent(fields: {
  brand?: string;
  contractDate?: string;
  price?: string;
  portal?: string;
}): boolean {
  return !!(
    fields.brand?.trim() ||
    fields.contractDate?.trim() ||
    fields.price?.trim() ||
    fields.portal?.trim()
  );
}

export function gpsFleetMetaIsActive(meta: FleetGpsPaymentMeta | undefined): boolean {
  if (meta?.hasGps === true) {
    return true;
  }
  if (meta?.hasGps === false) {
    return false;
  }
  return !!(
    meta?.gpsProviderBrand?.trim() ||
    meta?.gpsContractDate?.trim() ||
    (meta?.gpsPrice != null && Number.isFinite(meta.gpsPrice) && meta.gpsPrice > 0)
  );
}

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

export function gpsPaymentAnchor(meta: FleetGpsPaymentMeta | undefined): string | null {
  const last = meta?.gpsLastPaymentDate?.trim();
  if (last) {
    return last;
  }
  const contract = meta?.gpsContractDate?.trim();
  return contract || null;
}

export function nextGpsPaymentDate(meta: FleetGpsPaymentMeta | undefined): Date | null {
  if (!gpsFleetMetaIsActive(meta)) {
    return null;
  }
  const iso = gpsPaymentAnchor(meta);
  if (!iso) {
    return null;
  }
  const start = parseYmd(iso);
  if (!start) {
    return null;
  }
  const months = cadenceToMonths(meta?.gpsPaymentCadence);
  return months === 0
    ? new Date(start.getTime() + 7 * 86400000)
    : addMonths(start, months);
}

export function daysUntilGpsPayment(
  meta: FleetGpsPaymentMeta | undefined,
  today: Date = startOfToday(),
): number | null {
  const next = nextGpsPaymentDate(meta);
  if (!next) {
    return null;
  }
  const ms = next.getTime() - today.getTime();
  return Math.round(ms / 86400000);
}

export function hasGpsBillingSchedule(meta: FleetGpsPaymentMeta | undefined): boolean {
  if (!gpsFleetMetaIsActive(meta) || !gpsPaymentAnchor(meta)) {
    return false;
  }
  const price = meta?.gpsPrice;
  return price != null && Number.isFinite(price) && price > 0;
}

export function canConfirmGpsPayment(
  meta: FleetGpsPaymentMeta | undefined,
  today?: Date,
): boolean {
  if (!hasGpsBillingSchedule(meta)) {
    return false;
  }
  const days = daysUntilGpsPayment(meta, today);
  return days != null && days <= GPS_PAYMENT_CONFIRM_WINDOW_DAYS;
}

export function gpsPaymentConfirmHint(
  meta: FleetGpsPaymentMeta | undefined,
  today?: Date,
): string {
  const days = daysUntilGpsPayment(meta, today);
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
