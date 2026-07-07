import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FleetEquipmentCobInsuranceSectionComponent } from '../sections/fleet-equipment-cob-insurance-section.component';
import { FleetEquipmentCobVerifSectionComponent } from '../sections/fleet-equipment-cob-verif-section.component';
import { FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_2 } from '@features/fleet/components/fleet-detail-drawer.shared';

@Component({
  selector: 'app-fleet-equipment-detail-cob-tab',
  imports: [
    FleetEquipmentCobInsuranceSectionComponent,
    FleetEquipmentCobVerifSectionComponent,
  ],
  templateUrl: './fleet-equipment-detail-cob-tab.component.html',
  styleUrls: [...FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_2],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetEquipmentDetailCobTabComponent {}
