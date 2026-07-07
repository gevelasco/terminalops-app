import type { TripStatus } from '@shared/models/logistics.models';

/** Maniobra resumida para vincular en formularios (gastos, etc.). */
export interface TripLinkOption {
  id: string;
  maneuverCode: string;
  status: TripStatus;
  falseManeuver: boolean;
  plannedDepartureAt: string;
}

export interface TripLinkOptionsResponse {
  items: TripLinkOption[];
}

export function mapApiTripLinkOption(row: Record<string, unknown>): TripLinkOption {
  return {
    id: String(row['id'] ?? ''),
    maneuverCode: String(row['maneuverCode'] ?? '').trim(),
    status: row['status'] as TripStatus,
    falseManeuver: row['falseManeuver'] === true,
    plannedDepartureAt: String(row['plannedDepartureAt'] ?? ''),
  };
}
