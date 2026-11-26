import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { DestinationRateLocationFieldsComponent } from '@features/clients/components/destination-rate-location-fields/destination-rate-location-fields.component';
import { OperationalCenterSelectComponent } from '@features/clients/components/operational-center-select/operational-center-select.component';
import { DestinationRatePricesEditorComponent } from '@features/clients/components/destination-rate-prices-editor/destination-rate-prices-editor.component';
import { DestinationRateRouteMapDialogComponent } from '@features/clients/components/destination-rate-route-map-dialog/destination-rate-route-map-dialog.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToConfirmDialogComponent } from '@shared/ui/to-confirm-dialog/to-confirm-dialog.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToStatusPillComponent } from '@shared/ui/to-status-pill/to-status-pill.component';
import { DestinationRatesDetailDrawerFacade } from './destination-rates-detail-drawer.facade';

@Component({
  selector: 'app-destination-rates-detail-drawer',
  standalone: true,
  providers: [DestinationRatesDetailDrawerFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToSideDrawerComponent,
    ToIconComponent,
    ToButtonComponent,
    ToConfirmDialogComponent,
    ToInputComponent,
    ToStatusPillComponent,
    OperationalCenterSelectComponent,
    DestinationRateLocationFieldsComponent,
    DestinationRatePricesEditorComponent,
    DestinationRateRouteMapDialogComponent,
  ],
  templateUrl: './destination-rates-detail-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-detail-drawer-footer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
    './destination-rates-detail-drawer.component.scss',
  ],
})
export class DestinationRatesDetailDrawerComponent {
  protected readonly vm = inject(DestinationRatesDetailDrawerFacade);

  private readonly pricesEditor = viewChild(DestinationRatePricesEditorComponent);

  readonly dismiss = output<void>();

  saveEdit(): void {
    const routeTollPlazas = this.pricesEditor()?.routeTollPlazasForPersist();
    this.vm.persist(routeTollPlazas);
  }

  onPostalRouteReset(): void {
    this.vm.onPostalRouteReset(this.pricesEditor());
  }

  constructor() {
    this.vm.bindDismiss(() => this.dismiss.emit());
    afterNextRender(() => this.vm.markReady());
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    this.vm.onDocKey(ev);
  }
}
