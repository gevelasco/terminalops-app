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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, filter, finalize, map, of, switchMap, tap } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { DestinationRatesService as DestinationRatesApiService } from '@services/api/destination-rates';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { OperationalCentersFeatureService } from '@features/clients/services/operational-centers.service';
import {
  clientDeliveryRouteLinkHint,
  clientDeliveryRouteLinkTitle,
  isClientDeliveryRouteLookupReady,
  resolveClientDeliveryRoutePreview,
  type ClientDeliveryRouteLinkPreview,
} from '@features/clients/utils/client-delivery-route-link';
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
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent } from '@shared/ui/to-select/to-select.component';

@Component({
  selector: 'app-client-delivery-location-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToInputComponent, ToSelectComponent, ToIconComponent],
  templateUrl: './client-delivery-location-fields.component.html',
  styleUrl: './client-delivery-location-fields.component.scss',
})
export class ClientDeliveryLocationFieldsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly sepomex = inject(MexicoPostalCodeService);
  private readonly photon = inject(PhotonPlaceSearchService);
  private readonly ratesApi = inject(DestinationRatesApiService);
  private readonly ratesFeature = inject(DestinationRatesFeatureService);
  private readonly centersFeature = inject(OperationalCentersFeatureService);

  /** CP guardado en BD; si el blur coincide, no se consulta SEPOMEX. */
  readonly referencePostalCode = input('');
  readonly savedDestinationRateId = input<string | null>(null);
  readonly savedIsUnpricedRoute = input(false);

  readonly disabled = input(false);

  readonly postalCode = model('');
  readonly cityMunicipality = model('');
  readonly locality = model('');
  readonly settlementConsId = model('');
  readonly latitude = model<number | null>(null);
  readonly longitude = model<number | null>(null);
  readonly destinationRateId = model<string | null>(null);
  readonly isUnpricedRoute = model(false);

  readonly settlements = signal<MxPostalSettlement[]>([]);
  readonly cpLoading = signal(false);
  readonly cpEditing = signal(false);
  private readonly coordsFromDb = signal(false);

  readonly routeLinkStatus = signal<ClientDeliveryRouteLinkPreview>('idle');
  readonly suggestedRouteCount = signal(0);

  readonly routeLinkTitle = computed(() =>
    clientDeliveryRouteLinkTitle(this.routeLinkStatus()),
  );
  readonly routeLinkHint = computed(() =>
    clientDeliveryRouteLinkHint(this.routeLinkStatus()),
  );

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
    this.centersFeature.loadOperationalCenters();
    this.ratesFeature.loadDestinationRates();

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

    this.bindRouteLinkPipeline();
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
    this.syncRouteLinkFromSaved();
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

  private bindRouteLinkPipeline(): void {
    combineLatest([
      toObservable(this.postalCode),
      toObservable(this.locality),
      toObservable(this.settlementConsId),
    ])
      .pipe(
        debounceTime(300),
        map(([postalCode, locality, settlementConsId]) => ({
          postalCode,
          locality,
          settlementConsId,
        })),
        distinctUntilChanged(
          (a, b) =>
            normalizeMxPostalCodeDigits(a.postalCode) ===
              normalizeMxPostalCodeDigits(b.postalCode) &&
            a.locality.trim().toLowerCase() === b.locality.trim().toLowerCase() &&
            a.settlementConsId.trim() === b.settlementConsId.trim(),
        ),
        tap((input) => {
          if (!isClientDeliveryRouteLookupReady(input)) {
            this.routeLinkStatus.set('idle');
            this.destinationRateId.set(null);
            this.isUnpricedRoute.set(false);
            this.suggestedRouteCount.set(0);
            return;
          }
          this.routeLinkStatus.set('checking');
          this.destinationRateId.set(null);
          this.isUnpricedRoute.set(false);
        }),
        filter(
          (input): input is { postalCode: string; locality: string; settlementConsId: string } =>
            isClientDeliveryRouteLookupReady(input),
        ),
        switchMap((input) => this.resolveRouteLink(input)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private resolveRouteLink(input: { postalCode: string; locality: string }) {
    const primaryOriginCenterId = this.centersFeature.defaultCenter()?.id ?? null;
    const localPreview = resolveClientDeliveryRoutePreview(
      this.ratesFeature.rates(),
      {
        postalCode: input.postalCode,
        locality: input.locality,
        primaryOriginCenterId,
      },
    );
    this.suggestedRouteCount.set(localPreview.matches.length);

    if (!primaryOriginCenterId) {
      this.applyRouteLinkPreview(localPreview.rateId, localPreview.matches.length);
      return of(undefined);
    }

    return this.ratesApi
      .checkDestinationRateExists({
        originOperationalCenterId: primaryOriginCenterId,
        postalCode: input.postalCode,
        locality: input.locality,
      })
      .pipe(
        map((check) => check.destinationRateId ?? localPreview.rateId),
        tap((rateId) => this.applyRouteLinkPreview(rateId, localPreview.matches.length)),
        catchError(() => {
          this.applyRouteLinkPreview(localPreview.rateId, localPreview.matches.length);
          return of(undefined);
        }),
        finalize(() => {
          if (this.routeLinkStatus() === 'checking') {
            this.routeLinkStatus.set('idle');
          }
        }),
        map(() => undefined),
      );
  }

  private applyRouteLinkPreview(rateId: string | null, matchCount: number): void {
    this.suggestedRouteCount.set(matchCount);
    this.destinationRateId.set(rateId);
    this.isUnpricedRoute.set(
      !rateId &&
        isClientDeliveryRouteLookupReady({
          postalCode: this.postalCode(),
          locality: this.locality(),
        }),
    );
    this.routeLinkStatus.set(rateId ? 'linked' : 'unpriced');
  }

  private syncRouteLinkFromSaved(): void {
    const savedRateId = this.savedDestinationRateId()?.trim();
    if (savedRateId) {
      this.destinationRateId.set(savedRateId);
      this.isUnpricedRoute.set(false);
      this.routeLinkStatus.set('linked');
      return;
    }
    if (
      isClientDeliveryRouteLookupReady({
        postalCode: this.postalCode(),
        locality: this.locality(),
      }) &&
      this.savedIsUnpricedRoute()
    ) {
      this.destinationRateId.set(null);
      this.isUnpricedRoute.set(true);
      this.routeLinkStatus.set('unpriced');
    }
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
    this.routeLinkStatus.set('idle');
    this.destinationRateId.set(null);
    this.isUnpricedRoute.set(false);
    this.suggestedRouteCount.set(0);
  }

  private formatCoord(n: number | null): string {
    if (n == null || !Number.isFinite(n)) {
      return '—';
    }
    return n.toFixed(6);
  }
}
