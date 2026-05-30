import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FleetUnitDetailDrawerFacade } from '../fleet-unit-detail-drawer.facade';
import {
  FLEET_UNIT_DETAIL_TAB_IMPORTS,
  FLEET_UNIT_DETAIL_TAB_STYLE_URLS,
} from '../fleet-unit-detail-tab.shared';

@Component({
  selector: 'app-fleet-unit-detail-mant-tab',
  imports: [...FLEET_UNIT_DETAIL_TAB_IMPORTS],
  templateUrl: './fleet-unit-detail-mant-tab.component.html',
  styleUrls: [...FLEET_UNIT_DETAIL_TAB_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetUnitDetailMantTabComponent {
  protected readonly vm = inject(FleetUnitDetailDrawerFacade);
}
