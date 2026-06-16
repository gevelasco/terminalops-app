/** Valor interno del select cuando el origen no es un centro operativo registrado. */
export const OPERATIONAL_CENTER_NEW_ROUTE_VALUE = '__new_route__';

export function isOperationalCenterNewRoute(centerId: string): boolean {
  return centerId.trim() === OPERATIONAL_CENTER_NEW_ROUTE_VALUE;
}
