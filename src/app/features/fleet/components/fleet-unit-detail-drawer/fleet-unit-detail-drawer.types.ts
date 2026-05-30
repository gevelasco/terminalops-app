import type { Equipment } from '@shared/models/logistics.models';

export type UnitDetailDrawerTab = 'ficha' | 'mant' | 'cob';

/** Contexto de página (maniobra en curso, km) — catálogos vienen de feature services. */
export interface FleetUnitDetailDrawerHostLayout {
  onRoute: boolean;
  completedManeuverCount: number;
  completedTripDistanceKm: number | null;
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
