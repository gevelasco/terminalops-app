import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FleetEquipmentDetailDrawerFacade } from '../fleet-equipment-detail-drawer.facade';
import {
  FLEET_EQUIPMENT_DETAIL_TAB_IMPORTS,
  FLEET_EQUIPMENT_DETAIL_TAB_STYLE_URLS,
} from '../fleet-equipment-detail-tab.shared';

@Component({
  selector: 'app-fleet-equipment-detail-mant-tab',
  imports: [...FLEET_EQUIPMENT_DETAIL_TAB_IMPORTS],
  templateUrl: './fleet-equipment-detail-mant-tab.component.html',
  styleUrls: [...FLEET_EQUIPMENT_DETAIL_TAB_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetEquipmentDetailMantTabComponent {
  protected readonly vm = inject(FleetEquipmentDetailDrawerFacade);
}
