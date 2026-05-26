import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FleetUnitDetailDrawerStore } from '../fleet-unit-detail-drawer.store';
import {
  FLEET_UNIT_DETAIL_TAB_IMPORTS,
  FLEET_UNIT_DETAIL_TAB_STYLE_URLS,
} from '../fleet-unit-detail-tab.shared';

@Component({
  selector: 'app-fleet-unit-detail-ficha-tab',
  imports: [...FLEET_UNIT_DETAIL_TAB_IMPORTS],
  templateUrl: './fleet-unit-detail-ficha-tab.component.html',
  styleUrls: [...FLEET_UNIT_DETAIL_TAB_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetUnitDetailFichaTabComponent {
  protected readonly vm = inject(FleetUnitDetailDrawerStore);
}
