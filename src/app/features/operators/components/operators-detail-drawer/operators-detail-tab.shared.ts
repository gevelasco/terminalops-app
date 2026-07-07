import { FormsModule } from '@angular/forms';
import { OperatorCoverageFieldsComponent } from '../operator-coverage-fields/operator-coverage-fields.component';
import { OperatorEmergencyContactFieldsComponent } from '../operator-emergency-contact-fields/operator-emergency-contact-fields.component';
import { OperatorIdentificationFieldsComponent } from '../operator-identification-fields/operator-identification-fields.component';
import { OperatorOperationFieldsComponent } from '../operator-operation-fields/operator-operation-fields.component';
import { ToBadgeComponent } from '@shared/ui/to-badge/to-badge.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToSelectComponent } from '@shared/ui/to-select/to-select.component';

/** Imports compartidos por pestañas del drawer de operador (lazy via @defer). */
export const OPERATORS_DETAIL_TAB_IMPORTS = [
  FormsModule,
  OperatorCoverageFieldsComponent,
  OperatorEmergencyContactFieldsComponent,
  OperatorIdentificationFieldsComponent,
  OperatorOperationFieldsComponent,
  ToBadgeComponent,
  ToButtonComponent,
  ToIconComponent,
  ToSelectComponent,
] as const;

export const OPERATORS_DETAIL_TAB_STYLE_URLS = [
  '../../../../fleet/components/fleet-drawer.shared.scss',
  '../../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
  '../../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
  '../../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
  '../operators-detail-drawer.component.scss',
] as const;
