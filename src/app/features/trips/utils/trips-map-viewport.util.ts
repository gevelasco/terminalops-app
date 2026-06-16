import type { TripMapItem } from '@shared/models/api/api-trips-map.model';

export type TripsMapViewport = {
  boundingCoords?: [[number, number], [number, number]];
  center: [number, number];
  zoom: number;
};

const MEXICO_DEFAULT_VIEW: TripsMapViewport = {
  center: [-102, 24],
  zoom: 1.15,
};

function collectPlottableCoords(
  items: readonly TripMapItem[],
): Array<{ lng: number; lat: number }> {
  const coords: Array<{ lng: number; lat: number }> = [];
  for (const item of items) {
    for (const point of [item.origin, item.destination]) {
      if (
        point.lat != null &&
        point.lng != null &&
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng)
      ) {
        coords.push({ lng: point.lng, lat: point.lat });
      }
    }
  }
  return coords;
}

export function computeTripsMapViewport(
  items: readonly TripMapItem[],
): TripsMapViewport {
  const coords = collectPlottableCoords(items);
  if (coords.length === 0) {
    return MEXICO_DEFAULT_VIEW;
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const { lng, lat } of coords) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  const spanLng = Math.max(maxLng - minLng, 0.35);
  const spanLat = Math.max(maxLat - minLat, 0.35);
  const padLng = Math.max(spanLng * 0.22, 0.45);
  const padLat = Math.max(spanLat * 0.22, 0.35);

  return {
    boundingCoords: [
      [minLng - padLng, maxLat + padLat],
      [maxLng + padLng, minLat - padLat],
    ],
    center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
    zoom: 1,
  };
}

export function countTripsMapByStatus(items: readonly TripMapItem[]): {
  scheduled: number;
  inTransit: number;
} {
  let scheduled = 0;
  let inTransit = 0;
  for (const item of items) {
    if (item.status === 'scheduled') {
      scheduled += 1;
    } else if (item.status === 'in_transit') {
      inTransit += 1;
    }
  }
  return { scheduled, inTransit };
}
