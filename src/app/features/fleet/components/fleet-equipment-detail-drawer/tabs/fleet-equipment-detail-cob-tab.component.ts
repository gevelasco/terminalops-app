import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FleetEquipmentDetailDrawerStore } from '../fleet-equipment-detail-drawer.store';
import {
  FLEET_EQUIPMENT_DETAIL_TAB_IMPORTS,
  FLEET_EQUIPMENT_DETAIL_TAB_STYLE_URLS,
} from '../fleet-equipment-detail-tab.shared';

@Component({
  selector: 'app-fleet-equipment-detail-cob-tab',
  imports: [...FLEET_EQUIPMENT_DETAIL_TAB_IMPORTS],
  templateUrl: './fleet-equipment-detail-cob-tab.component.html',
  styleUrls: [...FLEET_EQUIPMENT_DETAIL_TAB_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetEquipmentDetailCobTabComponent {
  protected readonly vm = inject(FleetEquipmentDetailDrawerStore);
}
