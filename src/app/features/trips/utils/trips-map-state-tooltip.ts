import type { TripMapItem } from '@shared/models/api/api-trips-map.model';
import {
  findMexicoStateForPoint,
  type MexicoStatesGeoJson,
} from '@features/trips/utils/trips-map-state-activity';

export type StateDestinationBreakdown = {
  scheduled: number;
  inTransit: number;
  total: number;
};

export function countManeuversByDestinationStateBreakdown(
  items: readonly TripMapItem[],
  geoJson: MexicoStatesGeoJson,
): Map<string, StateDestinationBreakdown> {
  const counts = new Map<string, StateDestinationBreakdown>();

  for (const item of items) {
    const { lat, lng } = item.destination;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }

    const stateName = findMexicoStateForPoint(lng, lat, geoJson.features);
    if (!stateName) {
      continue;
    }

    const current = counts.get(stateName) ?? { scheduled: 0, inTransit: 0, total: 0 };
    if (item.status === 'scheduled') {
      current.scheduled += 1;
    } else if (item.status === 'in_transit') {
      current.inTransit += 1;
    }
    current.total += 1;
    counts.set(stateName, current);
  }

  return counts;
}

type StatusBadgeVariant = 'course' | 'scheduled';

const BADGE_STYLES: Record<
  StatusBadgeVariant,
  { color: string; background: string; label: string }
> = {
  course: {
    color: '#1d4ed8',
    background: 'rgba(59, 130, 246, 0.16)',
    label: 'En curso',
  },
  scheduled: {
    color: '#a16207',
    background: 'rgba(234, 179, 8, 0.22)',
    label: 'Programadas',
  },
};

function statusBadgeHtml(variant: StatusBadgeVariant, count: number): string {
  const style = BADGE_STYLES[variant];
  return `
    <div style="display:flex;align-items:center;gap:0.45rem;margin-top:0.35rem;">
      <span style="
        display:inline-flex;align-items:center;gap:0.35rem;
        padding:0.28rem 0.65rem;border-radius:999px;
        font-size:0.6875rem;font-weight:600;letter-spacing:0.05em;
        line-height:1.2;color:${style.color};background:${style.background};
      ">
        <span style="width:0.4rem;height:0.4rem;border-radius:50%;background:currentColor;flex-shrink:0;"></span>
        <span style="text-transform:uppercase;">${style.label}</span>
      </span>
      <span style="font-size:0.8125rem;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;">${count}</span>
    </div>
  `;
}

const STATE_PIN_ICON = `
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="display:block;flex-shrink:0;color:#64748b;">
    <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
  </svg>
`;

export function formatStateDestinationTooltipHtml(
  stateName: string,
  breakdown: StateDestinationBreakdown,
): string {
  if (breakdown.total <= 0) {
    return '';
  }

  const rows: string[] = [];
  if (breakdown.inTransit > 0) {
    rows.push(statusBadgeHtml('course', breakdown.inTransit));
  }
  if (breakdown.scheduled > 0) {
    rows.push(statusBadgeHtml('scheduled', breakdown.scheduled));
  }

  return `
    <div style="min-width:9.5rem;max-width:14rem;padding:0.15rem 0;">
      <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.15rem;">
        <span style="font-size:0.875rem;font-weight:700;color:#0f172a;line-height:1.25;">${stateName}</span>
        ${STATE_PIN_ICON}
      </div>
      ${rows.join('')}
    </div>
  `;
}
