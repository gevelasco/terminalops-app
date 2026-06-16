import type { TripMapItem } from '@shared/models/api/api-trips-map.model';

export type MexicoStateGeoFeature = {
  type: 'Feature';
  properties: { name: string };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
};

export type MexicoStatesGeoJson = {
  type: 'FeatureCollection';
  features: MexicoStateGeoFeature[];
};

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygonCoords(lng: number, lat: number, coordinates: number[][][]): boolean {
  if (coordinates.length === 0) {
    return false;
  }
  if (!pointInRing(lng, lat, coordinates[0])) {
    return false;
  }
  for (let holeIndex = 1; holeIndex < coordinates.length; holeIndex += 1) {
    if (pointInRing(lng, lat, coordinates[holeIndex])) {
      return false;
    }
  }
  return true;
}

export function findMexicoStateForPoint(
  lng: number,
  lat: number,
  features: readonly MexicoStateGeoFeature[],
): string | null {
  for (const feature of features) {
    const { geometry } = feature;
    if (geometry.type === 'Polygon') {
      if (pointInPolygonCoords(lng, lat, geometry.coordinates as number[][][])) {
        return feature.properties.name;
      }
      continue;
    }

    for (const polygon of geometry.coordinates as number[][][][]) {
      if (pointInPolygonCoords(lng, lat, polygon)) {
        return feature.properties.name;
      }
    }
  }
  return null;
}

export function countManeuversByOriginState(
  items: readonly TripMapItem[],
  geoJson: MexicoStatesGeoJson,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const { lat, lng } = item.origin;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    const stateName = findMexicoStateForPoint(lng, lat, geoJson.features);
    if (!stateName) {
      continue;
    }
    counts.set(stateName, (counts.get(stateName) ?? 0) + 1);
  }
  return counts;
}

export function countManeuversByDestinationState(
  items: readonly TripMapItem[],
  geoJson: MexicoStatesGeoJson,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const { lat, lng } = item.destination;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    const stateName = findMexicoStateForPoint(lng, lat, geoJson.features);
    if (!stateName) {
      continue;
    }
    counts.set(stateName, (counts.get(stateName) ?? 0) + 1);
  }
  return counts;
}

export function tripIdsByDestinationState(
  items: readonly TripMapItem[],
  stateName: string,
  geoJson: MexicoStatesGeoJson,
): string[] {
  const normalizedState = stateName.trim();
  if (!normalizedState) {
    return [];
  }

  const tripIds: string[] = [];
  for (const item of items) {
    const { lat, lng } = item.destination;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    const resolvedState = findMexicoStateForPoint(lng, lat, geoJson.features);
    if (resolvedState === normalizedState) {
      tripIds.push(item.id);
    }
  }
  return tripIds;
}

export function countTripsMapActiveDestinationStates(
  items: readonly TripMapItem[],
  geoJson: MexicoStatesGeoJson | null | undefined,
): number {
  if (!geoJson) {
    return 0;
  }
  return countManeuversByDestinationState(items, geoJson).size;
}

type TripsMapGeoRegionItemStyle = {
  areaColor: string;
  borderColor: string;
  borderWidth: number;
  shadowBlur: number;
  shadowColor: string;
};

export type TripsMapGeoRegionStyle = {
  name: string;
  itemStyle: TripsMapGeoRegionItemStyle;
  emphasis?: {
    itemStyle: TripsMapGeoRegionItemStyle;
  };
};

function buildOriginRegionStyle(intensity: number): {
  itemStyle: TripsMapGeoRegionItemStyle;
  emphasis: { itemStyle: TripsMapGeoRegionItemStyle };
} {
  const areaAlpha = 0.1 + intensity * 0.24;
  const borderAlpha = 0.48 + intensity * 0.42;
  const itemStyle: TripsMapGeoRegionItemStyle = {
    areaColor: `rgba(22, 163, 74, ${areaAlpha.toFixed(3)})`,
    borderColor: `rgba(21, 128, 61, ${borderAlpha.toFixed(3)})`,
    borderWidth: Number((1 + intensity * 0.6).toFixed(2)),
    shadowBlur: Math.round(intensity * 8),
    shadowColor: 'rgba(22, 163, 74, 0.22)',
  };
  return {
    itemStyle,
    emphasis: {
      itemStyle: {
        areaColor: `rgba(22, 163, 74, ${(areaAlpha + 0.12).toFixed(3)})`,
        borderColor: 'rgba(21, 128, 61, 0.92)',
        borderWidth: Number((1.2 + intensity * 0.5).toFixed(2)),
        shadowBlur: Math.round(intensity * 10 + 4),
        shadowColor: 'rgba(22, 163, 74, 0.28)',
      },
    },
  };
}

function buildDestinationRegionStyle(intensity: number): {
  itemStyle: TripsMapGeoRegionItemStyle;
  emphasis: { itemStyle: TripsMapGeoRegionItemStyle };
} {
  const areaAlpha = 0.1 + intensity * 0.24;
  const borderAlpha = 0.5 + intensity * 0.45;
  const itemStyle: TripsMapGeoRegionItemStyle = {
    areaColor: `rgba(59, 130, 246, ${areaAlpha.toFixed(3)})`,
    borderColor: `rgba(37, 99, 235, ${borderAlpha.toFixed(3)})`,
    borderWidth: Number((1 + intensity * 0.6).toFixed(2)),
    shadowBlur: Math.round(intensity * 8),
    shadowColor: 'rgba(37, 99, 235, 0.25)',
  };
  return {
    itemStyle,
    emphasis: {
      itemStyle: {
        areaColor: `rgba(59, 130, 246, ${(areaAlpha + 0.12).toFixed(3)})`,
        borderColor: 'rgba(37, 99, 235, 0.95)',
        borderWidth: Number((1.2 + intensity * 0.5).toFixed(2)),
        shadowBlur: Math.round(intensity * 10 + 4),
        shadowColor: 'rgba(37, 99, 235, 0.3)',
      },
    },
  };
}

export function buildGeoRegionsForStateActivity(
  originCounts: ReadonlyMap<string, number>,
  destinationCounts: ReadonlyMap<string, number>,
): TripsMapGeoRegionStyle[] {
  const maxOrigin = Math.max(0, ...originCounts.values());
  const maxDestination = Math.max(0, ...destinationCounts.values());
  if (maxOrigin === 0 && maxDestination === 0) {
    return [];
  }

  const stateNames = new Set([...originCounts.keys(), ...destinationCounts.keys()]);
  const regions: TripsMapGeoRegionStyle[] = [];

  for (const name of stateNames) {
    const originCount = originCounts.get(name) ?? 0;
    const destinationCount = destinationCounts.get(name) ?? 0;
    if (originCount <= 0 && destinationCount <= 0) {
      continue;
    }

    const style =
      originCount > 0
        ? buildOriginRegionStyle(originCount / maxOrigin)
        : buildDestinationRegionStyle(destinationCount / maxDestination);

    regions.push({
      name,
      ...style,
    });
  }

  return regions;
}
