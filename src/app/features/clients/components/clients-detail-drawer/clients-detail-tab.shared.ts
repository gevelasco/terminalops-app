import { FormsModule } from '@angular/forms';
import { ClientContactInlineFieldsComponent } from '../client-contact-inline-fields/client-contact-inline-fields.component';
import { ClientDeliveryLocationFieldsComponent } from '../client-delivery-location-fields/client-delivery-location-fields.component';
import { ClientFiscalFieldsComponent } from '../client-fiscal-fields/client-fiscal-fields.component';
import { ClientIdentificationFieldsComponent } from '../client-identification-fields/client-identification-fields.component';
import { ClientPayFieldsComponent } from '../client-pay-fields/client-pay-fields.component';
import { ToBadgeComponent } from '@shared/ui/to-badge/to-badge.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';

/** Imports compartidos por pestañas del drawer de cliente (lazy via @defer). */
export const CLIENTS_DETAIL_TAB_IMPORTS = [
  ClientContactInlineFieldsComponent,
  ClientDeliveryLocationFieldsComponent,
  ClientFiscalFieldsComponent,
  ClientIdentificationFieldsComponent,
  ClientPayFieldsComponent,
  FormsModule,
  ToBadgeComponent,
  ToButtonComponent,
  ToIconComponent,
  ToIconButtonComponent,
] as const;

export const CLIENTS_DETAIL_TAB_STYLE_URLS = [
  '../../../../fleet/components/fleet-drawer.shared.scss',
  '../../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
  '../../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
  '../../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
  '../clients-detail-drawer.component.scss',
] as const;
