import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FLEET_DETAIL_DRAWER_SHELL_STYLES } from '@features/fleet/components/fleet-detail-drawer.shared';
import type {
  FleetDetailDrawerStatusBanner,
  FleetDetailDrawerTab,
} from '@features/fleet/components/fleet-detail-drawer.types';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';
import { ToSegmentControlComponent } from '@shared/ui/to-segment-control/to-segment-control.component';
import type { ToSegmentTab } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToStatusPillComponent } from '@shared/ui/to-status-pill/to-status-pill.component';

@Component({
  selector: 'app-fleet-detail-drawer-shell',
  standalone: true,
  imports: [
    ToSideDrawerComponent,
    ToIconComponent,
    ToSegmentControlComponent,
    ToStatusPillComponent,
  ],
  templateUrl: './fleet-detail-drawer-shell.component.html',
  styleUrls: [...FLEET_DETAIL_DRAWER_SHELL_STYLES],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetDetailDrawerShellComponent {
  readonly titleId = input.required<string>();
  readonly titleIcon = input.required<ToIconName>();
  readonly titleText = input.required<string>();
  readonly statusBanner = input.required<FleetDetailDrawerStatusBanner>();
  readonly loading = input(false);
  readonly segmentAriaLabel = input.required<string>();
  readonly tabs = input.required<readonly ToSegmentTab<FleetDetailDrawerTab>[]>();
  readonly activeTab = input.required<FleetDetailDrawerTab>();

  readonly dismiss = output<void>();
  readonly tabSelect = output<FleetDetailDrawerTab>();
}
