import type { Unit } from '@shared/models/logistics.models';

export type { FleetDetailDrawerTab } from '@features/fleet/components/fleet-detail-drawer.types';

export type EquipmentDetailDrawerTab =
  import('@features/fleet/components/fleet-detail-drawer.types').FleetDetailDrawerTab;

export interface FleetEquipmentDetailDrawerHostLayout {
  onRoute: boolean;
}

export interface FleetEquipmentDetailDrawerHostCallbacks {
  dismiss: () => void;
  viewAssignedUnit: (unit: Unit) => void;
}

export type EquipmentEditingSection = 'id' | 'hitch' | 'tenure' | 'tech' | 'insurance' | null;
