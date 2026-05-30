import { DecimalPipe } from '@angular/common';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { FleetHitchValidationBlockComponent } from '@features/fleet/components/fleet-hitch-validation-block/fleet-hitch-validation-block.component';
import { ToFleetUnitInputComponent } from '@shared/ui/to-fleet-unit-input/to-fleet-unit-input.component';
import { ToSelectComponent } from '@shared/ui/to-select/to-select.component';
import { ToTextareaComponent } from '@shared/ui/to-textarea/to-textarea.component';

/** Imports compartidos por pestañas del drawer de equipo (lazy via @defer). */
export const FLEET_EQUIPMENT_DETAIL_TAB_IMPORTS = [
  DecimalPipe,
  ToButtonComponent,
  FleetHitchValidationBlockComponent,
  ToFleetUnitInputComponent,
  ToIconComponent,
  ToInputComponent,
  ToSelectComponent,
  ToTextareaComponent,
] as const;

export const FLEET_EQUIPMENT_DETAIL_TAB_STYLE_URLS = [
  '../../fleet-drawer.shared.scss',
  '../../styles/fleet-drawer-unit-sec.shared.scss',
  '../../fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
  '../../fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
] as const;
