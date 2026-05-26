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
import { Operator } from '@shared/models/logistics.models';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToSegmentControlComponent } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToStatusPillComponent } from '@shared/ui/to-status-pill/to-status-pill.component';
import { OperatorsDetailDetailsTabComponent } from './tabs/operators-detail-details-tab.component';
import { OperatorsDetailOperationTabComponent } from './tabs/operators-detail-operation-tab.component';
import { OperatorsDetailDrawerStore } from './operators-detail-drawer.store';

@Component({
  selector: 'app-operators-detail-drawer',
  standalone: true,
  providers: [OperatorsDetailDrawerStore],
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
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
    'operators-detail-drawer.component.scss',
  ],
})
export class OperatorsDetailDrawerComponent {
  protected readonly vm = inject(OperatorsDetailDrawerStore);

  readonly operator = input.required<Operator>();

  readonly dismiss = output<void>();
  readonly operatorChange = output<Operator>();

  constructor() {
    effect(() => {
      this.vm.bindHost(
        { operator: this.operator() },
        {
          dismiss: () => this.dismiss.emit(),
          operatorChange: (op) => this.operatorChange.emit(op),
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
