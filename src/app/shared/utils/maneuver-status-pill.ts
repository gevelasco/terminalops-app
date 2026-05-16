import type { TripStatus } from '@shared/models/logistics.models';
import { tripStatusUiLabel } from './trip-status-ui';

/** Misma lógica que `to-table` (`maniobra-status`): pastilla con color por estado. */
export function maneuverStatusPillClass(
  status: TripStatus,
  options?: { falseManeuver?: boolean },
): string {
  const base = 'to-table-pill';
  const falseManeuver = options?.falseManeuver === true;
  if (status === 'cancelled' && falseManeuver) {
    return `${base} ${base}--false-maneuver`;
  }
  switch (status) {
    case 'in_transit':
      return `${base} ${base}--course`;
    case 'completed':
      return `${base} ${base}--done`;
    case 'scheduled':
      return `${base} ${base}--delayed`;
    case 'cancelled':
      return `${base} ${base}--cancelled`;
    default:
      return `${base} ${base}--unknown`;
  }
}

export function maneuverStatusPillLabel(
  status: TripStatus,
  options?: { falseManeuver?: boolean },
): string {
  if (
    status !== 'scheduled' &&
    status !== 'in_transit' &&
    status !== 'completed' &&
    status !== 'cancelled'
  ) {
    return '—';
  }
  return tripStatusUiLabel(status, {
    falseManeuver: options?.falseManeuver === true,
  });
}
