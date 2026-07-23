import type { WritableSignal } from '@angular/core';
import { effect } from '@angular/core';
import {
  isSecondTrailerForUnitHitchSlot,
  unitHitchSlotForNewEquipment,
} from '@shared/utils/fleet/equipment-hitch-assignment';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';
import { stripGroupedNumber } from '@shared/utils/format-grouped-number';

/** Fecha local YYYY-MM-DD (medianoche local). */
export function fleetDrawerTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Año modelo mínimo aceptado en unidades/equipos. */
export const FLEET_MODEL_YEAR_MIN = 1950;

export type FleetModelYearParseResult =
  | { ok: true; year: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'too_old' | 'too_new' };

/** Valida Modelo (año): dígitos, ≥ 1950 y ≤ año actual + 1. */
export function parseFleetModelYear(raw: string): FleetModelYearParseResult {
  const digits = parseFleetRequiredDigits(raw, { maxLength: 4 });
  if (digits === 'empty') {
    return { ok: false, reason: 'empty' };
  }
  if (digits === 'invalid') {
    return { ok: false, reason: 'invalid' };
  }
  const yearNum = Number(digits);
  const maxYear = new Date().getFullYear() + 1;
  if (yearNum < FLEET_MODEL_YEAR_MIN) {
    return { ok: false, reason: 'too_old' };
  }
  if (yearNum > maxYear) {
    return { ok: false, reason: 'too_new' };
  }
  return { ok: true, year: digits };
}

export function fleetModelYearErrorMessage(
  reason: Exclude<FleetModelYearParseResult, { ok: true }>['reason'],
): string {
  const maxYear = new Date().getFullYear() + 1;
  switch (reason) {
    case 'empty':
      return 'Modelo (año) es obligatorio.';
    case 'invalid':
      return 'Modelo (año) debe ser un número de máximo 4 dígitos.';
    case 'too_old':
      return `Modelo (año) no puede ser menor a ${FLEET_MODEL_YEAR_MIN}.`;
    case 'too_new':
      return `Modelo (año) no puede ser mayor a ${maxYear}.`;
  }
}

export function parseFleetOptionalAmount(raw: string): number | undefined | 'invalid' {
  const t = stripGroupedNumber(raw);
  if (t === '') {
    return undefined;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    return 'invalid';
  }
  return n;
}

export function parseFleetPositiveKm(raw: string): number | 'invalid' {
  const t = stripGroupedNumber(raw);
  if (t === '') {
    return 'invalid';
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) {
    return 'invalid';
  }
  return n;
}

/** Valor obligatorio compuesto solo de dígitos (p. ej. año modelo, máx. 4). */
export function parseFleetRequiredDigits(
  raw: string,
  options?: { maxLength?: number },
): string | 'invalid' | 'empty' {
  const t = raw.trim();
  if (t === '') {
    return 'empty';
  }
  if (!/^\d+$/.test(t)) {
    return 'invalid';
  }
  const max = options?.maxLength;
  if (max != null && t.length > max) {
    return 'invalid';
  }
  return t;
}

export function parseFleetOptionalPositiveInt(raw: string): number | undefined | 'invalid' {
  const t = raw.trim();
  if (t === '') {
    return undefined;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return 'invalid';
  }
  return n;
}

export function fleetValueFromLabel(
  opts: ToSelectOption[],
  label: string | undefined,
): string {
  if (!label) {
    return '';
  }
  const t = label.trim().toLowerCase();
  return opts.find((o) => o.label.trim().toLowerCase() === t)?.value ?? '';
}

/** Sincroniza la posición de enganche (1.er / 2.do equipo) con el cupo de la tractora. */
export function registerFleetHitchSlotSync(opts: {
  isActive: () => boolean;
  catalog: () => readonly import('@shared/models/logistics.models').Equipment[];
  unitId: () => string;
  excludeEquipmentId?: () => string | undefined;
  isSecondTrailer: WritableSignal<boolean>;
}): ReturnType<typeof effect> {
  return effect(() => {
    if (!opts.isActive()) {
      return;
    }
    const slot = unitHitchSlotForNewEquipment(
      opts.catalog(),
      opts.unitId(),
      opts.excludeEquipmentId?.(),
    );
    opts.isSecondTrailer.set(isSecondTrailerForUnitHitchSlot(slot));
  });
}
