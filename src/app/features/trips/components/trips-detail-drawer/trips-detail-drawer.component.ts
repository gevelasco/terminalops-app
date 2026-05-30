import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToDrawerTabPlaceholderComponent } from '@shared/ui/to-drawer-tab-placeholder/to-drawer-tab-placeholder.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToSegmentControlComponent } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { TripsDetailManeuverTabComponent } from './tabs/trips-detail-maneuver-tab.component';
import { TripsDetailSettlementTabComponent } from './tabs/trips-detail-settlement-tab.component';
import { TripsDetailTrackingTabComponent } from './tabs/trips-detail-tracking-tab.component';
import { TripsDetailDrawerFacade } from './trips-detail-drawer.facade';

@Component({
  selector: 'app-trips-detail-drawer',
  standalone: true,
  providers: [TripsDetailDrawerFacade, DateShortPipe],
  imports: [
    ToButtonComponent,
    ToIconComponent,
    ToSegmentControlComponent,
    ToSideDrawerComponent,
    ToDrawerTabPlaceholderComponent,
    TripsDetailManeuverTabComponent,
    TripsDetailSettlementTabComponent,
    TripsDetailTrackingTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trips-detail-drawer.component.html',
  styleUrls: [
    '../trips-new-drawer/trips-new-drawer.component.scss',
    '../../../../shared/ui/to-table/to-table.component.scss',
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    './trips-detail-drawer.component.scss',
  ],
})
export class TripsDetailDrawerComponent {
  protected readonly vm = inject(TripsDetailDrawerFacade);

  readonly dismiss = output<void>();

  private readonly cancelDialog = viewChild<ElementRef<HTMLDialogElement>>(
    'cancelDialog',
  );

  constructor() {
    this.vm.bindDismiss(() => this.dismiss.emit());
    this.vm.bindCloseCancelDialog(() => this.closeCancelDialog());
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
