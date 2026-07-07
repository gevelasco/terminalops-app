import type { FleetOverviewOperationalStatus } from '@shared/utils/fleet/fleet-status.types';
import type { OperatorOperationalStatus, TripStatus } from '@shared/models/logistics.models';
import type { FleetOperationalKey } from '@features/fleet/utils/fleet-unit-table-row';
import type {
  FleetStatus,
  ResolveFleetStatusInput,
} from './fleet-status.types';

export const TRIP_FLEET_ACTIVE_STATUSES: readonly TripStatus[] = [
  'scheduled',
  'in_transit',
];

const OPERATOR_PROTECTED_STATUSES = new Set<OperatorOperationalStatus>([
  'maintenance',
  'leave',
  'inactive',
  'incapacitated',
]);

/** Normaliza strings crudos de DB/API al vocabulario canónico. */
export function normalizeFleetStatus(
  raw: string | null | undefined,
): FleetStatus {
  const s = (raw ?? '').trim().toLowerCase();
  switch (s) {
    case 'in_use':
    case 'on_route':
    case 'in_transit':
      return 'in_use';
    case 'scheduled':
      return 'scheduled';
    case 'maintenance':
      return 'maintenance';
    case 'inactive':
      return 'inactive';
    default:
      return 'available';
  }
}

/** Única interpretación de estado operativo final (A7 — espejo backend). */
export function resolveFleetStatus(input: ResolveFleetStatusInput): FleetStatus {
  if (!input.isActive) {
    return 'inactive';
  }
  if (input.maintenanceFlag) {
    return 'maintenance';
  }
  if (input.activeTripStatus === 'in_transit') {
    return 'in_use';
  }
  if (input.activeTripStatus === 'scheduled') {
    return 'scheduled';
  }
  return input.status;
}

export function fleetStatusToOperationalKey(status: FleetStatus): FleetOperationalKey {
  switch (status) {
    case 'in_use':
      return 'on_route';
    case 'scheduled':
      return 'scheduled';
    case 'maintenance':
      return 'maintenance';
    case 'inactive':
      return 'unknown';
    default:
      return 'available';
  }
}

export function overviewOperationalStatusToFleetStatus(
  status: FleetOverviewOperationalStatus,
): FleetStatus {
  switch (status) {
    case 'in_transit':
      return 'in_use';
    case 'scheduled':
      return 'scheduled';
    case 'maintenance':
      return 'maintenance';
    default:
      return 'available';
  }
}

export function overviewOperationalKey(
  status: FleetOverviewOperationalStatus,
): FleetOperationalKey {
  return fleetStatusToOperationalKey(overviewOperationalStatusToFleetStatus(status));
}

export function resolveUnitFleetStatus(input: {
  persistedStatus: string | null | undefined;
  isActive: boolean;
  activeTripStatus?: TripStatus;
}): FleetStatus {
  const normalized = normalizeFleetStatus(input.persistedStatus);
  return resolveFleetStatus({
    status: normalized,
    isActive: input.isActive,
    activeTripStatus:
      input.activeTripStatus === 'in_transit' || input.activeTripStatus === 'scheduled'
        ? input.activeTripStatus
        : undefined,
    maintenanceFlag: normalized === 'maintenance',
  });
}

export function resolveUnitOperationalKey(input: {
  persistedStatus: string | null | undefined;
  isActive: boolean;
  activeTripStatus?: TripStatus;
}): FleetOperationalKey {
  return fleetStatusToOperationalKey(resolveUnitFleetStatus(input));
}

export function resolveOperatorOperationalStatus(input: {
  status: OperatorOperationalStatus;
  isActive: boolean;
  activeTripStatus?: TripStatus;
}): OperatorOperationalStatus {
  if (!input.isActive) {
    return 'inactive';
  }
  if (OPERATOR_PROTECTED_STATUSES.has(input.status)) {
    return input.status;
  }
  const resolved = resolveFleetStatus({
    status: normalizeFleetStatus(input.status) as FleetStatus,
    isActive: true,
    activeTripStatus:
      input.activeTripStatus === 'in_transit' || input.activeTripStatus === 'scheduled'
        ? input.activeTripStatus
        : undefined,
  });
  if (resolved === 'in_use') {
    return 'in_use';
  }
  if (resolved === 'scheduled') {
    return 'scheduled';
  }
  if (resolved === 'maintenance') {
    return 'maintenance';
  }
  if (resolved === 'inactive') {
    return 'inactive';
  }
  return 'available';
}

export function fleetStatusIsEnCurso(status: FleetStatus): boolean {
  return status === 'in_use';
}

export function operationalKeyIsEnCurso(key: FleetOperationalKey): boolean {
  return key === 'on_route' || key === 'in_use';
}
