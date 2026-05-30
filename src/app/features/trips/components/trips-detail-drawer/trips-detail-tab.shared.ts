import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';

/** Imports compartidos por pestañas del drawer de trips (lazy via @defer). */
export const TRIPS_DETAIL_TAB_IMPORTS = [ToButtonComponent] as const;

export const TRIPS_DETAIL_TAB_STYLE_URLS = [
  '../../trips-new-drawer/trips-new-drawer.component.scss',
  '../../../../../shared/ui/to-table/to-table.component.scss',
  '../../../../fleet/components/fleet-drawer.shared.scss',
  '../../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
  '../trips-detail-drawer.component.scss',
] as const;
