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
import type { Client } from '@shared/models/client.models';
import { ToDrawerTabPlaceholderComponent } from '@shared/ui/to-drawer-tab-placeholder/to-drawer-tab-placeholder.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToSegmentControlComponent } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToStatusPillComponent } from '@shared/ui/to-status-pill/to-status-pill.component';
import { ClientsDetailBalanceTabComponent } from './tabs/clients-detail-balance-tab.component';
import { ClientsDetailDetailsTabComponent } from './tabs/clients-detail-details-tab.component';
import { ClientsDetailDrawerStore } from './clients-detail-drawer.store';

@Component({
  selector: 'app-clients-detail-drawer',
  standalone: true,
  providers: [ClientsDetailDrawerStore],
  imports: [
    ToSideDrawerComponent,
    ToIconComponent,
    ToSegmentControlComponent,
    ToStatusPillComponent,
    ToDrawerTabPlaceholderComponent,
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
  protected readonly vm = inject(ClientsDetailDrawerStore);

  readonly client = input.required<Client>();

  readonly dismiss = output<void>();
  readonly clientChange = output<Client>();

  constructor() {
    effect(() => {
      this.vm.bindHost(
        { client: this.client() },
        {
          dismiss: () => this.dismiss.emit(),
          clientChange: (c) => this.clientChange.emit(c),
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
