export const FLEET_MAINTENANCE_ON_ROUTE_TOOLTIP =
  'Este recurso está asignado a una maniobra en curso. Finaliza o cancela la maniobra antes de cambiar el mantenimiento.';

export function fleetNormalizedOperationalStatus(
  status: string | null | undefined,
): string {
  return (status ?? '').trim().toLowerCase();
}

export function fleetCanStartMaintenance(params: {
  status: string | null | undefined;
  onRoute: boolean;
  isActive?: boolean;
}): boolean {
  if (params.onRoute || params.isActive === false) {
    return false;
  }
  return fleetNormalizedOperationalStatus(params.status) === 'available';
}

export function fleetCanEndMaintenance(params: {
  status: string | null | undefined;
  onRoute: boolean;
}): boolean {
  if (params.onRoute) {
    return false;
  }
  return fleetNormalizedOperationalStatus(params.status) === 'maintenance';
}

export function fleetMaintenanceAction(params: {
  status: string | null | undefined;
  onRoute: boolean;
  isActive?: boolean;
}): 'start' | 'end' | null {
  if (fleetCanEndMaintenance(params)) {
    return 'end';
  }
  if (fleetCanStartMaintenance(params)) {
    return 'start';
  }
  return null;
}

export function fleetMaintenanceActionLabel(action: 'start' | 'end' | null): string {
  return action === 'end' ? 'Finalizar mantenimiento' : 'Iniciar mantenimiento';
}
