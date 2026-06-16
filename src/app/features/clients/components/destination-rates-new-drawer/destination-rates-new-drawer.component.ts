import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { DestinationRatesService as DestinationRatesApiService } from '@services/api/destination-rates';
import { DestinationRateLocationFieldsComponent } from '@features/clients/components/destination-rate-location-fields/destination-rate-location-fields.component';
import { DestinationRatePricesEditorComponent } from '@features/clients/components/destination-rate-prices-editor/destination-rate-prices-editor.component';
import { OperationalCenterSelectComponent } from '@features/clients/components/operational-center-select/operational-center-select.component';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { OperationalCentersFeatureService } from '@features/clients/services/operational-centers.service';
import {
  buildCreateDestinationRatePayload,
  createEmptyPriceDraft,
  validateDestinationRateForm,
} from '@features/clients/utils/destination-rate-payload';
import {
  buildDestinationRateRouteKey,
  destinationRateRouteKeyFingerprint,
  destinationRateRouteKeysEqual,
  type DestinationRateRouteDrawerMode,
  type DestinationRateRouteKey,
} from '@features/clients/utils/destination-rate-route-duplicate-state';
import { destinationRateHasRouteCache } from '@features/clients/utils/find-destination-rate-by-postal-code';
import {
  isDestinationRateRouteInputComplete,
  operationalDistanceFromRouteKm,
} from '@features/clients/utils/destination-rate-route-resolution';
import { formatRouteKmEsMx } from '@features/trips/utils/maniobra-route-display';
import type {
  DestinationRate,
  DestinationRatePriceDraft,
} from '@shared/models/destination-rate.models';
import {
  DESTINATION_RATE_AVAILABILITY_OPTIONS,
  DESTINATION_RATE_TIME_UNIT_OPTIONS,
} from '@shared/catalogs/client-form-options';
import { estimatedTimeUnitSuffix } from '@features/clients/utils/destination-rate-estimated-time';
import { isValidLatLon, latLonFromPrefill } from '@shared/services/lat-lon';
import type { LatLon } from '@shared/services/osrm-driving-route.service';
import { OsrmDrivingRouteService } from '@shared/services/osrm-driving-route.service';
import { PhotonPlaceSearchService } from '@shared/services/photon-place-search.service';
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
    OperationalCenterSelectComponent,
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
  private readonly ratesApi = inject(DestinationRatesApiService);
  private readonly operationConfigs = inject(OperationConfigurationsFeatureService);
  private readonly centersFeature = inject(OperationalCentersFeatureService);
  private readonly osrm = inject(OsrmDrivingRouteService);
  private readonly photon = inject(PhotonPlaceSearchService);
  private readonly toast = inject(ToastService);

  private readonly originSelect = viewChild(OperationalCenterSelectComponent);

  readonly dismiss = output<void>();
  readonly saved = output<DestinationRate>();
  readonly openExisting = output<DestinationRate>();
  readonly drawerLoading = signal(true);
  readonly saving = signal(false);

  readonly yesNoOptions: ToSelectOption[] = DESTINATION_RATE_AVAILABILITY_OPTIONS;
  readonly timeUnitOptions: ToSelectOption[] = DESTINATION_RATE_TIME_UNIT_OPTIONS;

  readonly originOperationalCenterId = model('');
  readonly postalCode = model('');
  readonly cityMunicipality = model('');
  readonly locality = model('');
  readonly priceDrafts = model<DestinationRatePriceDraft[]>([createEmptyPriceDraft()]);
  readonly active = model('yes');
  readonly notes = model('');
  readonly estimatedArrivalTimeValue = model('');
  readonly estimatedReturnTimeValue = model('');
  readonly estimatedTimeUnit = model('');

  readonly estimatedTimeSuffix = computed(() =>
    estimatedTimeUnitSuffix(this.estimatedTimeUnit()),
  );

  /** CREATE_MODE | EXISTING_ROUTE | INVALIDATED */
  readonly routeMode = signal<DestinationRateRouteDrawerMode>('INVALIDATED');
  private readonly resolvedRouteKey = signal<DestinationRateRouteKey | null>(null);
  private readonly routeDistanceKm = signal<number | null>(null);
  private readonly operationalDistanceKm = signal<number | null>(null);
  private readonly routeLoading = signal(false);
  private readonly duplicateChecking = signal(false);
  private readonly destinationCoords = signal<LatLon | null>(null);
  readonly existingDuplicateRate = signal<DestinationRate | null>(null);

  readonly currentRouteKey = computed(() =>
    buildDestinationRateRouteKey({
      originOperationalCenterId: this.originOperationalCenterId(),
      postalCode: this.postalCode(),
      locality: this.locality(),
    }),
  );

  readonly routeDistanceDisplay = computed(() => {
    if (this.routeLoading() || this.duplicateChecking()) {
      return 'Calculando…';
    }
    const km = this.routeDistanceKm();
    if (km != null && km > 0) {
      return `${formatRouteKmEsMx(km)} km`;
    }
    if (this.routeInputComplete()) {
      return 'No disponible';
    }
    return '';
  });

  readonly operationalDistanceDisplay = computed(() => {
    if (this.routeLoading() || this.duplicateChecking()) {
      return 'Calculando…';
    }
    const km = this.operationalDistanceKm();
    if (km != null && km > 0) {
      return `${formatRouteKmEsMx(km)} km`;
    }
    if (this.routeInputComplete()) {
      return 'No disponible';
    }
    return '';
  });

  readonly routeInputComplete = computed(() =>
    isDestinationRateRouteInputComplete({
      originOperationalCenterId: this.originOperationalCenterId(),
      postalCode: this.postalCode(),
      locality: this.locality(),
      cityMunicipality: this.cityMunicipality(),
    }),
  );

  readonly showDistanceFields = computed(
    () =>
      this.routeInputComplete() ||
      this.routeLoading() ||
      this.duplicateChecking() ||
      this.routeMode() === 'EXISTING_ROUTE' ||
      this.routeDistanceKm() != null,
  );

  readonly canSave = computed(() => {
    if (this.saving() || this.duplicateChecking()) {
      return false;
    }
    if (this.routeMode() !== 'CREATE_MODE') {
      return false;
    }
    return destinationRateRouteKeysEqual(
      this.currentRouteKey(),
      this.resolvedRouteKey(),
    );
  });

  constructor() {
    afterNextRender(() => this.drawerLoading.set(false));
    this.bindRouteDuplicatePipeline();
    this.bindRouteDistancePipeline();
  }

  submit(): void {
    if (this.routeMode() === 'EXISTING_ROUTE' || this.existingDuplicateRate()) {
      this.toast.show('Ya existe una tarifa para esta ruta', 'warning');
      return;
    }
    if (!this.canSave()) {
      return;
    }

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

    const coords = this.destinationCoords();
    const payload = buildCreateDestinationRatePayload({
      originOperationalCenterId: this.originOperationalCenterId(),
      postalCode: this.postalCode(),
      cityMunicipality: this.cityMunicipality(),
      locality: this.locality(),
      priceDrafts: this.priceDrafts(),
      routeDistanceKm: this.routeDistanceKm(),
      destinationLatitude: coords?.lat ?? null,
      destinationLongitude: coords?.lon ?? null,
      active: this.active() === 'yes',
      notes: this.notes(),
      estimatedArrivalTimeValue: this.estimatedArrivalTimeValue(),
      estimatedReturnTimeValue: this.estimatedReturnTimeValue(),
      estimatedTimeUnit: this.estimatedTimeUnit(),
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
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.handleCreateConflict();
            return;
          }
          this.saving.set(false);
          this.toast.show('No se pudo guardar la tarifa.', 'error');
        },
      });
  }

  onOpenExistingRate(): void {
    const rate = this.existingDuplicateRate();
    if (rate) {
      this.openExisting.emit(rate);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }

  /** Phase 1: API check-exists is the only authority for route duplication. */
  private bindRouteDuplicatePipeline(): void {
    combineLatest([
      toObservable(this.originOperationalCenterId),
      toObservable(this.postalCode),
      toObservable(this.locality),
    ])
      .pipe(
        debounceTime(300),
        map(([originId, cp, locality]) =>
          buildDestinationRateRouteKey({
            originOperationalCenterId: originId,
            postalCode: cp,
            locality,
          }),
        ),
        distinctUntilChanged((a, b) => {
          if (!a && !b) {
            return true;
          }
          if (!a || !b) {
            return false;
          }
          return destinationRateRouteKeyFingerprint(a) === destinationRateRouteKeyFingerprint(b);
        }),
        tap((routeKey) => {
          if (!routeKey) {
            this.invalidateRouteResolution();
            return;
          }
          if (!destinationRateRouteKeysEqual(routeKey, this.resolvedRouteKey())) {
            this.invalidateRouteResolution();
          }
        }),
        filter((routeKey): routeKey is DestinationRateRouteKey => routeKey != null),
        switchMap((routeKey) => this.runRouteDuplicateCheck(routeKey)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** Phase 2: OSRM only after CREATE_MODE is confirmed for the current route key. */
  private bindRouteDistancePipeline(): void {
    combineLatest([
      toObservable(this.routeMode),
      toObservable(this.originOperationalCenterId),
      toObservable(this.postalCode),
      toObservable(this.locality),
      toObservable(this.cityMunicipality),
    ])
      .pipe(
        debounceTime(300),
        filter(
          ([mode, originId, cp, locality, cityMunicipality]) =>
            mode === 'CREATE_MODE' &&
            isDestinationRateRouteInputComplete({
              originOperationalCenterId: originId,
              postalCode: cp,
              locality,
              cityMunicipality,
            }),
        ),
        distinctUntilChanged(
          (a, b) =>
            a[0] === b[0] &&
            a[1].trim() === b[1].trim() &&
            a[2] === b[2] &&
            a[3].trim() === b[3].trim() &&
            a[4].trim() === b[4].trim(),
        ),
        switchMap(([, originId, cp, locality, cityMunicipality]) =>
          this.resolveRouteDistances({
            originId: originId.trim(),
            cp,
            locality: locality.trim(),
            cityMunicipality: cityMunicipality.trim(),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private runRouteDuplicateCheck(routeKey: DestinationRateRouteKey) {
    this.duplicateChecking.set(true);
    this.routeMode.set('INVALIDATED');

    return this.ratesApi.checkDestinationRateExists(routeKey).pipe(
      switchMap((check) => {
        if (check.exists && check.destinationRateId) {
          return this.resolveExistingRateById(check.destinationRateId).pipe(
            tap((rate) => {
              if (rate) {
                this.transitionToExistingRoute(rate, routeKey);
              } else {
                this.transitionToCreateMode(routeKey);
                this.toast.show(
                  'La tarifa existente no pudo cargarse. Intenta de nuevo.',
                  'warning',
                );
              }
            }),
            map(() => undefined),
          );
        }
        this.transitionToCreateMode(routeKey);
        return of(undefined);
      }),
      catchError(() => {
        this.invalidateRouteResolution();
        this.toast.show('No se pudo verificar si la ruta ya existe.', 'error');
        return of(undefined);
      }),
      finalize(() => this.duplicateChecking.set(false)),
    );
  }

  private transitionToCreateMode(routeKey: DestinationRateRouteKey): void {
    this.routeMode.set('CREATE_MODE');
    this.resolvedRouteKey.set(routeKey);
    this.existingDuplicateRate.set(null);
    this.clearDistancesOnly();
  }

  private transitionToExistingRoute(
    rate: DestinationRate,
    routeKey: DestinationRateRouteKey,
  ): void {
    this.routeMode.set('EXISTING_ROUTE');
    this.resolvedRouteKey.set(routeKey);
    this.existingDuplicateRate.set(rate);
    this.applyExistingRateDistances(rate);
  }

  private invalidateRouteResolution(): void {
    this.routeMode.set('INVALIDATED');
    this.resolvedRouteKey.set(null);
    this.existingDuplicateRate.set(null);
    this.clearDistancesOnly();
    this.duplicateChecking.set(false);
  }

  private handleCreateConflict(): void {
    this.saving.set(false);
    const routeKey = this.currentRouteKey();
    if (!routeKey) {
      this.toast.show('Ya existe una tarifa para esta ruta', 'warning');
      return;
    }

    this.ratesApi
      .checkDestinationRateExists(routeKey)
      .pipe(
        switchMap((check) => {
          if (!check.exists || !check.destinationRateId) {
            this.toast.show('Ya existe una tarifa para esta ruta', 'warning');
            return of(null);
          }
          return this.resolveExistingRateById(check.destinationRateId);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rate) => {
        if (rate) {
          this.transitionToExistingRoute(rate, routeKey);
          this.toast.show(
            'Ya existe una tarifa para esta ruta. Usa la tarifa existente.',
            'warning',
          );
        }
      });
  }

  private resolveExistingRateById(rateId: string) {
    const cached = this.ratesFeature.rates().find((r) => r.id === rateId);
    if (cached) {
      return of(cached);
    }
    return this.ratesApi
      .getDestinationRateById(rateId)
      .pipe(catchError(() => of(null)));
  }

  private applyExistingRateDistances(rate: DestinationRate): void {
    this.destinationCoords.set(null);
    this.routeLoading.set(false);
    if (!destinationRateHasRouteCache(rate)) {
      this.routeDistanceKm.set(null);
      this.operationalDistanceKm.set(null);
      return;
    }
    const routeDistanceKm = rate.routeDistanceKm!;
    this.routeDistanceKm.set(routeDistanceKm);
    this.operationalDistanceKm.set(
      rate.operationalDistanceKm != null && rate.operationalDistanceKm > 0
        ? rate.operationalDistanceKm
        : operationalDistanceFromRouteKm(routeDistanceKm, rate.isRoundTrip !== false),
    );
  }

  private resolveRouteDistances(input: {
    originId: string;
    cp: string;
    locality: string;
    cityMunicipality: string;
  }) {
    if (this.routeMode() !== 'CREATE_MODE') {
      return of(undefined);
    }

    const center =
      this.originSelect()?.selectedCenter() ??
      this.centersFeature.centerById(input.originId);
    const originCoords = latLonFromPrefill(center?.latitude, center?.longitude);
    if (!isValidLatLon(originCoords)) {
      this.clearDistancesOnly();
      return of(undefined);
    }

    const destQuery = [input.locality, input.cityMunicipality, input.cp.trim(), 'México']
      .filter(Boolean)
      .join(', ');

    this.routeLoading.set(true);
    return this.photon.firstCoordinates(destQuery).pipe(
      switchMap((destCoords) => {
        if (this.routeMode() !== 'CREATE_MODE') {
          return of(null);
        }
        if (!isValidLatLon(destCoords)) {
          this.destinationCoords.set(null);
          return of(null);
        }
        this.destinationCoords.set(destCoords);
        return this.osrm.drivingKm(originCoords, destCoords);
      }),
      tap((routeKm) => {
        if (this.routeMode() !== 'CREATE_MODE') {
          return;
        }
        this.routeDistanceKm.set(routeKm);
        this.operationalDistanceKm.set(
          routeKm != null && routeKm > 0
            ? operationalDistanceFromRouteKm(routeKm)
            : null,
        );
      }),
      catchError(() => {
        if (this.routeMode() === 'CREATE_MODE') {
          this.clearDistancesOnly();
        }
        return of(null);
      }),
      finalize(() => {
        if (this.routeMode() === 'CREATE_MODE') {
          this.routeLoading.set(false);
        }
      }),
      map(() => undefined),
    );
  }

  private clearDistancesOnly(): void {
    this.routeDistanceKm.set(null);
    this.operationalDistanceKm.set(null);
    this.routeLoading.set(false);
    this.destinationCoords.set(null);
  }
}
