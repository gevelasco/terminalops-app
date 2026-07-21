import { Trip, Unit } from '@shared/models/logistics.models';
import { formatStackedMx } from '@shared/utils/format-datetime-mx';
import {
  formatTripRouteSummary,
  tripOperatorDisplayName,
  tripUnitDisplayCode,
} from '@features/trips/utils/trip-display-labels';
import {
  tripArrivalIso,
  tripCompletionIso,
  tripDepartureIso,
} from '@features/trips/utils/trip-schedule-accessors';
import { tripHasIncidents } from '@features/trips/utils/trip-incidents';

const STATUS_SEARCH_HINTS: Record<string, string> = {
  in_transit: 'en curso transito ruta',
  scheduled: 'programado',
  completed: 'completado terminado',
  cancelled: 'cancelado',
};

/** Fila de tabla de listado de maniobras. */
export function maniobraListRowFromTrip(
  t: Trip,
  operatorsById?: ReadonlyMap<string, string>,
  units?: readonly Unit[],
): Record<string, unknown> {
  return {
    id: t.id,
    code: t.maneuverCode,
    route: formatTripRouteSummary(t),
    clientName: t.clientName,
    clientId: t.clientId,
    operatorName: tripOperatorDisplayName(t, operatorsById),
    unitId: tripUnitDisplayCode(t, units),
    status: t.status,
    falseManeuver: t.falseManeuver === true,
    departureAt: formatStackedMx(tripDepartureIso(t)),
    arrivedAt: formatStackedMx(tripArrivalIso(t)),
    completionAt: formatStackedMx(tripCompletionIso(t)),
    operationType: t.operationType,
    operationConfigurationId: t.operationConfigurationId ?? '',
    hasIncident: tripHasIncidents(t),
    equipmentJoined: (t.equipment ?? []).join(' '),
  };
}

/** Búsqueda de texto libre sobre una fila del listado de maniobras. */
export function maniobraListRowMatchesSearch(
  row: Record<string, unknown>,
  q: string,
): boolean {
  const status = String(row['status'] ?? '');
  const statusExtra = STATUS_SEARCH_HINTS[status] ?? '';
  const hasInc = row['hasIncident'] === true || row['hasIncident'] === 'true';
  const blob = [
    row['code'],
    row['route'],
    row['clientName'],
    row['clientId'],
    row['operatorName'],
    row['unitId'],
    row['equipmentJoined'],
    status,
    statusExtra,
    row['departureAt'],
    row['arrivedAt'],
    row['operationType'],
    hasInc ? 'incidente' : '',
  ]
    .map((x) => String(x ?? '').toLowerCase())
    .join(' ');
  return blob.includes(q);
}
