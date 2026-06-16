import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToSegmentControlComponent } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToStatusPillComponent } from '@shared/ui/to-status-pill/to-status-pill.component';
import { FleetEquipmentDetailCobTabComponent } from './tabs/fleet-equipment-detail-cob-tab.component';
import { FleetEquipmentDetailFichaTabComponent } from './tabs/fleet-equipment-detail-ficha-tab.component';
import { FleetEquipmentDetailMantTabComponent } from './tabs/fleet-equipment-detail-mant-tab.component';
import { FleetEquipmentDetailDrawerFacade } from './fleet-equipment-detail-drawer.facade';
import type { Unit } from '@shared/models/logistics.models';

@Component({
  selector: 'app-fleet-equipment-detail-drawer',
  standalone: true,
  providers: [FleetEquipmentDetailDrawerFacade],
  imports: [
    ToSideDrawerComponent,
    ToIconComponent,
    ToSegmentControlComponent,
    ToStatusPillComponent,
    FleetEquipmentDetailFichaTabComponent,
    FleetEquipmentDetailMantTabComponent,
    FleetEquipmentDetailCobTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-equipment-detail-drawer.component.html',
  styleUrls: [
    '../fleet-drawer.shared.scss',
    '../styles/fleet-drawer-unit-sec.shared.scss',
    '../fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    '../fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
  ],
})
export class FleetEquipmentDetailDrawerComponent {
  protected readonly vm = inject(FleetEquipmentDetailDrawerFacade);

  readonly onRoute = input(false);
  readonly completedManeuverCount = input(0);

  readonly dismiss = output<void>();
  readonly viewAssignedUnit = output<Unit>();

  constructor() {
    this.vm.bindHostCallbacks({
      dismiss: () => this.dismiss.emit(),
      viewAssignedUnit: (unit: Unit) => this.viewAssignedUnit.emit(unit),
    });

    effect(() => {
      this.vm.syncHostLayout({
        onRoute: this.onRoute(),
        completedManeuverCount: this.completedManeuverCount(),
      });
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    this.vm.onDocKey(ev);
  }
}
