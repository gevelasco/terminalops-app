import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  output,
} from '@angular/core';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToSegmentControlComponent } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToStatusPillComponent } from '@shared/ui/to-status-pill/to-status-pill.component';
import { ClientsDetailBalanceTabComponent } from './tabs/clients-detail-balance-tab.component';
import { ClientsDetailDetailsTabComponent } from './tabs/clients-detail-details-tab.component';
import { ClientsDetailDrawerFacade } from './clients-detail-drawer.facade';

@Component({
  selector: 'app-clients-detail-drawer',
  standalone: true,
  providers: [ClientsDetailDrawerFacade],
  imports: [
    ToSideDrawerComponent,
    ToIconComponent,
    ToSegmentControlComponent,
    ToStatusPillComponent,
    ClientsDetailDetailsTabComponent,
    ClientsDetailBalanceTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clients-detail-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
    './clients-detail-drawer.component.scss',
  ],
})
export class ClientsDetailDrawerComponent {
  protected readonly vm = inject(ClientsDetailDrawerFacade);

  readonly dismiss = output<void>();

  constructor() {
    this.vm.bindDismiss(() => this.dismiss.emit());
    afterNextRender(() => this.vm.markReady());
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    this.vm.onDocKey(ev);
  }
}
