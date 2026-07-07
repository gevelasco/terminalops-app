import type { WritableSignal } from '@angular/core';
import { effect } from '@angular/core';
import {
  isSecondTrailerForUnitHitchSlot,
  unitHitchSlotForNewEquipment,
} from '@shared/utils/fleet/equipment-hitch-assignment';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';

/** Fecha local YYYY-MM-DD (medianoche local). */
export function fleetDrawerTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function parseFleetOptionalAmount(raw: string): number | undefined | 'invalid' {
  const t = raw.trim().replace(/\s/g, '').replace(/,/g, '');
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
  const t = raw.trim().replace(/\s/g, '').replace(/,/g, '');
  if (t === '') {
    return 'invalid';
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) {
    return 'invalid';
  }
  return n;
}

/** Valor obligatorio compuesto solo de dígitos (p. ej. año modelo). */
export function parseFleetRequiredDigits(
  raw: string,
): string | 'invalid' | 'empty' {
  const t = raw.trim();
  if (t === '') {
    return 'empty';
  }
  if (!/^\d+$/.test(t)) {
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
