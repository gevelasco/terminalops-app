import type { ToSegmentTab } from '@shared/ui/to-segment-control/to-segment-control.component';
import { FLEET_UNIT_DETAIL_TAB_SYMBOLS } from './fleet-unit-detail-tab-symbols';

export type FleetUnitDetailSegmentTabId = 'ficha' | 'mant' | 'cob';

export function fleetUnitDetailSegmentTabs(
  htmlIdPrefix: 'fleet-udv' | 'fleet-eqd',
): readonly ToSegmentTab<FleetUnitDetailSegmentTabId>[] {
  return [
    {
      id: 'ficha',
      label: 'Ficha técnica',
      iconPath: FLEET_UNIT_DETAIL_TAB_SYMBOLS.ficha,
      iconViewBox: FLEET_UNIT_DETAIL_TAB_SYMBOLS.viewBox,
      htmlId: `${htmlIdPrefix}-tab-ficha`,
    },
    {
      id: 'mant',
      label: 'Mantenimiento',
      iconPath: FLEET_UNIT_DETAIL_TAB_SYMBOLS.mant,
      iconViewBox: FLEET_UNIT_DETAIL_TAB_SYMBOLS.viewBox,
      htmlId: `${htmlIdPrefix}-tab-mant`,
    },
    {
      id: 'cob',
      label: 'Coberturas',
      iconPath: FLEET_UNIT_DETAIL_TAB_SYMBOLS.cob,
      iconViewBox: FLEET_UNIT_DETAIL_TAB_SYMBOLS.viewBox,
      htmlId: `${htmlIdPrefix}-tab-cob`,
    },
  ];
}
