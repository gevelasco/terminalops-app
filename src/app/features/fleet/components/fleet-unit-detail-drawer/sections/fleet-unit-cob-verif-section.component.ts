import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FleetUnitDetailDrawerFacade } from '../fleet-unit-detail-drawer.facade';
import {
  FLEET_UNIT_COB_SECTION_IMPORTS,
  FLEET_UNIT_COB_SECTION_STYLE_URLS,
} from './fleet-unit-cob-section.shared';

@Component({
  selector: 'app-fleet-unit-cob-verif-section',
  imports: [...FLEET_UNIT_COB_SECTION_IMPORTS],
  templateUrl: './fleet-unit-cob-verif-section.component.html',
  styleUrls: [...FLEET_UNIT_COB_SECTION_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetUnitCobVerifSectionComponent {
  protected readonly vm = inject(FleetUnitDetailDrawerFacade);
}
