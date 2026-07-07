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
import type { Unit } from '@shared/models/logistics.models';
import { FleetEquipmentDetailCobTabComponent } from './tabs/fleet-equipment-detail-cob-tab.component';
import { FleetEquipmentDetailFichaTabComponent } from './tabs/fleet-equipment-detail-ficha-tab.component';
import { FleetEquipmentDetailMantTabComponent } from './tabs/fleet-equipment-detail-mant-tab.component';
import { FleetEquipmentDetailDrawerFacade } from './fleet-equipment-detail-drawer.facade';

@Component({
  selector: 'app-fleet-equipment-detail-drawer',
  standalone: true,
  providers: [FleetEquipmentDetailDrawerFacade],
  imports: [
    FleetDetailDrawerShellComponent,
    ToButtonComponent,
    ToConfirmDialogComponent,
    ToIconComponent,
    FleetEquipmentDetailFichaTabComponent,
    FleetEquipmentDetailMantTabComponent,
    FleetEquipmentDetailCobTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-equipment-detail-drawer.component.html',
  styleUrls: ['../styles/fleet-detail-drawer-footer.shared.scss'],
})
export class FleetEquipmentDetailDrawerComponent {
  protected readonly vm = inject(FleetEquipmentDetailDrawerFacade);

  readonly onRoute = input(false);

  readonly dismiss = output<void>();
  readonly viewAssignedUnit = output<Unit>();

  constructor() {
    this.vm.bindHostCallbacks({
      dismiss: () => this.dismiss.emit(),
      viewAssignedUnit: (unit: Unit) => this.viewAssignedUnit.emit(unit),
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
