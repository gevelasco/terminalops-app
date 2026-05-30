export type EquipmentDetailDrawerTab = 'ficha' | 'mant' | 'cob';

/** Contexto de página — catálogos vienen de feature services. */
export interface FleetEquipmentDetailDrawerHostLayout {
  onRoute: boolean;
  completedManeuverCount: number;
}

export interface FleetEquipmentDetailDrawerHostCallbacks {
  dismiss: () => void;
}

export type EquipmentEditingSection = 'id' | 'hitch' | 'tenure' | 'tech' | 'insurance' | null;
