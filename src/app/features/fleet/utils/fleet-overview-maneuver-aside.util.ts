import {
  tripArrivalIso,
  tripCompletionIso,
  tripDepartureIso,
} from '@features/trips/utils/trip-schedule-accessors';
import type { FleetOverviewTripDto } from '@shared/models/api/fleet-overview.model';

export type FleetOverviewManeuverRowView = {
  label: string;
  value: string;
  wrap?: boolean;
  span?: boolean;
  valueTone?: 'eta' | 'update';
};

export type FleetOverviewManeuverAsideView = {
  rows: FleetOverviewManeuverRowView[];
};

export function formatManeuverScheduleDisplay(
  iso: string | null | undefined,
): string {
  if (!iso?.trim()) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  const date = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return `${date} · ${time}`;
}

export function buildOverviewManeuverAsideView(input: {
  trip: FleetOverviewTripDto;
  unitName: string;
  equipmentCodes: string;
  operatorName: string;
  etaDays: string;
  etaKm: string;
  showAssignment: boolean;
}): FleetOverviewManeuverAsideView {
  const rows: FleetOverviewManeuverRowView[] = [
    {
      label: 'Salida',
      value: formatManeuverScheduleDisplay(tripDepartureIso(input.trip)),
    },
    {
      label: 'Cita cliente',
      value: formatManeuverScheduleDisplay(tripArrivalIso(input.trip)),
    },
    {
      label: 'Llegada origen',
      value: formatManeuverScheduleDisplay(tripCompletionIso(input.trip)),
    },
    { label: 'ETA viaje', value: input.etaDays, valueTone: 'eta' },
    { label: 'ETA kms', value: input.etaKm, valueTone: 'eta' },
  ];

  if (input.showAssignment) {
    rows.push({ label: 'Unidad', value: input.unitName });
    rows.push({
      label: 'Equipo',
      value: input.equipmentCodes,
      span: true,
      wrap: true,
    });
  }

  rows.push({
    label: 'Operador',
    value: input.operatorName,
    span: true,
    wrap: true,
  });

  return { rows };
}