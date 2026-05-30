import type { LatLon } from '@shared/services/osrm-driving-route.service';

export function parseFiniteCoord(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

export function isValidLatLon(value: LatLon | null | undefined): value is LatLon {
  return (
    value != null &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lon)
  );
}

export function latLonFromPrefill(
  latitude: unknown,
  longitude: unknown,
): LatLon | null {
  const lat = parseFiniteCoord(latitude);
  const lon = parseFiniteCoord(longitude);
  if (lat == null || lon == null) {
    return null;
  }
  return { lat, lon };
}
