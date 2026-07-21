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
import { OperatorsDetailDetailsTabComponent } from './tabs/operators-detail-details-tab.component';
import { OperatorsDetailOperationTabComponent } from './tabs/operators-detail-operation-tab.component';
import { OperatorsDetailDrawerFacade } from './operators-detail-drawer.facade';

@Component({
  selector: 'app-operators-detail-drawer',
  standalone: true,
  providers: [OperatorsDetailDrawerFacade],
  imports: [
    ToSideDrawerComponent,
    ToIconComponent,
    ToSegmentControlComponent,
    ToStatusPillComponent,
    OperatorsDetailDetailsTabComponent,
    OperatorsDetailOperationTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operators-detail-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-detail-drawer-footer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
    'operators-detail-drawer.component.scss',
  ],
})
export class OperatorsDetailDrawerComponent {
  protected readonly vm = inject(OperatorsDetailDrawerFacade);

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
