/** Código canónico de configuración «Doble articulado» (catálogo operativo). */
export const TRIP_DOUBLE_ARTICULATED_CONFIG_CODE = 'doble-articulado' as const;

/** Códigos expuestos en el alta de maniobra (Configuración). */
export const TRIP_MANEUVER_CONFIGURATION_CODES = [
  'sencillo',
  TRIP_DOUBLE_ARTICULATED_CONFIG_CODE,
] as const;

const LEGACY_DOUBLE_ARTICULATED_CODES = new Set(['full', 'doble_articulado']);

/** Normaliza códigos legados (`full`) al canónico `doble-articulado`. */
export function normalizeManeuverOperationCode(
  raw: string | null | undefined,
): string {
  const code = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!code) {
    return '';
  }
  if (LEGACY_DOUBLE_ARTICULATED_CODES.has(code) || code === 'doble-articulado') {
    return TRIP_DOUBLE_ARTICULATED_CONFIG_CODE;
  }
  return code;
}

export function isDoubleArticulatedOperationCode(
  raw: string | null | undefined,
): boolean {
  return normalizeManeuverOperationCode(raw) === TRIP_DOUBLE_ARTICULATED_CONFIG_CODE;
}

export function maneuverOperationCodesEquivalent(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizeManeuverOperationCode(a) === normalizeManeuverOperationCode(b);
}
