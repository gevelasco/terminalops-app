import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService } from '@core/notifications/toast.service';
import { DestinationRateLocationFieldsComponent } from '@features/clients/components/destination-rate-location-fields/destination-rate-location-fields.component';
import { DestinationRatePricesEditorComponent } from '@features/clients/components/destination-rate-prices-editor/destination-rate-prices-editor.component';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import {
  buildCreateDestinationRatePayload,
  createEmptyPriceDraft,
  validateDestinationRateForm,
} from '@features/clients/utils/destination-rate-payload';
import type {
  DestinationRate,
  DestinationRatePriceDraft,
} from '@shared/models/destination-rate.models';
import { DESTINATION_RATE_AVAILABILITY_OPTIONS } from '@shared/catalogs/client-form-options';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent, ToSelectOption } from '@shared/ui/to-select/to-select.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';

@Component({
  selector: 'app-destination-rates-new-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToSideDrawerComponent,
    ToButtonComponent,
    ToIconComponent,
    ToInputComponent,
    ToSelectComponent,
    DestinationRateLocationFieldsComponent,
    DestinationRatePricesEditorComponent,
  ],
  templateUrl: './destination-rates-new-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    './destination-rates-new-drawer.component.scss',
  ],
})
export class DestinationRatesNewDrawerComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ratesFeature = inject(DestinationRatesFeatureService);
  private readonly operationConfigs = inject(OperationConfigurationsFeatureService);
  private readonly toast = inject(ToastService);

  readonly dismiss = output<void>();
  readonly saved = output<DestinationRate>();
  readonly drawerLoading = signal(true);
  readonly saving = signal(false);

  readonly yesNoOptions: ToSelectOption[] = DESTINATION_RATE_AVAILABILITY_OPTIONS;

  readonly postalCode = model('');
  readonly cityMunicipality = model('');
  readonly locality = model('');
  readonly priceDrafts = model<DestinationRatePriceDraft[]>([createEmptyPriceDraft()]);
  readonly active = model('yes');
  readonly notes = model('');

  constructor() {
    afterNextRender(() => this.drawerLoading.set(false));
  }

  submit(): void {
    const err = validateDestinationRateForm({
      postalCode: this.postalCode(),
      cityMunicipality: this.cityMunicipality(),
      locality: this.locality(),
      priceDrafts: this.priceDrafts(),
    });
    if (err) {
      this.toast.show(err, 'warning');
      return;
    }

    const payload = buildCreateDestinationRatePayload({
      postalCode: this.postalCode(),
      cityMunicipality: this.cityMunicipality(),
      locality: this.locality(),
      priceDrafts: this.priceDrafts(),
      active: this.active() === 'yes',
      notes: this.notes(),
    });

    this.saving.set(true);
    this.ratesFeature
      .createDestinationRate(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (row) => {
          this.saving.set(false);
          this.operationConfigs.refreshOperationConfigurations();
          this.toast.show('Tarifa registrada.', 'success');
          this.saved.emit(row);
          this.dismiss.emit();
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudo guardar la tarifa.', 'error');
        },
      });
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }
}
