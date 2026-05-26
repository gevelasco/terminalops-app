import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';

/** Imports compartidos por pestañas del drawer de maniobra (lazy via @defer). */
export const MANIOBRA_DETAIL_TAB_IMPORTS = [ToButtonComponent] as const;

export const MANIOBRA_DETAIL_TAB_STYLE_URLS = [
  '../../maniobra-new-drawer/maniobra-new-drawer.component.scss',
  '../../../../../shared/ui/to-table/to-table.component.scss',
  '../../../../fleet/components/fleet-drawer.shared.scss',
  '../../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
  '../maniobra-detail-drawer.component.scss',
] as const;
