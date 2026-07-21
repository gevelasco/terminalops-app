import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import {
  buildCreateDestinationRatePayload,
  priceDraftsFromRate,
  validateDestinationRateForm,
} from '@features/clients/utils/destination-rate-payload';
import { formatMxn } from '@features/reports/utils/reports-money';
import { OperationConfigurationResolverService } from '@shared/services/operation-configuration-resolver.service';
import {
  CLIENT_YES_NO_OPTIONS,
  DESTINATION_RATE_AVAILABILITY_OPTIONS,
  DESTINATION_RATE_TIME_UNIT_OPTIONS,
} from '@shared/catalogs/client-form-options';
import {
  estimatedTimeUnitSuffix,
  estimatedTimesFormStringsFromRate,
} from '@features/clients/utils/destination-rate-estimated-time';
import { formatDestinationRateUpdatedAt } from '@features/clients/utils/format-destination-rate-updated-at';
import type { DestinationRatePriceDraft } from '@shared/models/destination-rate.models';
import { parseHttpApiErrorMessage } from '@shared/utils/http-api-error';
import { ToSelectOption } from '@shared/ui/to-select/to-select.component';

@Injectable()
export class DestinationRatesDetailDrawerFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ratesFeature = inject(DestinationRatesFeatureService);
  private readonly operationConfigs = inject(OperationConfigurationsFeatureService);
  private readonly opResolver = inject(OperationConfigurationResolverService);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);

  private dismissCallback: (() => void) | null = null;

  readonly rate = computed(() => this.ratesFeature.selectedRate()!);
  readonly drawerLoading = signal(true);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly canWriteCommercial = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.CLIENTS),
  );

  readonly yesNoOptions: ToSelectOption[] = CLIENT_YES_NO_OPTIONS;
  readonly availabilityOptions: ToSelectOption[] = DESTINATION_RATE_AVAILABILITY_OPTIONS;
  readonly timeUnitOptions: ToSelectOption[] = DESTINATION_RATE_TIME_UNIT_OPTIONS;

  readonly postalCode = signal('');
  readonly cityMunicipality = signal('');
  readonly locality = signal('');
  readonly originOperationalCenterId = signal('');
  readonly priceDrafts = signal<DestinationRatePriceDraft[]>([]);
  readonly active = signal('yes');
  readonly notes = signal('');
  readonly estimatedArrivalTimeValue = signal('');
  readonly estimatedReturnTimeValue = signal('');
  readonly estimatedTimeUnit = signal('');

  readonly referencePostalCode = signal('');

  readonly headerLabel = computed(() => {
    const r = this.rate();
    const loc = r.locality.trim();
    const cp = r.postalCode.trim();
    if (loc && cp) {
      return `${loc} · CP ${cp}`;
    }
    return cp || loc || 'Tarifa por destino';
  });

  readonly priceRowsDisplay = computed(() =>
    this.rate().prices.map((p) => ({
      label: this.opResolver.resolveLabel(this.opResolver.contextFromRatePrice(p)),
      charge: formatMxn(p.clientCharge),
      operator: formatMxn(p.operatorPaymentEstimate),
      toll: formatMxn(p.estimatedTollAmount),
      updatedAt: formatDestinationRateUpdatedAt(p.updatedAt ?? p.createdAt),
    })),
  );

  readonly lastUpdatedLabel = computed(() => {
    const r = this.rate();
    return formatDestinationRateUpdatedAt(r.updatedAt ?? r.createdAt);
  });

  readonly estimatedTimeSuffix = computed(() =>
    estimatedTimeUnitSuffix(this.estimatedTimeUnit()),
  );

  bindDismiss(cb: () => void): void {
    this.dismissCallback = cb;
  }

  markReady(): void {
    this.syncFromRate();
    this.drawerLoading.set(false);
  }

  requestDismiss(): void {
    this.dismissCallback?.();
  }

  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      if (this.editing()) {
        this.cancelEdit();
        return;
      }
      this.requestDismiss();
    }
  }

  startEdit(): void {
    if (!this.canWriteCommercial()) {
      return;
    }
    this.syncFromRate();
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.syncFromRate();
    this.editing.set(false);
  }

  updatePriceDrafts(rows: DestinationRatePriceDraft[]): void {
    this.priceDrafts.set(rows);
  }

  persist(): void {
    const err = validateDestinationRateForm({
      originOperationalCenterId: this.originOperationalCenterId(),
      postalCode: this.postalCode(),
      cityMunicipality: this.cityMunicipality(),
      locality: this.locality(),
      priceDrafts: this.priceDrafts(),
      estimatedArrivalTimeValue: this.estimatedArrivalTimeValue(),
      estimatedReturnTimeValue: this.estimatedReturnTimeValue(),
      estimatedTimeUnit: this.estimatedTimeUnit(),
    });
    if (err) {
      this.toast.show(err, 'warning');
      return;
    }

    const payload = buildCreateDestinationRatePayload({
      originOperationalCenterId: this.originOperationalCenterId(),
      postalCode: this.postalCode(),
      cityMunicipality: this.cityMunicipality(),
      locality: this.locality(),
      priceDrafts: this.priceDrafts(),
      active: this.active() === 'yes',
      notes: this.notes(),
      estimatedArrivalTimeValue: this.estimatedArrivalTimeValue(),
      estimatedReturnTimeValue: this.estimatedReturnTimeValue(),
      estimatedTimeUnit: this.estimatedTimeUnit(),
      forUpdate: true,
    });

    this.saving.set(true);
    this.ratesFeature
      .updateDestinationRate(this.rate(), payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.operationConfigs.refreshOperationConfigurations();
          this.saving.set(false);
          this.editing.set(false);
          this.syncFromRate();
          this.toast.show('Tarifa actualizada.', 'success');
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudo guardar la tarifa.', 'error');
        },
      });
  }

  remove(): void {
    const id = this.rate().id;
    this.saving.set(true);
    this.ratesFeature
      .deleteDestinationRate(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.show('Tarifa eliminada.', 'success');
          this.requestDismiss();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          const detail = parseHttpApiErrorMessage(err)?.trim() ?? '';
          this.toast.show(
            detail || 'No se pudo eliminar la tarifa.',
            'error',
          );
        },
      });
  }

  private syncFromRate(): void {
    const r = this.rate();
    this.postalCode.set(r.postalCode);
    this.cityMunicipality.set(r.cityMunicipality);
    this.locality.set(r.locality);
    this.originOperationalCenterId.set(r.originOperationalCenterId);
    this.referencePostalCode.set(r.postalCode);
    this.priceDrafts.set(priceDraftsFromRate(r));
    this.active.set(r.active ? 'yes' : 'no');
    this.notes.set(r.notes ?? '');
    const estimated = estimatedTimesFormStringsFromRate(r);
    this.estimatedArrivalTimeValue.set(estimated.arrival);
    this.estimatedReturnTimeValue.set(estimated.returnValue);
    this.estimatedTimeUnit.set(estimated.unit);
  }
}
