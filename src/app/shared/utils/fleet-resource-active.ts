/** Recurso de flota visible y asignable (`isActive !== false`). */
export function isFleetResourceActive(
  resource: { isActive?: boolean } | null | undefined,
): boolean {
  return resource?.isActive !== false;
}

export function fleetResourceActiveLabel(isActive: boolean | undefined): string {
  return isFleetResourceActive({ isActive }) ? 'Activo' : 'Inactivo';
}
