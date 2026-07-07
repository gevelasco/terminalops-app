import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FleetEquipmentDetailDrawerFacade } from '../fleet-equipment-detail-drawer.facade';
import { FleetDetailMaintSectionComponent } from '@features/fleet/components/fleet-detail-maint-section/fleet-detail-maint-section.component';

@Component({
  selector: 'app-fleet-equipment-detail-mant-tab',
  standalone: true,
  imports: [FleetDetailMaintSectionComponent],
  template: `
    <app-fleet-detail-maint-section
      [vm]="$any(vm)"
      sectionId="fleet-eq-maint"
      popoverIdPrefix="fleet-eq-maint"
      odometerLabel="Kilómetro aprox. (tractora)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetEquipmentDetailMantTabComponent {
  protected readonly vm = inject(FleetEquipmentDetailDrawerFacade);
}
