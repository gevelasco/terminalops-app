import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FleetEquipmentDetailDrawerStore } from '../fleet-equipment-detail-drawer.store';
import {
  FLEET_EQUIPMENT_DETAIL_TAB_IMPORTS,
  FLEET_EQUIPMENT_DETAIL_TAB_STYLE_URLS,
} from '../fleet-equipment-detail-tab.shared';

@Component({
  selector: 'app-fleet-equipment-detail-ficha-tab',
  imports: [...FLEET_EQUIPMENT_DETAIL_TAB_IMPORTS],
  templateUrl: './fleet-equipment-detail-ficha-tab.component.html',
  styleUrls: [...FLEET_EQUIPMENT_DETAIL_TAB_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetEquipmentDetailFichaTabComponent {
  protected readonly vm = inject(FleetEquipmentDetailDrawerStore);
}
