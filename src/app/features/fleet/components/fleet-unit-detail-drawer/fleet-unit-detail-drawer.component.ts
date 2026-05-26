import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';
import { Equipment, Unit } from '@shared/models/logistics.models';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToSegmentControlComponent } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToStatusPillComponent } from '@shared/ui/to-status-pill/to-status-pill.component';
import { FleetUnitDetailCobTabComponent } from './tabs/fleet-unit-detail-cob-tab.component';
import { FleetUnitDetailFichaTabComponent } from './tabs/fleet-unit-detail-ficha-tab.component';
import { FleetUnitDetailMantTabComponent } from './tabs/fleet-unit-detail-mant-tab.component';
import { FleetUnitDetailDrawerStore } from './fleet-unit-detail-drawer.store';

@Component({
  selector: 'app-fleet-unit-detail-drawer',
  standalone: true,
  providers: [FleetUnitDetailDrawerStore],
  imports: [
    ToSideDrawerComponent,
    ToIconComponent,
    ToSegmentControlComponent,
    ToStatusPillComponent,
    FleetUnitDetailFichaTabComponent,
    FleetUnitDetailMantTabComponent,
    FleetUnitDetailCobTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-unit-detail-drawer.component.html',
  styleUrls: [
    '../fleet-drawer.shared.scss',
    '../styles/fleet-drawer-unit-sec.shared.scss',
    './fleet-unit-detail-drawer-panel.scss',
  ],
})
export class FleetUnitDetailDrawerComponent {
  protected readonly vm = inject(FleetUnitDetailDrawerStore);

  readonly unit = input.required<Unit>();
  readonly onRoute = input(false);
  readonly completedManeuverCount = input(0);
  readonly completedTripDistanceKm = input<number | null>(null);
  readonly hitchedEquipment = input<Equipment[]>([]);

  readonly dismiss = output<void>();
  readonly viewHitchedEquipment = output<Equipment>();
  readonly unitChange = output<Unit>();

  constructor() {
    effect(() => {
      this.vm.bindHost(
        {
          unit: this.unit(),
          onRoute: this.onRoute(),
          completedManeuverCount: this.completedManeuverCount(),
          completedTripDistanceKm: this.completedTripDistanceKm(),
          hitchedEquipment: this.hitchedEquipment(),
        },
        {
          dismiss: () => this.dismiss.emit(),
          viewHitchedEquipment: (equipment) => this.viewHitchedEquipment.emit(equipment),
          unitChange: (unit) => this.unitChange.emit(unit),
        },
      );
    });

    afterNextRender(() => this.vm.markReady());
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    this.vm.onDocKey(ev);
  }
}
