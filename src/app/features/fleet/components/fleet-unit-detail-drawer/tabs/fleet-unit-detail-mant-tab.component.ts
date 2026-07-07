import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FleetUnitDetailDrawerFacade } from '../fleet-unit-detail-drawer.facade';
import { FleetDetailMaintSectionComponent } from '@features/fleet/components/fleet-detail-maint-section/fleet-detail-maint-section.component';

@Component({
  selector: 'app-fleet-unit-detail-mant-tab',
  standalone: true,
  imports: [FleetDetailMaintSectionComponent],
  template: `
    <app-fleet-detail-maint-section
      [vm]="$any(vm)"
      sectionId="fleet-udv-maint"
      popoverIdPrefix="fleet-udv-maint"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetUnitDetailMantTabComponent {
  protected readonly vm = inject(FleetUnitDetailDrawerFacade);
}
