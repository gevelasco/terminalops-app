import type { TripStatus } from '@shared/models/logistics.models';

/**
 * Etiquetas cortas de estado de maniobra / viaje, alineadas en tablas, filtros y paneles.
 * `in_transit` coincide con la unidad en servicio (p. ej. pill «Estado operativo» en Flota).
 */
export function tripStatusUiLabel(
  status: TripStatus,
  options?: { falseManeuver?: boolean },
): string {
  if (status === 'cancelled' && options?.falseManeuver === true) {
    return 'En falso';
  }
  switch (status) {
    case 'scheduled':
      return 'Programado';
    case 'in_transit':
      return 'En curso';
    case 'completed':
      return 'Completado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return '—';
  }
}
