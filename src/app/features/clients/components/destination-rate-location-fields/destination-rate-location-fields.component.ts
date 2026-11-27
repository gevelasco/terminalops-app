import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  model,
  output,
  signal,
  effect,
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
import { MexicoGeoStateService } from '@shared/services/mexico-geo-state.service';
import { MexicoMunicipalitiesService } from '@shared/services/mexico-municipalities.service';
import {
  normalizePlaceKey,
  type DestinationRateScope,
} from '@shared/models/destination-rate-scope';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent, type ToSelectOption } from '@shared/ui/to-select/to-select.component';

@Component({
  selector: 'app-destination-rate-location-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToInputComponent, ToSelectComponent],
  templateUrl: './destination-rate-location-fields.component.html',
  styleUrl: './destination-rate-location-fields.component.scss',
  host: {
    class: 'destination-rate-location-fields-host',
    '[class.route-form-host]': 'routeFormLayout()',
  },
})
export class DestinationRateLocationFieldsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly sepomex = inject(MexicoPostalCodeService);
  private readonly mexicoGeo = inject(MexicoGeoStateService);
  private readonly mexicoMunicipalities = inject(MexicoMunicipalitiesService);

  readonly referencePostalCode = input('');
  readonly disabled = input(false);
  /** Layout en grid del drawer «Nueva tarifa» (CP junto al centro operativo). */
  readonly routeFormLayout = input(false);
  readonly scope = input<DestinationRateScope>('postal_code');

  readonly postalCode = model('');
  readonly cityMunicipality = model('');
  readonly locality = model('');
  readonly municipalityName = model('');
  readonly stateName = model('');

  private readonly stateOptionsSignal = signal<ToSelectOption[]>([]);
  private readonly municipalityOptionsSignal = signal<ToSelectOption[]>([]);
  readonly municipalityOptionsLoading = signal(false);

  readonly settlements = signal<MxPostalSettlement[]>([]);
  readonly cpLoading = signal(false);
  readonly cpEditing = signal(false);
  /** CP + localidad con los que la ruta quedó resuelta (para detectar cambios dígito a dígito). */
  private readonly routeAnchorCp = signal('');

  /** El padre debe invalidar ruta, casetas, métricas y borradores de precios. */
  readonly postalCodeRouteReset = output<void>();

  constructor() {
    this.mexicoGeo.preload();
    this.mexicoMunicipalities.preload();
    this.mexicoGeo
      .whenReady()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((geo) => {
        const opts =
          geo?.features
            ?.map((f) => f.properties?.name?.trim() ?? '')
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'es'))
            .map((name) => ({ value: name, label: name })) ?? [];
        this.stateOptionsSignal.set(opts);
      });
    effect(() => {
      const cp = normalizeMxPostalCodeDigits(this.postalCode());
      const ref = normalizeMxPostalCodeDigits(this.referencePostalCode());
      const locality = this.locality().trim();
      if (cp.length === 5 && locality && ref.length === 5 && cp === ref) {
        this.routeAnchorCp.set(cp);
      }
    });
    effect(() => {
      const scope = this.scope();
      if (scope === 'postal_code') {
        return;
      }
      this.syncCityMunicipalityFromScopeFields();
    });
    effect((onCleanup) => {
      if (this.scope() !== 'municipality') {
        this.municipalityOptionsSignal.set([]);
        this.municipalityOptionsLoading.set(false);
        return;
      }
      const state = this.stateName().trim();
      if (!state) {
        this.municipalityOptionsSignal.set([]);
        this.municipalityOptionsLoading.set(false);
        return;
      }
      this.municipalityOptionsLoading.set(true);
      const sub = this.mexicoMunicipalities
        .municipalityOptionsForState(state)
        .subscribe((opts) => {
          this.municipalityOptionsSignal.set(opts);
          this.municipalityOptionsLoading.set(false);
          this.reconcileMunicipalitySelection(opts);
        });
      onCleanup(() => sub.unsubscribe());
    });
  }

  readonly stateOptions = computed(() => this.stateOptionsSignal());
  readonly municipalityOptions = computed(() => this.municipalityOptionsSignal());

  onStateNameChange(value: string): void {
    const next = String(value ?? '').trim();
    const prev = this.stateName().trim();
    if (next === prev) {
      return;
    }
    this.stateName.set(next);
    // Al cambiar estado (o en scope estado) el municipio ya no aplica.
    this.municipalityName.set('');
    this.syncCityMunicipalityFromScopeFields();
    this.postalCodeRouteReset.emit();
  }

  onMunicipalityNameChange(value: string): void {
    const next = String(value ?? '').trim();
    if (next === this.municipalityName().trim()) {
      return;
    }
    this.municipalityName.set(next);
    this.syncCityMunicipalityFromScopeFields();
    this.postalCodeRouteReset.emit();
  }

  /**
   * Si el valor guardado no está en el catálogo (p. ej. quedó el nombre del
   * estado tras migrar de política), lo limpia para forzar selección válida.
   */
  private reconcileMunicipalitySelection(opts: readonly ToSelectOption[]): void {
    const current = this.municipalityName().trim();
    if (!current) {
      return;
    }
    const state = this.stateName().trim();
    if (
      state &&
      normalizePlaceKey(current) === normalizePlaceKey(state)
    ) {
      this.municipalityName.set('');
      this.syncCityMunicipalityFromScopeFields();
      return;
    }
    const match = opts.find(
      (o) => normalizePlaceKey(o.value) === normalizePlaceKey(current),
    );
    if (!match) {
      this.municipalityName.set('');
      this.syncCityMunicipalityFromScopeFields();
      return;
    }
    if (match.value !== current) {
      this.municipalityName.set(match.value);
      this.syncCityMunicipalityFromScopeFields();
    }
  }

  private syncCityMunicipalityFromScopeFields(): void {
    const scope = this.scope();
    const state = this.stateName().trim();
    const muni = this.municipalityName().trim();
    if (scope === 'state') {
      this.cityMunicipality.set(state);
      this.locality.set('');
      this.postalCode.set('');
      return;
    }
    if (scope === 'municipality') {
      this.cityMunicipality.set(
        muni && state ? `${muni}, ${state}` : state,
      );
      this.locality.set('');
      this.postalCode.set('');
    }
  }

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

  onPostalCodeInput(raw: string): void {
    const digits = normalizeMxPostalCodeDigits(raw);
    if (digits !== this.postalCode()) {
      this.postalCode.set(digits);
    }
  }

  onPostalCodeValueChange(raw: string): void {
    this.onPostalCodeInput(raw);
    const digits = normalizeMxPostalCodeDigits(raw);
    const anchor = this.routeAnchorCp();
    const hadPlace =
      Boolean(this.locality().trim()) ||
      Boolean(this.cityMunicipality().trim()) ||
      this.settlements().length > 0 ||
      this.cpEditing();
    const breaksAnchor = anchor
      ? digits !== anchor
      : hadPlace && digits.length > 0;
    if (!breaksAnchor) {
      return;
    }
    this.clearCpFields();
    this.routeAnchorCp.set('');
    this.postalCodeRouteReset.emit();
  }

  onCpSearch(): void {
    if (this.disabled() || this.cpLoading()) {
      return;
    }
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
    const cp = normalizeMxPostalCodeDigits(this.postalCode());
    if (cp.length === 5) {
      this.routeAnchorCp.set(cp);
    }
    this.cpEditing.set(false);
    this.settlements.set([]);
  }

  private clearCpFields(): void {
    this.settlements.set([]);
    this.settlementConsId.set('');
    this.locality.set('');
    this.cityMunicipality.set('');
    this.cpEditing.set(false);
  }
}
