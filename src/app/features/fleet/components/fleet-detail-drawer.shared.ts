import { DecimalPipe } from '@angular/common';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToConfirmDialogComponent } from '@shared/ui/to-confirm-dialog/to-confirm-dialog.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { FleetHitchValidationBlockComponent } from '@features/fleet/components/fleet-hitch-validation-block/fleet-hitch-validation-block.component';
import { ToFleetEquipmentInputComponent } from '@shared/ui/to-fleet-equipment-input/to-fleet-equipment-input.component';
import { ToFleetUnitInputComponent } from '@shared/ui/to-fleet-unit-input/to-fleet-unit-input.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent } from '@shared/ui/to-select/to-select.component';
import { ToFleetBrandComboboxComponent } from '@shared/ui/to-fleet-brand-combobox/to-fleet-brand-combobox.component';
import { ToFleetVersionComboboxComponent } from '@shared/ui/to-fleet-version-combobox/to-fleet-version-combobox.component';
import { ToTextareaComponent } from '@shared/ui/to-textarea/to-textarea.component';

/** Pestañas y secciones anidadas (depth 2 desde components/). */
export const FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_2 = [
  '../../styles/fleet-detail-drawer-content.styles.scss',
  '../../styles/fleet-detail-drawer-tab-host.scss',
] as const;

/** Shell, mant-section y otros hijos directos de `components/`. */
export const FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_1 = [
  '../styles/fleet-detail-drawer-content.styles.scss',
  '../styles/fleet-detail-drawer-tab-host.scss',
] as const;

export const FLEET_DETAIL_DRAWER_SHELL_STYLES = [
  '../styles/fleet-detail-drawer-content.styles.scss',
  '../styles/fleet-detail-drawer-footer.shared.scss',
] as const;

/** Imports compartidos por pestañas y secciones de drawers de flota. */
export const FLEET_DETAIL_DRAWER_TAB_IMPORTS = [
  DecimalPipe,
  ToButtonComponent,
  ToConfirmDialogComponent,
  FleetHitchValidationBlockComponent,
  ToFleetEquipmentInputComponent,
  ToFleetUnitInputComponent,
  ToIconComponent,
  ToInputComponent,
  ToSelectComponent,
  ToFleetBrandComboboxComponent,
  ToFleetVersionComboboxComponent,
  ToTextareaComponent,
] as const;
