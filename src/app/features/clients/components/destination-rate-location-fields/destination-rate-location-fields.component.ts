import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import {
  cityMunicipalityLineFromSettlement,
  formatSettlementOptionLabel,
  localityKey,
  normalizeMxPostalCodeDigits,
} from '@features/trips/utils/mx-postal-settlement';
import {
  MexicoPostalCodeService,
  type MxPostalSettlement,
} from '@shared/services/mexico-postal-code.service';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent } from '@shared/ui/to-select/to-select.component';

@Component({
  selector: 'app-destination-rate-location-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToInputComponent, ToSelectComponent],
  templateUrl: './destination-rate-location-fields.component.html',
  styleUrl: './destination-rate-location-fields.component.scss',
})
export class DestinationRateLocationFieldsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly sepomex = inject(MexicoPostalCodeService);

  readonly referencePostalCode = input('');
  readonly disabled = input(false);

  readonly postalCode = model('');
  readonly cityMunicipality = model('');
  readonly locality = model('');

  readonly settlements = signal<MxPostalSettlement[]>([]);
  readonly cpLoading = signal(false);
  readonly cpEditing = signal(false);

  readonly localityOptions = computed(() =>
    this.settlements().map((s) => ({
      value: localityKey(s),
      label: formatSettlementOptionLabel(s),
    })),
  );

  readonly cityLine = computed(() => {
    const saved = this.cityMunicipality().trim();
    const rows = this.settlements();
    if (rows.length > 0) {
      const key = this.settlementConsId().trim();
      const row =
        (key ? rows.find((s) => localityKey(s) === key) : undefined) ?? rows[0];
      return cityMunicipalityLineFromSettlement(row);
    }
    return saved;
  });

  readonly localityLabel = computed(() => {
    const key = this.settlementConsId().trim();
    const rows = this.settlements();
    if (key && rows.length > 0) {
      const row = rows.find((s) => localityKey(s) === key);
      if (row) {
        return formatSettlementOptionLabel(row);
      }
    }
    return this.locality().trim();
  });

  readonly settlementConsId = model('');

  resetCpEditUi(): void {
    this.settlements.set([]);
    this.cpEditing.set(false);
  }

  onCpBlur(): void {
    const digits = normalizeMxPostalCodeDigits(this.postalCode());
    if (digits !== this.postalCode()) {
      this.postalCode.set(digits);
    }
    if (digits.length === 0) {
      this.clearCpFields();
      return;
    }
    if (digits.length !== 5) {
      this.toast.show('El código postal debe tener 5 dígitos.', 'warning');
      return;
    }
    const savedCp = this.referencePostalCode().trim();
    if (digits === savedCp && this.locality().trim()) {
      this.cpEditing.set(false);
      this.settlements.set([]);
      return;
    }
    this.cpEditing.set(true);
    this.settlementConsId.set('');
    this.locality.set('');
    this.cityMunicipality.set('');
    this.fetchSettlements(digits);
  }

  onLocalityChange(value: string): void {
    this.settlementConsId.set(value);
    this.applySelectedSettlement();
  }

  private fetchSettlements(cpDigits: string): void {
    this.cpLoading.set(true);
    this.sepomex
      .lookupByPostalCode(cpDigits)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cpLoading.set(false)),
      )
      .subscribe((rows) => {
        this.settlements.set(rows);
        if (rows.length === 0) {
          this.settlementConsId.set('');
          this.locality.set('');
          this.cityMunicipality.set('');
          this.toast.show('Código postal no encontrado.', 'warning');
          return;
        }
        this.settlementConsId.set('');
        this.locality.set('');
        this.cityMunicipality.set('');
      });
  }

  private applySelectedSettlement(): void {
    const key = this.settlementConsId().trim();
    const settlement =
      key && this.settlements().length > 0
        ? (this.settlements().find((r) => localityKey(r) === key) ?? null)
        : null;
    if (!settlement) {
      return;
    }
    this.locality.set(settlement.settlement);
    this.cityMunicipality.set(cityMunicipalityLineFromSettlement(settlement));
  }

  private clearCpFields(): void {
    this.settlements.set([]);
    this.settlementConsId.set('');
    this.locality.set('');
    this.cityMunicipality.set('');
    this.cpEditing.set(false);
  }
}
