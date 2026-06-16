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

export interface TripMapItem {
  id: string;
  maneuverCode: string;
  status: TripMapStatus;
  origin: TripMapGeoPoint;
  destination: TripMapGeoPoint;
  geoQuality: TripMapGeoQuality;
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

export function mapApiTripMapItem(raw: Record<string, unknown>): TripMapItem {
  const origin = (raw['origin'] ?? {}) as Record<string, unknown>;
  const destination = (raw['destination'] ?? {}) as Record<string, unknown>;
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
