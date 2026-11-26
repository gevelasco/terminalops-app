/** Granularidad comercial de tarifas por destino (política de empresa). */
export const DESTINATION_RATE_SCOPES = [
  'postal_code',
  'municipality',
  'state',
] as const;

export type DestinationRateScope = (typeof DESTINATION_RATE_SCOPES)[number];

export const DESTINATION_RATE_SCOPE_DEFAULT: DestinationRateScope = 'postal_code';

/** 0 = más fino (CP), 2 = más grueso (estado). */
export function destinationRateScopeRank(scope: DestinationRateScope): number {
  switch (scope) {
    case 'postal_code':
      return 0;
    case 'municipality':
      return 1;
    case 'state':
      return 2;
  }
}

export function isDestinationRateScope(value: unknown): value is DestinationRateScope {
  return (
    value === 'postal_code' || value === 'municipality' || value === 'state'
  );
}

export function normalizeDestinationRateScope(
  value: unknown,
): DestinationRateScope {
  return isDestinationRateScope(value) ? value : DESTINATION_RATE_SCOPE_DEFAULT;
}

export function destinationRateScopeLabel(scope: DestinationRateScope): string {
  switch (scope) {
    case 'postal_code':
      return 'Por códigos postales';
    case 'municipality':
      return 'Por municipios';
    case 'state':
      return 'Por estados';
  }
}

/** Texto de ayuda según el alcance seleccionado en Política de tarifas. */
export function destinationRateScopeHelp(scope: DestinationRateScope): string {
  switch (scope) {
    case 'postal_code':
      return 'Una tarifa por cada código postal y localidad. Ideal si cobras distinto según colonia o zona fina del destino.';
    case 'municipality':
      return 'Una tarifa por municipio (dentro del estado). Agrupa colonias del mismo municipio bajo el mismo precio.';
    case 'state':
      return 'Una tarifa por estado completo. El precio aplica a cualquier destino dentro de ese estado.';
  }
}

/** true = colapsar tarifas (grano más grueso). false = marcar incompletas (más fino). */
export function isDestinationRateScopeCoarsening(
  from: DestinationRateScope,
  to: DestinationRateScope,
): boolean {
  return destinationRateScopeRank(to) > destinationRateScopeRank(from);
}

export function normalizePlaceKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
