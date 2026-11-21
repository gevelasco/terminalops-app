export type RouteMapViewport = {
  boundingCoords?: [[number, number], [number, number]];
  center: [number, number];
  zoom: number;
};

const MEXICO_DEFAULT: RouteMapViewport = {
  center: [-102, 24],
  zoom: 1.15,
};

export function computeRouteMapViewport(
  coords: readonly { lng: number; lat: number }[],
): RouteMapViewport {
  if (coords.length === 0) {
    return MEXICO_DEFAULT;
  }
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const { lng, lat } of coords) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      continue;
    }
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  if (!Number.isFinite(minLng)) {
    return MEXICO_DEFAULT;
  }
  const spanLng = Math.max(maxLng - minLng, 0.35);
  const spanLat = Math.max(maxLat - minLat, 0.35);
  const padLng = Math.max(spanLng * 0.18, 0.4);
  const padLat = Math.max(spanLat * 0.18, 0.32);
  return {
    boundingCoords: [
      [minLng - padLng, maxLat + padLat],
      [maxLng + padLng, minLat - padLat],
    ],
    center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
    zoom: 1,
  };
}