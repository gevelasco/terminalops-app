import { FLEET_TRAILER_TENURE_OPTIONS } from '@shared/catalogs/fleet-form-options';
import type { TrailerTenureMode } from '@shared/models/logistics.models';

const TENURE_CODES: TrailerTenureMode[] = ['owned', 'financed', 'leased', 'managed'];

/** Valor por defecto al alta/edición si el usuario no elige otra situación. */
export const DEFAULT_TRAILER_TENURE_MODE: TrailerTenureMode = 'owned';

/** Código de tenencia con fallback a {@link DEFAULT_TRAILER_TENURE_MODE}. */
export function trailerTenureModeOrDefault(
  raw: string | undefined | null,
): TrailerTenureMode {
  return normalizeTrailerTenureMode(raw) ?? DEFAULT_TRAILER_TENURE_MODE;
}

/** Normaliza código o etiqueta de tenencia al value del catálogo. */
export function normalizeTrailerTenureMode(
  raw: string | undefined | null,
): TrailerTenureMode | undefined {
  const t = raw?.trim();
  if (!t) {
    return undefined;
  }
  if (TENURE_CODES.includes(t as TrailerTenureMode)) {
    return t as TrailerTenureMode;
  }
  const byLabel = FLEET_TRAILER_TENURE_OPTIONS.find(
    (o) => o.label.trim().toLowerCase() === t.toLowerCase(),
  );
  return byLabel?.value as TrailerTenureMode | undefined;
}

/** Etiqueta en español para mostrar en ficha (código, etiqueta o vacío). */
export function trailerTenureModeLabel(
  raw: string | undefined | null,
  opts?: { defaultWhenEmpty?: boolean },
): string {
  const code = opts?.defaultWhenEmpty
    ? trailerTenureModeOrDefault(raw)
    : normalizeTrailerTenureMode(raw);
  if (!code) {
    return '—';
  }
  return FLEET_TRAILER_TENURE_OPTIONS.find((o) => o.value === code)?.label ?? '—';
}
