import type { EquipmentHitchAssignmentValidation } from '@shared/utils/fleet/equipment-hitch-assignment';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';
import type { WritableSignal } from '@angular/core';
import { effect } from '@angular/core';

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

/** Apaga «segundo remolque» cuando la validación lo exige (evita estado inválido en UI). */
export function registerFleetHitchSecondTrailerSync(opts: {
  isActive: () => boolean;
  validation: () => EquipmentHitchAssignmentValidation;
  isSecondTrailer: WritableSignal<boolean>;
}): ReturnType<typeof effect> {
  return effect(() => {
    if (!opts.isActive()) {
      return;
    }
    const v = opts.validation();
    if (v.forceSecondTrailerOff && opts.isSecondTrailer()) {
      opts.isSecondTrailer.set(false);
    }
  });
}
