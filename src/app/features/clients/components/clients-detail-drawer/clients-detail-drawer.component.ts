import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  output,
} from '@angular/core';
import { COMMERCIAL_HANDSHAKE_ICON_SRC } from '@shared/constants/commercial-handshake-icon';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToConfirmDialogComponent } from '@shared/ui/to-confirm-dialog/to-confirm-dialog.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToSegmentControlComponent } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToStatusPillComponent } from '@shared/ui/to-status-pill/to-status-pill.component';
import { ClientsDetailDrawerFacade } from './clients-detail-drawer.facade';
import { ClientsDetailBalanceTabComponent } from './tabs/clients-detail-balance-tab.component';
import { ClientsDetailDetailsTabComponent } from './tabs/clients-detail-details-tab.component';

@Component({
  selector: 'app-clients-detail-drawer',
  standalone: true,
  providers: [ClientsDetailDrawerFacade],
  imports: [
    ToSideDrawerComponent,
    ToButtonComponent,
    ToConfirmDialogComponent,
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
    '../../../fleet/components/styles/fleet-detail-drawer-footer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
    './clients-detail-drawer.component.scss',
  ],
})
export class ClientsDetailDrawerComponent {
  protected readonly vm = inject(ClientsDetailDrawerFacade);
  protected readonly commercialHandshakeIconSrc = COMMERCIAL_HANDSHAKE_ICON_SRC;

  readonly dismiss = output<void>();

  constructor() {
    this.vm.bindDismiss(() => this.dismiss.emit());
    afterNextRender(() => this.vm.markReady());
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape' && this.vm.deleteConfirmOpen()) {
      this.vm.closeDeleteConfirm();
      return;
    }
    if (this.vm.deleteConfirmOpen()) {
      return;
    }
    this.vm.onDocKey(ev);
  }
}
