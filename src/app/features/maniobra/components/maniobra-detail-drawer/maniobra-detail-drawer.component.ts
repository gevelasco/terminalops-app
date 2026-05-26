import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Trip } from '@shared/models/logistics.models';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToDrawerTabPlaceholderComponent } from '@shared/ui/to-drawer-tab-placeholder/to-drawer-tab-placeholder.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToSegmentControlComponent } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ManiobraDetailManeuverTabComponent } from './tabs/maniobra-detail-maneuver-tab.component';
import { ManiobraDetailSettlementTabComponent } from './tabs/maniobra-detail-settlement-tab.component';
import { ManiobraDetailTrackingTabComponent } from './tabs/maniobra-detail-tracking-tab.component';
import { ManiobraDetailDrawerStore } from './maniobra-detail-drawer.store';

@Component({
  selector: 'app-maniobra-detail-drawer',
  standalone: true,
  providers: [ManiobraDetailDrawerStore, DateShortPipe],
  imports: [
    ToButtonComponent,
    ToIconComponent,
    ToSegmentControlComponent,
    ToSideDrawerComponent,
    ToDrawerTabPlaceholderComponent,
    ManiobraDetailManeuverTabComponent,
    ManiobraDetailSettlementTabComponent,
    ManiobraDetailTrackingTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maniobra-detail-drawer.component.html',
  styleUrls: [
    '../maniobra-new-drawer/maniobra-new-drawer.component.scss',
    '../../../../shared/ui/to-table/to-table.component.scss',
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    './maniobra-detail-drawer.component.scss',
  ],
})
export class ManiobraDetailDrawerComponent {
  protected readonly vm = inject(ManiobraDetailDrawerStore);

  readonly trip = input.required<Trip>();
  readonly operatorName = input.required<string>();

  readonly dismiss = output<void>();
  readonly maniobraTripChange = output<Trip>();

  private readonly cancelDialog = viewChild<ElementRef<HTMLDialogElement>>(
    'cancelDialog',
  );

  constructor() {
    effect(() => {
      this.vm.bindHost(
        {
          trip: this.trip(),
          operatorName: this.operatorName(),
        },
        {
          dismiss: () => this.dismiss.emit(),
          maniobraTripChange: (t) => this.maniobraTripChange.emit(t),
          closeCancelDialog: () => this.closeCancelDialog(),
        },
      );
    });

    afterNextRender(() => this.vm.markReady());
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key !== 'Escape') {
      return;
    }
    const d = this.cancelDialog()?.nativeElement;
    if (d?.open) {
      ev.preventDefault();
      d.close();
      return;
    }
    this.vm.requestDismiss();
  }

  openCancelDialog(): void {
    this.vm.prepareCancelDialog();
    queueMicrotask(() => this.cancelDialog()?.nativeElement.showModal());
  }

  closeCancelDialog(): void {
    this.cancelDialog()?.nativeElement.close();
  }
}
