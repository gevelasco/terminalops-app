import type { Equipment } from '@shared/models/logistics.models';

export type { FleetDetailDrawerTab } from '@features/fleet/components/fleet-detail-drawer.types';

export type UnitDetailDrawerTab =
  import('@features/fleet/components/fleet-detail-drawer.types').FleetDetailDrawerTab;

/** Contexto de página (maniobra en curso) — catálogos vienen de feature services. */
export interface FleetUnitDetailDrawerHostLayout {
  onRoute: boolean;
}

export interface FleetUnitDetailDrawerHostCallbacks {
  dismiss: () => void;
  viewHitchedEquipment: (equipment: Equipment) => void;
}

export type UnitEditingSection =
  | 'id'
  | 'tenure'
  | 'cap'
  | 'hitch'
  | 'maint'
  | 'verif'
  | 'insurance'
  | 'gps'
  | null;
