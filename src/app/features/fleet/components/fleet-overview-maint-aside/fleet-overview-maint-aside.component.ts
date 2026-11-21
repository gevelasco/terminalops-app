import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  fleetRenewalBadgeClass,
  type FleetOverviewMaintPanelView,
} from '@features/fleet/utils/fleet-overview-maint-panel.util';
import type { FleetRenewalBucket } from '@features/fleet/utils/fleet-unit-table-row';
@Component({
  selector: 'app-fleet-overview-maint-aside',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-overview-maint-aside.component.html',
  styleUrl: './fleet-overview-maint-aside.component.scss',
})
export class FleetOverviewMaintAsideComponent {
  readonly panel = input.required<FleetOverviewMaintPanelView>();

  badgeClass(bucket: FleetRenewalBucket): string {
    return fleetRenewalBadgeClass(bucket);
  }
}