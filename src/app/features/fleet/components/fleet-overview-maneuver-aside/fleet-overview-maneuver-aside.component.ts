import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FleetOverviewManeuverAsideView } from '@features/fleet/utils/fleet-overview-maneuver-aside.util';

@Component({
  selector: 'app-fleet-overview-maneuver-aside',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-overview-maneuver-aside.component.html',
  styleUrl: './fleet-overview-maneuver-aside.component.scss',
})
export class FleetOverviewManeuverAsideComponent {
  readonly view = input.required<FleetOverviewManeuverAsideView>();
}