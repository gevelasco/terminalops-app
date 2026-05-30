import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FleetUnitDetailDrawerFacade } from '../fleet-unit-detail-drawer.facade';
import {
  FLEET_UNIT_COB_SECTION_IMPORTS,
  FLEET_UNIT_COB_SECTION_STYLE_URLS,
} from './fleet-unit-cob-section.shared';

@Component({
  selector: 'app-fleet-unit-cob-gps-section',
  imports: [...FLEET_UNIT_COB_SECTION_IMPORTS],
  templateUrl: './fleet-unit-cob-gps-section.component.html',
  styleUrls: [...FLEET_UNIT_COB_SECTION_STYLE_URLS],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetUnitCobGpsSectionComponent {
  protected readonly vm = inject(FleetUnitDetailDrawerFacade);
}
