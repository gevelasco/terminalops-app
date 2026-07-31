import type { Trip } from '@shared/models/logistics.models';

const OPERATIONAL_TZ = 'America/Mexico_City';

export type DashboardUpcomingDepartureRow = {
  id: string;
  maneuverCode: string;
  destinationLabel: string;
  operatorLabel: string;
  departureAt: string;
  departureLabel: string;
  overdue: boolean;
  missingAssignment: boolean;
};

function destinationLabel(trip: Trip): string {
  const city = trip.destinationCityMunicipality?.trim();
  if (city) {
    return city;
  }
  const locality = trip.destinationLocality?.trim();
  if (locality) {
    return locality;
  }
  return 'Sin destino';
}

function operatorLabel(trip: Trip): string {
  const name = trip.operatorName?.trim();
  if (name && name.toLowerCase() !== 'sin operador') {
    return name;
  }
  return 'Sin operador';
}

function isMissingAssignment(trip: Trip): boolean {
  const noOperator = !trip.operatorId?.trim() || operatorLabel(trip) === 'Sin operador';
  const noUnit = !trip.unitId?.trim();
  return noOperator || noUnit;
}

function formatDepartureLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: OPERATIONAL_TZ,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Próximas salidas programadas: vencidas primero, luego por fecha de salida.
 */
export function buildDashboardUpcomingDepartures(
  trips: readonly Trip[],
  options?: { now?: Date; limit?: number },
): DashboardUpcomingDepartureRow[] {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 15;
  const nowMs = now.getTime();

  return [...trips]
    .filter((trip) => trip.status === 'scheduled' && trip.plannedDepartureAt)
    .map((trip) => {
      const departureMs = new Date(trip.plannedDepartureAt).getTime();
      const overdue = Number.isFinite(departureMs) && departureMs < nowMs;
      return {
        id: trip.id,
        maneuverCode: trip.maneuverCode?.trim() || `Maniobra ${trip.id}`,
        destinationLabel: destinationLabel(trip),
        operatorLabel: operatorLabel(trip),
        departureAt: trip.plannedDepartureAt,
        departureLabel: formatDepartureLabel(trip.plannedDepartureAt),
        overdue,
        missingAssignment: isMissingAssignment(trip),
      };
    })
    .sort((a, b) => {
      if (a.overdue !== b.overdue) {
        return a.overdue ? -1 : 1;
      }
      return a.departureAt.localeCompare(b.departureAt);
    })
    .slice(0, limit);
}
