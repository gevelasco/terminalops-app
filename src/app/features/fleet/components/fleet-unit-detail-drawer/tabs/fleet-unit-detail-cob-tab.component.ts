import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FleetUnitCobGpsSectionComponent } from '../sections/fleet-unit-cob-gps-section.component';
import { FleetUnitCobInsuranceSectionComponent } from '../sections/fleet-unit-cob-insurance-section.component';
import { FleetUnitCobVerifSectionComponent } from '../sections/fleet-unit-cob-verif-section.component';
import { FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_2 } from '@features/fleet/components/fleet-detail-drawer.shared';

@Component({
  selector: 'app-fleet-unit-detail-cob-tab',
  imports: [
    FleetUnitCobInsuranceSectionComponent,
    FleetUnitCobGpsSectionComponent,
    FleetUnitCobVerifSectionComponent,
  ],
  templateUrl: './fleet-unit-detail-cob-tab.component.html',
  styleUrls: [...FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_2],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetUnitDetailCobTabComponent {}
