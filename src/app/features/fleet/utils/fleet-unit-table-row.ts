import { TRAILER_BRAND_OPTIONS } from '@app/mock-data/trailer-brands';
import { Unit, UnitFleetMeta } from '@shared/models/logistics.models';

export type FleetRenewalBucket = 'ok' | 'soon' | 'due' | 'na';

export type FleetOperationalKey =
  | 'on_route'
  | 'available'
  | 'in_use'
  | 'maintenance'
  | 'scheduled'
  | 'unknown';

function parseYmd(s: string): Date | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return null;
  }
  const d = new Date(t + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function daysFromToday(target: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target.getTime());
  t.setHours(0, 0, 0, 0);
  return Math.ceil((t.getTime() - today.getTime()) / 86400000);
}

function fmtMx(d: Date): string {
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function lineRenewal(
  label: string,
  iso: string | undefined,
  cycleMonths: number,
): string {
  const raw = iso?.trim();
  if (!raw) {
    return `${label}: sin fecha.`;
  }
  const start = parseYmd(raw);
  if (!start) {
    return `${label}: fecha no válida (${raw}).`;
  }
  const next = addMonths(start, cycleMonths);
  const d = daysFromToday(next);
  const nextFmt = fmtMx(next);
  if (d < 0) {
    return `Próxima: ${nextFmt}. ${label}: vencida (hace ${-d} días). Última: ${raw}.`;
  }
  if (d <= 45) {
    return `Próxima: ${nextFmt}. ${label}: en ${d} días (ventana próxima). Última: ${raw}.`;
  }
  return `Próxima: ${nextFmt}. ${label}: al corriente (en ${d} días). Última: ${raw}.`;
}

function maintTooltip(meta: UnitFleetMeta | undefined): string {
  const iso = meta?.lastMaintenanceDate?.trim();
  if (!iso) {
    return 'Sin fecha de último mantenimiento. El icono en gris indica «sin dato». Registra la fecha al dar de alta la unidad.';
  }
  const start = parseYmd(iso);
  if (!start) {
    return `Fecha de mantenimiento no válida (${iso}).`;
  }
  const next = addMonths(start, 6);
  const d = daysFromToday(next);
  const nextFmt = fmtMx(next);
  if (d < 0) {
    return `Próxima revisión sugerida: ${nextFmt}. Último mantenimiento: ${iso}. Vencida hace ${-d} días (ciclo 6 meses).`;
  }
  if (d <= 45) {
    return `Próxima revisión sugerida: ${nextFmt}. Último mantenimiento: ${iso}. En ${d} días (amarillo = próximo).`;
  }
  return `Próxima revisión sugerida: ${nextFmt}. Último mantenimiento: ${iso}. En ${d} días (al corriente).`;
}

function verificationTooltip(meta: UnitFleetMeta | undefined): string {
  const parts = [
    lineRenewal('Físico-mecánica', meta?.verificationPhysMechDate, 6),
    lineRenewal('Emisiones', meta?.verificationEmissionsDate, 6),
  ];
  if (meta?.verificationDoubleArticulatedApplies === true) {
    parts.push(
      lineRenewal('Doble articulado', meta?.verificationDoubleArticulatedDate, 6),
    );
  }
  return parts.join(' ');
}

function insuranceTooltip(meta: UnitFleetMeta | undefined): string {
  const policy = meta?.insurancePolicyNumber?.trim();
  const iso = meta?.insuranceContractDate?.trim();
  const cad = meta?.insurancePaymentCadence ?? 'annual';
  if (!policy && !iso) {
    return 'Sin póliza ni fecha de contrato. Icono en gris = sin dato.';
  }
  if (!iso) {
    return `Póliza ${policy ?? '—'}. Sin fecha de contrato; se considera vigente con la información disponible.`;
  }
  const start = parseYmd(iso);
  if (!start) {
    return `Póliza ${policy ?? '—'}. Fecha de contrato no válida (${iso}).`;
  }
  const months = cadenceToMonths(cad);
  const next =
    months === 0
      ? new Date(start.getTime() + 7 * 86400000)
      : addMonths(start, months);
  const d = daysFromToday(next);
  const nextFmt = fmtMx(next);
  const cadLabel =
    cad === 'weekly'
      ? 'semanal'
      : cad === 'monthly'
        ? 'mensual'
        : cad === 'quarterly'
          ? 'trimestral'
          : 'anual';
  if (d < 0) {
    return `Próximo pago: ${nextFmt} (${cadLabel}). Póliza ${policy ?? '—'}. Vencido hace ${-d} días (café = atención). Contrato: ${iso}.`;
  }
  if (d <= 30) {
    return `Próximo pago: ${nextFmt} (${cadLabel}). Póliza ${policy ?? '—'}. En ${d} días (amarillo = próximo). Contrato: ${iso}.`;
  }
  return `Próximo pago: ${nextFmt} (${cadLabel}). Póliza ${policy ?? '—'}. En ${d} días (al corriente). Contrato: ${iso}.`;
}

/** Próxima fecha = última + `cycleMonths`; pronto ≤45 d, vencido &lt;0. */
export function renewalBucket(
  iso: string | undefined,
  cycleMonths: number,
): FleetRenewalBucket {
  const start = iso ? parseYmd(iso) : null;
  if (!start) {
    return 'na';
  }
  const next = addMonths(start, cycleMonths);
  const d = daysFromToday(next);
  if (d < 0) {
    return 'due';
  }
  if (d <= 45) {
    return 'soon';
  }
  return 'ok';
}

function rank(b: FleetRenewalBucket): number {
  switch (b) {
    case 'due':
      return 3;
    case 'soon':
      return 2;
    case 'ok':
      return 1;
    default:
      return 0;
  }
}

function worstBucket(...buckets: FleetRenewalBucket[]): FleetRenewalBucket {
  let best: FleetRenewalBucket = 'na';
  let r = -1;
  for (const b of buckets) {
    const x = rank(b);
    if (x > r) {
      r = x;
      best = b;
    }
  }
  return best;
}

function trailerBrandLabel(u: Unit): string {
  const name = u.fleetMeta?.trailerBrandName?.trim();
  if (name) {
    return name;
  }
  const abbr = u.trailerBrandAbbr?.trim();
  if (!abbr) {
    return '—';
  }
  return TRAILER_BRAND_OPTIONS.find((o) => o.value === abbr)?.label ?? abbr;
}

function modelLabel(u: Unit): string {
  const y = (u.trailerYear ?? '').trim();
  const ver = u.fleetMeta?.trailerVersion?.trim();
  const parts = [y, ver].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

function operationalKey(u: Unit, onRoute: boolean): FleetOperationalKey {
  if (onRoute) {
    return 'on_route';
  }
  const s = (u.status ?? '').trim().toLowerCase();
  switch (s) {
    case 'available':
      return 'available';
    case 'in_use':
      return 'in_use';
    case 'maintenance':
      return 'maintenance';
    case 'scheduled':
      return 'scheduled';
    default:
      return 'unknown';
  }
}

function maintenanceBucket(meta: UnitFleetMeta | undefined): FleetRenewalBucket {
  return renewalBucket(meta?.lastMaintenanceDate, 6);
}

function verificationBucket(meta: UnitFleetMeta | undefined): FleetRenewalBucket {
  const phys = renewalBucket(meta?.verificationPhysMechDate, 6);
  const emis = renewalBucket(meta?.verificationEmissionsDate, 6);
  const doubleApplies = meta?.verificationDoubleArticulatedApplies === true;
  const doubleDate = meta?.verificationDoubleArticulatedDate?.trim();
  if (doubleApplies) {
    const double = !doubleDate ? 'due' : renewalBucket(doubleDate, 6);
    return worstBucket(phys, emis, double);
  }
  if (phys === 'na' && emis === 'na') {
    return 'na';
  }
  return worstBucket(phys, emis);
}

function cadenceToMonths(cad: string | undefined): number {
  switch (cad) {
    case 'weekly':
      return 0;
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'annual':
    default:
      return 12;
  }
}

function insuranceBucket(meta: UnitFleetMeta | undefined): FleetRenewalBucket {
  const policy = meta?.insurancePolicyNumber?.trim();
  const iso = meta?.insuranceContractDate?.trim();
  if (!policy && !iso) {
    return 'na';
  }
  if (!iso) {
    return 'ok';
  }
  const start = parseYmd(iso);
  if (!start) {
    return 'ok';
  }
  const months = cadenceToMonths(meta?.insurancePaymentCadence);
  let next: Date;
  if (months === 0) {
    next = new Date(start.getTime() + 7 * 86400000);
  } else {
    next = addMonths(start, months);
  }
  const d = daysFromToday(next);
  if (d < 0) {
    return 'due';
  }
  if (d <= 30) {
    return 'soon';
  }
  return 'ok';
}

export function fleetMaintenanceRenewal(meta: UnitFleetMeta | undefined): FleetRenewalBucket {
  return maintenanceBucket(meta);
}

export function fleetVerificationRenewal(meta: UnitFleetMeta | undefined): FleetRenewalBucket {
  return verificationBucket(meta);
}

export function fleetInsuranceRenewal(meta: UnitFleetMeta | undefined): FleetRenewalBucket {
  return insuranceBucket(meta);
}

/** Fecha ISO `YYYY-MM-DD` a etiqueta corta es-MX, o `—`. */
export function formatFleetYmdMx(iso: string | undefined): string {
  const raw = iso?.trim();
  if (!raw) {
    return '—';
  }
  const d = parseYmd(raw);
  return d ? fmtMx(d) : raw;
}

const VERIF_CYCLE_MO = 6;
const MAINT_CYCLE_MO = 6;

function nextCycleDate(iso: string | undefined, cycleMonths: number): Date | null {
  const raw = iso?.trim();
  if (!raw) {
    return null;
  }
  const start = parseYmd(raw);
  if (!start) {
    return null;
  }
  return addMonths(start, cycleMonths);
}

function nextInsurancePaymentDate(meta: UnitFleetMeta | undefined): Date | null {
  const iso = meta?.insuranceContractDate?.trim();
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

/** Fecha próxima (solo etiqueta localizada) para celda de tabla: mantenimiento. */
export function nextMaintenanceTableDate(meta: UnitFleetMeta | undefined): string | null {
  const d = nextCycleDate(meta?.lastMaintenanceDate, MAINT_CYCLE_MO);
  return d ? fmtMx(d) : null;
}

/** La verificación que venza antes (misma cadencia 6 meses que el icono). */
export function nextVerificationTableDate(meta: UnitFleetMeta | undefined): string | null {
  const dates: Date[] = [];
  const push = (iso: string | undefined) => {
    const d = nextCycleDate(iso, VERIF_CYCLE_MO);
    if (d) {
      dates.push(d);
    }
  };
  push(meta?.verificationPhysMechDate);
  push(meta?.verificationEmissionsDate);
  if (meta?.verificationDoubleArticulatedApplies === true) {
    push(meta?.verificationDoubleArticulatedDate);
  }
  if (!dates.length) {
    return null;
  }
  const earliest = dates.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
  return fmtMx(earliest);
}

/** Próximo pago de seguro (solo fecha) para celda de tabla. */
export function nextInsuranceTableDate(meta: UnitFleetMeta | undefined): string | null {
  const next = nextInsurancePaymentDate(meta);
  return next ? fmtMx(next) : null;
}

/** Texto corto para UI: siguiente vencimiento a N meses desde la última fecha ISO. */
export function nextCycleFormatted(
  iso: string | undefined,
  cycleMonths: number,
): string | null {
  const next = nextCycleDate(iso, cycleMonths);
  return next ? `Próxima: ${fmtMx(next)}` : null;
}

/** Próxima fecha de pago según contrato y cadencia (misma lógica que el icono de seguro). */
export function nextInsurancePaymentFormatted(meta: UnitFleetMeta | undefined): string | null {
  const next = nextInsurancePaymentDate(meta);
  return next ? `Próximo pago: ${fmtMx(next)}` : null;
}

export function buildFleetUnitTableRow(
  u: Unit,
  options: { onRoute: boolean },
): Record<string, unknown> {
  const meta = u.fleetMeta;
  return {
    id: u.id,
    fleetBrand: trailerBrandLabel(u),
    fleetModel: modelLabel(u),
    fleetPlate: u.plate.trim() || '—',
    fleetOperational: operationalKey(u, options.onRoute),
    fleetMaint: maintenanceBucket(meta),
    fleetVerif: verificationBucket(meta),
    fleetIns: insuranceBucket(meta),
    fleetMaintTip: maintTooltip(meta),
    fleetVerifTip: verificationTooltip(meta),
    fleetInsTip: insuranceTooltip(meta),
    fleetMaintNext: nextMaintenanceTableDate(meta),
    fleetVerifNext: nextVerificationTableDate(meta),
    fleetInsNext: nextInsuranceTableDate(meta),
  };
}
