import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FleetInsurancePaymentScheduleComponent } from '@features/fleet/components/fleet-insurance-payment-schedule/fleet-insurance-payment-schedule.component';
import { FleetUnitDetailDrawerFacade } from '../fleet-unit-detail-drawer.facade';
import {
  FLEET_UNIT_COB_SECTION_IMPORTS,
  FLEET_UNIT_COB_SECTION_STYLE_URLS,
} from './fleet-unit-cob-section.shared';

@Component({
  selector: 'app-fleet-unit-cob-insurance-section',
  imports: [...FLEET_UNIT_COB_SECTION_IMPORTS, FleetInsurancePaymentScheduleComponent],
  templateUrl: './fleet-unit-cob-insurance-section.component.html',
  styleUrls: [...FLEET_UNIT_COB_SECTION_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetUnitCobInsuranceSectionComponent {
  protected readonly vm = inject(FleetUnitDetailDrawerFacade);
}
