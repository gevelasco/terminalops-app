import type { CriticalAlert, Trip } from '@shared/models/logistics.models';
import {
  buildTripIncidentFeed,
  inferIncidentKind,
} from '@shared/utils/trip-incident-feed';

function incidentTitle(description: string): string {
  const oneLine = description.replace(/\s+/g, ' ').trim();
  const cut = oneLine.length > 56 ? `${oneLine.slice(0, 53)}…` : oneLine;
  return cut || 'Incidente operativo';
}

/** Alertas del dashboard: un registro por incidente de maniobra. */
export function buildCriticalAlertsFromTrips(trips: readonly Trip[]): CriticalAlert[] {
  return buildTripIncidentFeed(trips).map((item) => {
    const maneuverCode = item.maneuverCode;
    const clientName = item.clientName;
    const routeLabel = item.routeLabel;
    const authorLabel = item.authorLabel;
    return {
      id: `ca-${item.incidentId}`,
      severity: item.severity,
      kind: item.kind ?? inferIncidentKind(item.description),
      title: incidentTitle(item.description),
      maneuverCode,
      clientName,
      routeLabel,
      authorLabel,
      description: `${maneuverCode} · ${clientName} · ${routeLabel} · ${authorLabel}`,
      detectedAt: item.occurredAt,
    };
  });
}
