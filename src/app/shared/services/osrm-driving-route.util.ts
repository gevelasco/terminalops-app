export type OsrmLngLat = [number, number];

export type OsrmDrivingRouteResult = {
  km: number;
  coordinates: OsrmLngLat[];
};

export type OsrmRouteResponse = {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      type?: string;
      coordinates?: unknown;
    };
    legs?: Array<{ distance?: number; duration?: number }>;
  }>;
};

const COORD_CACHE_DECIMALS = 4;

export function osrmRouteCacheKey(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): string {
  return `${roundCoord(from.lat)},${roundCoord(from.lon)}>${roundCoord(to.lat)},${roundCoord(to.lon)}`;
}

export function osrmRouteThroughCacheKey(
  points: readonly { lat: number; lon: number }[],
): string {
  return points
    .map((p) => `${roundCoord(p.lat)},${roundCoord(p.lon)}`)
    .join('>');
}

export function parseOsrmDrivingRoute(
  res: OsrmRouteResponse,
): OsrmDrivingRouteResult | null {
  const code = (res.code ?? '').trim();
  if (code.toLowerCase() !== 'ok' || !res.routes?.length) {
    return null;
  }
  // Entre alternativas, la más corta (evita desvíos largos del demo OSRM).
  let route = res.routes[0]!;
  let bestMeters = Number.POSITIVE_INFINITY;
  for (const candidate of res.routes) {
    const meters =
      typeof candidate.distance === 'number'
        ? candidate.distance
        : typeof candidate.legs?.[0]?.distance === 'number'
          ? candidate.legs[0].distance
          : Number(candidate.distance ?? candidate.legs?.[0]?.distance);
    if (!Number.isFinite(meters)) {
      continue;
    }
    if (meters < bestMeters) {
      bestMeters = meters;
      route = candidate;
    }
  }
  if (!Number.isFinite(bestMeters)) {
    return null;
  }
  const km = Math.round((bestMeters / 1000) * 10) / 10;
  return {
    km,
    coordinates: parseOsrmLineString(route.geometry),
  };
}

export function parseOsrmLineString(geometry: unknown): OsrmLngLat[] {
  if (!geometry || typeof geometry !== 'object') {
    return [];
  }
  const raw = geometry as { type?: string; coordinates?: unknown };
  if (raw.type !== 'LineString' || !Array.isArray(raw.coordinates)) {
    return [];
  }
  const coords: OsrmLngLat[] = [];
  for (const pair of raw.coordinates) {
    if (!Array.isArray(pair) || pair.length < 2) {
      continue;
    }
    const lon = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      continue;
    }
    coords.push([lon, lat]);
  }
  return coords;
}

/** Reduce puntos para ECharts / sessionStorage sin perder extremos. */
export function downsampleOsrmCoordinates(
  coords: readonly OsrmLngLat[],
  maxPoints = 400,
): OsrmLngLat[] {
  if (coords.length <= maxPoints) {
    return [...coords];
  }
  const last = maxPoints - 1;
  const step = (coords.length - 1) / last;
  const out: OsrmLngLat[] = [];
  for (let i = 0; i < last; i += 1) {
    out.push(coords[Math.round(i * step)]!);
  }
  out.push(coords[coords.length - 1]!);
  return out;
}

function roundCoord(value: number): string {
  return value.toFixed(COORD_CACHE_DECIMALS);
}
