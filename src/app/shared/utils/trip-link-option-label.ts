import type { TripLinkOption } from '@shared/models/api/api-trips-link-options.model';
import type { Trip } from '@shared/models/logistics.models';
import { maneuverStatusPillLabel } from '@shared/utils/maneuver-status-pill';

export function formatTripLinkOptionDate(iso: string): string {
  if (!iso.trim()) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short' }).format(d);
}

/** Etiqueta del campo tras elegir una maniobra. */
export function formatTripLinkOptionFieldLabel(t: TripLinkOption): string {
  const code = t.maneuverCode.trim() || t.id;
  const status = maneuverStatusPillLabel(t.status, {
    falseManeuver: t.falseManeuver,
  });
  const date = formatTripLinkOptionDate(t.plannedDepartureAt);
  return `${code} · ${status} · ${date}`;
}

export function tripToLinkOption(t: Trip): TripLinkOption {
  return {
    id: t.id,
    maneuverCode: (t.maneuverCode ?? t.id).trim(),
    status: t.status,
    falseManeuver: t.falseManeuver === true,
    plannedDepartureAt: t.plannedDepartureAt,
  };
}
