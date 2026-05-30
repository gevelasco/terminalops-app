import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FleetEquipmentDetailDrawerFacade } from '../fleet-equipment-detail-drawer.facade';
import {
  FLEET_EQUIPMENT_COB_SECTION_IMPORTS,
  FLEET_EQUIPMENT_COB_SECTION_STYLE_URLS,
} from './fleet-equipment-cob-section.shared';

@Component({
  selector: 'app-fleet-equipment-cob-insurance-section',
  imports: [...FLEET_EQUIPMENT_COB_SECTION_IMPORTS],
  templateUrl: './fleet-equipment-cob-insurance-section.component.html',
  styleUrls: [...FLEET_EQUIPMENT_COB_SECTION_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetEquipmentCobInsuranceSectionComponent {
  protected readonly vm = inject(FleetEquipmentDetailDrawerFacade);
}
