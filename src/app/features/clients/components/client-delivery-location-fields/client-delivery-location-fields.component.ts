import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
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
  geocodeQueryFromSettlement,
  localityKey,
  normalizeMxPostalCodeDigits,
} from '@features/trips/utils/mx-postal-settlement';
import {
  MexicoPostalCodeService,
  type MxPostalSettlement,
} from '@shared/services/mexico-postal-code.service';
import { PhotonPlaceSearchService } from '@shared/services/photon-place-search.service';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent } from '@shared/ui/to-select/to-select.component';

@Component({
  selector: 'app-client-delivery-location-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToInputComponent, ToSelectComponent],
  templateUrl: './client-delivery-location-fields.component.html',
  styleUrl: './client-delivery-location-fields.component.scss',
})
export class ClientDeliveryLocationFieldsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly sepomex = inject(MexicoPostalCodeService);
  private readonly photon = inject(PhotonPlaceSearchService);

  /** CP guardado en BD; si el blur coincide, no se consulta SEPOMEX. */
  readonly referencePostalCode = input('');

  readonly disabled = input(false);

  readonly postalCode = model('');
  readonly cityMunicipality = model('');
  readonly locality = model('');
  readonly settlementConsId = model('');
  readonly latitude = model<number | null>(null);
  readonly longitude = model<number | null>(null);

  readonly settlements = signal<MxPostalSettlement[]>([]);
  readonly cpLoading = signal(false);
  readonly cpEditing = signal(false);
  private readonly coordsFromDb = signal(false);

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

  readonly showCoords = computed(
    () => this.latitude() != null && this.longitude() != null,
  );

  readonly latDisplay = computed(() => this.formatCoord(this.latitude()));
  readonly lonDisplay = computed(() => this.formatCoord(this.longitude()));

  constructor() {
    effect(() => {
      const refCp = this.referencePostalCode().trim();
      const cp = this.postalCode().trim();
      if (refCp.length === 5 && cp === refCp) {
        this.cpEditing.set(false);
        this.settlements.set([]);
        this.coordsFromDb.set(
          this.latitude() != null &&
            this.longitude() != null &&
            !!this.locality().trim(),
        );
      }
    });
  }

  /** Restablece el modo lectura (p. ej. al cargar datos desde la API). */
  resetCpEditUi(): void {
    this.settlements.set([]);
    this.cpEditing.set(false);
    this.coordsFromDb.set(
      this.postalCode().trim().length === 5 &&
        this.latitude() != null &&
        this.longitude() != null &&
        !!this.locality().trim(),
    );
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
    if (digits === savedCp) {
      this.cpEditing.set(false);
      this.settlements.set([]);
      this.coordsFromDb.set(
        this.latitude() != null &&
          this.longitude() != null &&
          !!this.locality().trim(),
      );
      return;
    }
    this.cpEditing.set(true);
    this.coordsFromDb.set(false);
    this.settlementConsId.set('');
    this.locality.set('');
    this.cityMunicipality.set('');
    this.latitude.set(null);
    this.longitude.set(null);
    this.fetchSettlements(digits);
  }

  onLocalityChange(value: string): void {
    this.settlementConsId.set(value);
    this.coordsFromDb.set(false);
    this.applySelectedSettlement();
    this.geocodeSelectedSettlement();
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
          this.latitude.set(null);
          this.longitude.set(null);
          this.coordsFromDb.set(false);
          this.toast.show('Código postal no encontrado.', 'warning');
          return;
        }
        this.settlementConsId.set('');
        this.locality.set('');
        this.cityMunicipality.set('');
        this.latitude.set(null);
        this.longitude.set(null);
        this.coordsFromDb.set(false);
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

  private geocodeSelectedSettlement(): void {
    if (this.coordsFromDb()) {
      return;
    }
    const cp = normalizeMxPostalCodeDigits(this.postalCode());
    const key = this.settlementConsId().trim();
    const settlement =
      key && this.settlements().length > 0
        ? (this.settlements().find((r) => localityKey(r) === key) ?? null)
        : null;
    if (!settlement || cp.length !== 5) {
      return;
    }
    this.photon
      .firstCoordinatesForMexicanSepomex(
        geocodeQueryFromSettlement(settlement, cp),
        {
          state: settlement.state,
          municipality: settlement.municipality,
          settlement: settlement.settlement,
        },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((coords) => {
        this.latitude.set(coords?.lat ?? null);
        this.longitude.set(coords?.lon ?? null);
      });
  }

  private clearCpFields(): void {
    this.settlements.set([]);
    this.settlementConsId.set('');
    this.locality.set('');
    this.cityMunicipality.set('');
    this.latitude.set(null);
    this.longitude.set(null);
    this.coordsFromDb.set(false);
    this.cpEditing.set(false);
  }

  private formatCoord(n: number | null): string {
    if (n == null || !Number.isFinite(n)) {
      return '—';
    }
    return n.toFixed(6);
  }
}
