import { DecimalPipe } from '@angular/common';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToConfirmDialogComponent } from '@shared/ui/to-confirm-dialog/to-confirm-dialog.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { FleetHitchValidationBlockComponent } from '@features/fleet/components/fleet-hitch-validation-block/fleet-hitch-validation-block.component';
import { ToFleetEquipmentInputComponent } from '@shared/ui/to-fleet-equipment-input/to-fleet-equipment-input.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent } from '@shared/ui/to-select/to-select.component';
import { ToFleetBrandComboboxComponent } from '@shared/ui/to-fleet-brand-combobox/to-fleet-brand-combobox.component';
import { ToFleetVersionComboboxComponent } from '@shared/ui/to-fleet-version-combobox/to-fleet-version-combobox.component';
import { ToTextareaComponent } from '@shared/ui/to-textarea/to-textarea.component';

/** Imports compartidos por pestañas del drawer de unidad. */
export const FLEET_UNIT_DETAIL_TAB_IMPORTS = [
  DecimalPipe,
  ToButtonComponent,
  ToConfirmDialogComponent,
  FleetHitchValidationBlockComponent,
  ToFleetEquipmentInputComponent,
  ToIconComponent,
  ToInputComponent,
  ToSelectComponent,
  ToFleetBrandComboboxComponent,
  ToFleetVersionComboboxComponent,
  ToTextareaComponent,
] as const;

export const FLEET_UNIT_DETAIL_TAB_STYLE_URLS = [
  '../../fleet-drawer.shared.scss',
  '../../styles/fleet-drawer-unit-sec.shared.scss',
  '../fleet-unit-detail-drawer-panel.scss',
  '../fleet-unit-detail-drawer-tables.scss',
  '../fleet-unit-detail-tab-host.scss',
] as const;
