export type TripMapGeoPointSource =
  | 'destination_rate'
  | 'client_delivery'
  | 'operational_center'
  | 'fallback'
  | 'unresolved';

export type TripMapGeoQuality = 'resolved' | 'partial' | 'unresolved';

export type TripMapStatus = 'scheduled' | 'in_transit';

export interface TripMapGeoPoint {
  lat: number | null;
  lng: number | null;
  label: string;
  source: TripMapGeoPointSource;
}

export interface TripMapRouteWaypoint {
  lat: number;
  lon: number;
}

export interface TripMapRouteTollPlaza {
  order: number;
  plazaKey: string;
  inegiPoint?: string;
  name: string;
}

export interface TripMapItem {
  id: string;
  maneuverCode: string;
  status: TripMapStatus;
  origin: TripMapGeoPoint;
  destination: TripMapGeoPoint;
  geoQuality: TripMapGeoQuality;
  routeWaypoints?: TripMapRouteWaypoint[];
  routeTollPlazas?: TripMapRouteTollPlaza[];
}

export interface TripsMapMeta {
  total: number;
  resolved: number;
  partial: number;
  unresolved: number;
}

export interface TripsMapResponse {
  items: TripMapItem[];
  meta: TripsMapMeta;
}

function parseTripMapRouteWaypoints(raw: unknown): TripMapRouteWaypoint[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  const out: TripMapRouteWaypoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const lat = Number(row['lat']);
    const lon = Number(row['lon']);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      out.push({ lat, lon });
    }
  }
  return out.length > 0 ? out : undefined;
}

function parseTripMapRouteTollPlazas(raw: unknown): TripMapRouteTollPlaza[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  const out: TripMapRouteTollPlaza[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const plazaKey = String(row['plazaKey'] ?? '').trim();
    const name = String(row['name'] ?? '').trim();
    if (!plazaKey || !name) {
      continue;
    }
    const orderRaw = Number(row['order']);
    const order = Number.isFinite(orderRaw) ? orderRaw : out.length + 1;
    const inegiPoint = String(row['inegiPoint'] ?? '').trim();
    out.push({
      order,
      plazaKey,
      name,
      ...(inegiPoint ? { inegiPoint } : {}),
    });
  }
  out.sort((a, b) => a.order - b.order);
  return out.length > 0 ? out : undefined;
}

export function mapApiTripMapItem(raw: Record<string, unknown>): TripMapItem {
  const origin = (raw['origin'] ?? {}) as Record<string, unknown>;
  const destination = (raw['destination'] ?? {}) as Record<string, unknown>;
  const routeWaypoints = parseTripMapRouteWaypoints(raw['routeWaypoints']);
  const routeTollPlazas = parseTripMapRouteTollPlazas(raw['routeTollPlazas']);
  return {
    id: String(raw['id'] ?? ''),
    maneuverCode: String(raw['maneuverCode'] ?? ''),
    status: raw['status'] as TripMapStatus,
    origin: {
      lat: origin['lat'] == null ? null : Number(origin['lat']),
      lng: origin['lng'] == null ? null : Number(origin['lng']),
      label: String(origin['label'] ?? ''),
      source: origin['source'] as TripMapGeoPointSource,
    },
    destination: {
      lat: destination['lat'] == null ? null : Number(destination['lat']),
      lng: destination['lng'] == null ? null : Number(destination['lng']),
      label: String(destination['label'] ?? ''),
      source: destination['source'] as TripMapGeoPointSource,
    },
    geoQuality: raw['geoQuality'] as TripMapGeoQuality,
    ...(routeWaypoints ? { routeWaypoints } : {}),
    ...(routeTollPlazas ? { routeTollPlazas } : {}),
  };
}

export function mapApiTripsMapResponse(raw: Record<string, unknown>): TripsMapResponse {
  const meta = (raw['meta'] ?? {}) as Record<string, unknown>;
  const items = Array.isArray(raw['items']) ? raw['items'] : [];
  return {
    items: items.map((item) => mapApiTripMapItem(item as Record<string, unknown>)),
    meta: {
      total: Number(meta['total'] ?? 0),
      resolved: Number(meta['resolved'] ?? 0),
      partial: Number(meta['partial'] ?? 0),
      unresolved: Number(meta['unresolved'] ?? 0),
    },
  };
}
