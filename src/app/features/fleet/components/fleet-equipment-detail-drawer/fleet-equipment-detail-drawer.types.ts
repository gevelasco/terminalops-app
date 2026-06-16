import type { Unit } from '@shared/models/logistics.models';

export type EquipmentDetailDrawerTab = 'ficha' | 'mant' | 'cob';

/** Contexto de página — catálogos vienen de feature services. */
export interface FleetEquipmentDetailDrawerHostLayout {
  onRoute: boolean;
  completedManeuverCount: number;
}

export interface FleetEquipmentDetailDrawerHostCallbacks {
  dismiss: () => void;
  viewAssignedUnit: (unit: Unit) => void;
}

export type EquipmentEditingSection = 'id' | 'hitch' | 'tenure' | 'tech' | 'insurance' | null;
