import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FleetComplianceIconView } from '@features/fleet/utils/fleet-compliance-icons.util';
import { fleetRenewalIconClass } from '@features/fleet/utils/fleet-overview-card';
import type { FleetRenewalBucket } from '@features/fleet/utils/fleet-unit-table-row';

@Component({
  selector: 'to-fleet-compliance-icons',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './to-fleet-compliance-icons.component.html',
  styleUrl: './to-fleet-compliance-icons.component.scss',
})
export class ToFleetComplianceIconsComponent {
  readonly items = input<readonly FleetComplianceIconView[]>([]);

  iconClass(bucket: FleetRenewalBucket): string {
    return fleetRenewalIconClass(bucket);
  }
}
