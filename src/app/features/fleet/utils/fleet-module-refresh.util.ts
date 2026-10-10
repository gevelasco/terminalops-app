import type { FleetModuleRefreshOptions } from '@features/fleet/services/fleet.service';

/** Lista ya actualizada vía PATCH/upsert; solo overview (y equipos si aplica hitch). */
export const fleetRefreshAfterListUpsert = (
  scope: 'unit' | 'equipment',
): FleetModuleRefreshOptions => ({
  skipUnits: scope === 'unit',
  skipEquipment: scope === 'equipment',
  skipExpenses: true,
});

/** DELETE ya repuso el listado; evitar segundo GET de la misma lista. */
export const fleetRefreshAfterDelete = (
  scope: 'unit' | 'equipment',
): FleetModuleRefreshOptions => ({
  ...fleetRefreshAfterListUpsert(scope),
});

/** Enganche / desenganche: refrescar listas + overview; no barrer gastos globales. */
export const fleetRefreshAfterHitchMutation: FleetModuleRefreshOptions = {
  skipExpenses: true,
};
