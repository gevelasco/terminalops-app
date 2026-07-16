import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FleetUnitDetailDrawerFacade } from '../fleet-unit-detail-drawer.facade';
import {
  FLEET_DETAIL_DRAWER_TAB_IMPORTS,
  FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_2,
} from '@features/fleet/components/fleet-detail-drawer.shared';
import { FleetInsurancePaymentScheduleComponent } from '@features/fleet/components/fleet-insurance-payment-schedule/fleet-insurance-payment-schedule.component';

@Component({
  selector: 'app-fleet-unit-detail-ficha-tab',
  imports: [...FLEET_DETAIL_DRAWER_TAB_IMPORTS, FleetInsurancePaymentScheduleComponent],
  templateUrl: './fleet-unit-detail-ficha-tab.component.html',
  styleUrls: [...FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_2],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetUnitDetailFichaTabComponent {
  protected readonly vm = inject(FleetUnitDetailDrawerFacade);
}
