import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FleetEquipmentDetailDrawerFacade } from '../fleet-equipment-detail-drawer.facade';
import {
  FLEET_DETAIL_DRAWER_TAB_IMPORTS,
  FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_2,
} from '@features/fleet/components/fleet-detail-drawer.shared';

@Component({
  selector: 'app-fleet-equipment-detail-ficha-tab',
  imports: [...FLEET_DETAIL_DRAWER_TAB_IMPORTS],
  templateUrl: './fleet-equipment-detail-ficha-tab.component.html',
  styleUrls: [...FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_2],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetEquipmentDetailFichaTabComponent {
  protected readonly vm = inject(FleetEquipmentDetailDrawerFacade);
}
