import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FleetEquipmentCobInsuranceSectionComponent } from '../sections/fleet-equipment-cob-insurance-section.component';
import { FleetEquipmentCobVerifSectionComponent } from '../sections/fleet-equipment-cob-verif-section.component';
import { FLEET_EQUIPMENT_DETAIL_TAB_STYLE_URLS } from '../fleet-equipment-detail-tab.shared';

@Component({
  selector: 'app-fleet-equipment-detail-cob-tab',
  imports: [
    FleetEquipmentCobInsuranceSectionComponent,
    FleetEquipmentCobVerifSectionComponent,
  ],
  templateUrl: './fleet-equipment-detail-cob-tab.component.html',
  styleUrls: [...FLEET_EQUIPMENT_DETAIL_TAB_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetEquipmentDetailCobTabComponent {}
