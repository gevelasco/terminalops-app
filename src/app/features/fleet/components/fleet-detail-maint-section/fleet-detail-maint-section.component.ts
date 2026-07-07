import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  FLEET_DETAIL_DRAWER_TAB_IMPORTS,
  FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_1,
  FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_2,
  FLEET_DETAIL_DRAWER_SHELL_STYLES,
} from '@features/fleet/components/fleet-detail-drawer.shared';
import type { FleetDetailMaintSectionVm } from './fleet-detail-maint-section.vm';

@Component({
  selector: 'app-fleet-detail-maint-section',
  standalone: true,
  imports: [...FLEET_DETAIL_DRAWER_TAB_IMPORTS],
  templateUrl: './fleet-detail-maint-section.component.html',
  styleUrls: [...FLEET_DETAIL_DRAWER_TAB_STYLES_DEPTH_1],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetDetailMaintSectionComponent {
  // Structural typing: ambos facades de drawer implementan el contrato.
  readonly vm = input.required<FleetDetailMaintSectionVm & object>();
  readonly sectionId = input.required<string>();
  readonly popoverIdPrefix = input.required<string>();
  readonly odometerLabel = input('Kilómetro aprox.');
}
