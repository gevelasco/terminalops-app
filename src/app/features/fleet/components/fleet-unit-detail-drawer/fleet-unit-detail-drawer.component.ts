import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';
import { FleetDetailDrawerShellComponent } from '@features/fleet/components/fleet-detail-drawer-shell/fleet-detail-drawer-shell.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToConfirmDialogComponent } from '@shared/ui/to-confirm-dialog/to-confirm-dialog.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { Equipment } from '@shared/models/logistics.models';
import { FleetUnitDetailCobTabComponent } from './tabs/fleet-unit-detail-cob-tab.component';
import { FleetUnitDetailFichaTabComponent } from './tabs/fleet-unit-detail-ficha-tab.component';
import { FleetUnitDetailMantTabComponent } from './tabs/fleet-unit-detail-mant-tab.component';
import { FleetUnitDetailDrawerFacade } from './fleet-unit-detail-drawer.facade';

@Component({
  selector: 'app-fleet-unit-detail-drawer',
  standalone: true,
  providers: [FleetUnitDetailDrawerFacade],
  imports: [
    FleetDetailDrawerShellComponent,
    ToButtonComponent,
    ToConfirmDialogComponent,
    ToIconComponent,
    FleetUnitDetailFichaTabComponent,
    FleetUnitDetailMantTabComponent,
    FleetUnitDetailCobTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-unit-detail-drawer.component.html',
  styleUrls: ['../styles/fleet-detail-drawer-footer.shared.scss'],
})
export class FleetUnitDetailDrawerComponent {
  protected readonly vm = inject(FleetUnitDetailDrawerFacade);

  readonly onRoute = input(false);

  readonly dismiss = output<void>();
  readonly viewHitchedEquipment = output<Equipment>();

  constructor() {
    this.vm.bindHostCallbacks({
      dismiss: () => this.dismiss.emit(),
      viewHitchedEquipment: (equipment: Equipment) =>
        this.viewHitchedEquipment.emit(equipment),
    });

    effect(() => {
      this.vm.syncHostLayout({ onRoute: this.onRoute() });
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    this.vm.onDocKey(ev);
  }
}
