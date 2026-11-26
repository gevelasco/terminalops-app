import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
import {
  DestinationRatePricesEditorComponent,
  type DestinationRateRouteTollContext,
} from '@features/clients/components/destination-rate-prices-editor/destination-rate-prices-editor.component';
import { OperationalCenterSelectComponent } from '@features/clients/components/operational-center-select/operational-center-select.component';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { OperationalCentersFeatureService } from '@features/clients/services/operational-centers.service';
import {
  buildCreateDestinationRatePayload,
  createEmptyPriceDraft,
  validateDestinationRateForm,
} from '@features/clients/utils/destination-rate-payload';
import { beginInFlight } from '@shared/utils/in-flight-guard';
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
import {
  formatRouteKmEsMx,
  formatRouteKmInputValue,
  parseRouteKmOneWayInput,
} from '@features/trips/utils/maniobra-route-display';
import type {
  DestinationRate,
  DestinationRatePriceDraft,
} from '@shared/models/destination-rate.models';
import { formatEstimatedTimeValueNumber } from '@features/clients/utils/destination-rate-estimated-time';
import {
  suggestedDriveTimeHoursFromRouteKm,
} from '@features/clients/utils/destination-rate-drive-time.util';
import type { RouteTollPlazaRow } from '@core/services/api/routing';
import {
  definedRouteDrivingPoints,
  definedRouteMetricsKey,
} from '@features/clients/utils/destination-rate-defined-route-metrics.util';
import { isValidLatLon, latLonFromPrefill } from '@shared/services/lat-lon';
import type { LatLon } from '@shared/services/osrm-driving-route.service';
import { OsrmDrivingRouteService } from '@shared/services/osrm-driving-route.service';
import { destinationRatePlaceSearchLabel } from '@features/clients/utils/destination-rate-place-search.util';
import { mexicanSepomexGeocodeHints } from '@features/clients/utils/destination-rate-state-resolve.util';
import {
  routeWaypointDraftsFromStored,
  routeWaypointsToTollQuery,
  type DestinationRateRouteWaypointDraft,
} from '@features/clients/utils/destination-rate-route-waypoints.util';
import { GeoApiService } from '@core/services/api/geo';
import { SessionService } from '@core/services/state/session';
import { PhotonPlaceSearchService } from '@shared/services/photon-place-search.service';
import { MexicoGeoStateService } from '@shared/services/mexico-geo-state.service';
import { normalizeDestinationRateScope } from '@shared/models/destination-rate-scope';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
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
  private readonly geoApi = inject(GeoApiService);
  private readonly photon = inject(PhotonPlaceSearchService);
  private readonly mexicoGeo = inject(MexicoGeoStateService);
  private readonly osrm = inject(OsrmDrivingRouteService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);

  private readonly originSelect = viewChild(OperationalCenterSelectComponent);
  private readonly pricesEditor = viewChild(DestinationRatePricesEditorComponent);

  readonly dismiss = output<void>();
  readonly saved = output<DestinationRate>();
  readonly openExisting = output<DestinationRate>();
  readonly drawerLoading = signal(true);
  readonly saving = signal(false);

  readonly originOperationalCenterId = model('');
  readonly postalCode = model('');
  readonly cityMunicipality = model('');
  readonly locality = model('');
  readonly municipalityName = model('');
  readonly stateName = model('');
  readonly priceDrafts = model<DestinationRatePriceDraft[]>([createEmptyPriceDraft()]);
  readonly rateScope = computed(() =>
    normalizeDestinationRateScope(this.session.destinationRateScope()),
  );
  readonly estimatedArrivalTimeValue = model('');
  readonly estimatedReturnTimeValue = model('');
  private readonly arrivalTimeTouched = signal(false);
  private readonly returnTimeTouched = signal(false);
  private readonly routeDistanceTouched = signal(false);

  /** CREATE_MODE | EXISTING_ROUTE | INVALIDATED */
  readonly routeMode = signal<DestinationRateRouteDrawerMode>('INVALIDATED');
  private readonly resolvedRouteKey = signal<DestinationRateRouteKey | null>(null);
  private lastRouteBaseKey = '';
  readonly routeCustomizeOpen = signal(false);
  readonly draftRouteWaypoints = signal<DestinationRateRouteWaypointDraft[]>([]);
  readonly appliedRouteWaypoints = signal<DestinationRateRouteWaypointDraft[]>([]);
  private readonly routeDistanceKm = signal<number | null>(null);
  readonly routeDistanceKmInput = signal('');
  private readonly routeLoading = signal(false);
  private readonly definedRouteMetricsLoading = signal(false);
  private readonly duplicateChecking = signal(false);
  private readonly routeMetricsPlazas = signal<readonly RouteTollPlazaRow[]>([]);
  private lastDefinedRouteMetricsKey = '';
  private definedRouteMetricsGeneration = 0;
  private readonly originCoords = signal<LatLon | null>(null);
  private readonly destinationCoords = signal<LatLon | null>(null);
  readonly existingDuplicateRate = signal<DestinationRate | null>(null);

  readonly currentRouteKey = computed(() =>
    buildDestinationRateRouteKey({
      scope: this.rateScope(),
      originOperationalCenterId: this.originOperationalCenterId(),
      postalCode: this.postalCode(),
      locality: this.locality(),
      municipalityName: this.municipalityName(),
      stateName: this.stateName(),
    }),
  );

  readonly routeGeocodePending = computed(
    () => this.routeLoading() || this.duplicateChecking(),
  );

  readonly routeMetricsPending = computed(
    () => this.routeGeocodePending() || this.definedRouteMetricsLoading(),
  );

  readonly routeDistanceDisplay = computed(() => {
    if (this.routeMetricsPending()) {
      return '';
    }
    const km = this.routeDistanceKm();
    if (km != null && km > 0) {
      return formatRouteKmEsMx(km);
    }
    if (this.routeInputComplete()) {
      return 'No disponible';
    }
    return '';
  });

  readonly operationalDistanceDisplay = computed(() => {
    if (this.routeMetricsPending()) {
      return '';
    }
    const km = this.routeDistanceKm();
    if (km != null && km > 0) {
      return formatRouteKmEsMx(operationalDistanceFromRouteKm(km));
    }
    if (this.routeInputComplete()) {
      return 'No disponible';
    }
    return '';
  });

  readonly operationalDistanceInputSuffix = computed(() => {
    if (this.routeMetricsPending()) {
      return '';
    }
    const km = this.routeDistanceKm();
    return km != null && km > 0 ? 'km' : '';
  });

  readonly routeDistanceInputDisabled = computed(
    () =>
      this.routeMetricsPending() || this.routeMode() !== 'CREATE_MODE',
  );

  readonly routeDistanceInputSuffix = computed(() => {
    if (this.routeMetricsPending()) {
      return '';
    }
    if (this.routeMode() === 'CREATE_MODE') {
      return 'km';
    }
    const km = this.routeDistanceKm();
    return km != null && km > 0 ? 'km' : '';
  });

  readonly routeDistanceInputDisplayValue = computed(() => {
    if (this.routeMetricsPending()) {
      return '';
    }
    if (this.routeMode() !== 'CREATE_MODE') {
      return this.routeDistanceDisplay();
    }
    return undefined;
  });

  readonly estimatedArrivalTimeInputDisplay = computed(() =>
    this.routeMetricsPending() ? '' : undefined,
  );

  readonly estimatedReturnTimeInputDisplay = computed(() =>
    this.routeMetricsPending() ? '' : undefined,
  );

  readonly driveTimeInputDisabled = computed(
    () => this.routeMetricsPending() || this.routeMode() === 'EXISTING_ROUTE',
  );

  readonly routeMapOriginLabel = computed(() => {
    const center =
      this.originSelect()?.selectedCenter() ??
      this.centersFeature.centerById(this.originOperationalCenterId());
    return (
      center?.locality?.trim() ||
      center?.name?.trim() ||
      'Origen'
    );
  });

  readonly routeMapDestinationLabel = computed(() => {
    const loc = this.locality().trim();
    const city = this.cityMunicipality().trim();
    if (loc && city) {
      return `${loc}, ${city}`;
    }
    return loc || city || 'Destino';
  });

  readonly routeTollContext = computed((): DestinationRateRouteTollContext | null => {
    if (this.routeMode() !== 'CREATE_MODE' || this.routeGeocodePending()) {
      return null;
    }
    return this.buildRouteTollContext();
  });

  private buildRouteTollContext(): DestinationRateRouteTollContext | null {
    const origin = this.resolvedOriginCoords();
    const dest = this.destinationCoords();
    if (!isValidLatLon(origin) || !isValidLatLon(dest)) {
      return null;
    }
    const center = this.centersFeature.centerById(this.originOperationalCenterId());
    const waypoints = routeWaypointsToTollQuery(this.appliedRouteWaypoints());
    return {
      originLat: origin.lat,
      originLon: origin.lon,
      destinationLat: dest.lat,
      destinationLon: dest.lon,
      originSearch: destinationRatePlaceSearchLabel(
        center?.locality || center?.name,
        center?.cityMunicipality,
      ),
      destinationSearch: destinationRatePlaceSearchLabel(
        this.locality(),
        this.cityMunicipality(),
      ),
      ...(waypoints.length > 0 ? { waypoints } : {}),
    };
  }

  private resolvedOriginCoords(): LatLon | null {
    void this.centersFeature.centers();
    const cached = this.originCoords();
    if (isValidLatLon(cached)) {
      return cached;
    }
    const center = this.centersFeature.centerById(this.originOperationalCenterId());
    return latLonFromPrefill(center?.latitude, center?.longitude);
  }

  private routeEndpointsReady(): boolean {
    const origin = this.resolvedOriginCoords();
    const dest = this.destinationCoords();
    return isValidLatLon(origin) && isValidLatLon(dest);
  }

  readonly routeInputComplete = computed(() =>
    isDestinationRateRouteInputComplete({
      scope: this.rateScope(),
      originOperationalCenterId: this.originOperationalCenterId(),
      postalCode: this.postalCode(),
      locality: this.locality(),
      cityMunicipality: this.cityMunicipality(),
      municipalityName: this.municipalityName(),
      stateName: this.stateName(),
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
    this.mexicoGeo.preload();
    afterNextRender(() => this.drawerLoading.set(false));
    this.bindRouteDuplicatePipeline();
    this.bindRouteDistancePipeline();
    effect(() => {
      const center =
        this.originSelect()?.selectedCenter() ??
        this.centersFeature.centerById(this.originOperationalCenterId());
      const origin = latLonFromPrefill(center?.latitude, center?.longitude);
      const dest = this.destinationCoords();
      const baseKey = isValidLatLon(origin) && isValidLatLon(dest)
        ? [
            origin.lat,
            origin.lon,
            dest.lat,
            dest.lon,
            this.originOperationalCenterId(),
            this.postalCode(),
            this.locality(),
          ].join('|')
        : '';
      if (baseKey && baseKey !== this.lastRouteBaseKey) {
        this.lastRouteBaseKey = baseKey;
        this.draftRouteWaypoints.set([]);
        this.appliedRouteWaypoints.set([]);
        this.routeCustomizeOpen.set(false);
        this.routeMetricsPlazas.set([]);
        this.lastDefinedRouteMetricsKey = '';
        this.routeDistanceTouched.set(false);
        this.arrivalTimeTouched.set(false);
        this.returnTimeTouched.set(false);
      }
      if (!baseKey) {
        this.lastRouteBaseKey = '';
      }
    });
    this.bindDefinedRouteMetrics();
  }

  onRouteMetricsPlazasChange(plazas: readonly RouteTollPlazaRow[]): void {
    this.routeMetricsPlazas.set(plazas);
  }

  onPostalRouteReset(): void {
    this.invalidateRouteResolution();
    this.draftRouteWaypoints.set([]);
    this.appliedRouteWaypoints.set([]);
    this.routeCustomizeOpen.set(false);
    this.routeMetricsPlazas.set([]);
    this.lastDefinedRouteMetricsKey = '';
    this.lastRouteBaseKey = '';
    this.routeDistanceTouched.set(false);
    this.arrivalTimeTouched.set(false);
    this.returnTimeTouched.set(false);
    this.pricesEditor()?.resetRouteDerivedState();
  }

  submit(): void {
    if (this.saving()) {
      return;
    }
    if (this.routeMode() === 'EXISTING_ROUTE' || this.existingDuplicateRate()) {
      this.toast.show('Ya existe una tarifa para esta ruta', 'warning');
      return;
    }
    if (!this.canSave()) {
      return;
    }

    const err = validateDestinationRateForm({
      scope: this.rateScope(),
      originOperationalCenterId: this.originOperationalCenterId(),
      postalCode: this.postalCode(),
      cityMunicipality: this.cityMunicipality(),
      locality: this.locality(),
      municipalityName: this.municipalityName(),
      stateName: this.stateName(),
      priceDrafts: this.priceDrafts(),
      estimatedArrivalTimeValue: this.estimatedArrivalTimeValue(),
      estimatedReturnTimeValue: this.estimatedReturnTimeValue(),
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
      municipalityName: this.municipalityName(),
      stateName: this.stateName(),
      priceDrafts: this.priceDrafts(),
      routeDistanceKm: this.routeDistanceKm(),
      destinationLatitude: coords?.lat ?? null,
      destinationLongitude: coords?.lon ?? null,
      active: true,
      estimatedArrivalTimeValue: this.estimatedArrivalTimeValue(),
      estimatedReturnTimeValue: this.estimatedReturnTimeValue(),
      routeWaypoints: this.appliedRouteWaypoints(),
      routeTollPlazas: this.pricesEditor()?.routeTollPlazasForPersist(),
    });

    if (!beginInFlight(this.saving)) {
      return;
    }
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

  onRouteDistanceKmTyped(raw: string): void {
    if (this.routeDistanceInputDisabled()) {
      return;
    }
    this.routeDistanceTouched.set(true);
    this.routeDistanceKmInput.set(raw);
    const parsed = parseRouteKmOneWayInput(raw);
    if (parsed == null) {
      return;
    }
    this.routeDistanceKm.set(parsed);
    if (parsed != null) {
      this.applySuggestedDriveTimesIfUntouched(parsed);
    }
  }

  onEstimatedArrivalTimeTyped(raw: string): void {
    this.arrivalTimeTouched.set(true);
    this.estimatedArrivalTimeValue.set(raw);
  }

  onEstimatedReturnTimeTyped(raw: string): void {
    this.returnTimeTouched.set(true);
    this.estimatedReturnTimeValue.set(raw);
  }

  onRouteDistanceKmBlur(): void {
    if (this.routeDistanceInputDisabled()) {
      return;
    }
    const parsed = parseRouteKmOneWayInput(this.routeDistanceKmInput());
    if (parsed != null) {
      this.routeDistanceKm.set(parsed);
      this.routeDistanceKmInput.set(formatRouteKmInputValue(parsed));
      this.applySuggestedDriveTimesIfUntouched(parsed);
      return;
    }
    this.routeDistanceKmInput.set(formatRouteKmInputValue(this.routeDistanceKm()));
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
      toObservable(this.municipalityName),
      toObservable(this.stateName),
      toObservable(this.rateScope),
    ])
      .pipe(
        debounceTime(300),
        map(([originId, cp, locality, municipalityName, stateName, scope]) =>
          buildDestinationRateRouteKey({
            scope: normalizeDestinationRateScope(scope),
            originOperationalCenterId: String(originId),
            postalCode: String(cp),
            locality: String(locality),
            municipalityName: String(municipalityName),
            stateName: String(stateName),
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
      toObservable(this.municipalityName),
      toObservable(this.stateName),
      toObservable(this.rateScope),
    ])
      .pipe(
        debounceTime(300),
        filter(
          ([
            mode,
            originId,
            cp,
            locality,
            cityMunicipality,
            municipalityName,
            stateName,
            scope,
          ]) =>
            mode === 'CREATE_MODE' &&
            isDestinationRateRouteInputComplete({
              scope,
              originOperationalCenterId: originId,
              postalCode: cp,
              locality,
              cityMunicipality,
              municipalityName,
              stateName,
            }),
        ),
        distinctUntilChanged((a, b) => a.every((v, i) => String(v) === String(b[i]))),
        switchMap(
          ([, originId, cp, locality, cityMunicipality, municipalityName, stateName, scope]) =>
            this.resolveRouteDistances({
              originId: String(originId).trim(),
              cp: String(cp),
              locality: String(locality).trim(),
              cityMunicipality: String(cityMunicipality).trim(),
              municipalityName: String(municipalityName).trim(),
              stateName: String(stateName).trim(),
              scope: normalizeDestinationRateScope(scope),
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
    this.routeDistanceTouched.set(false);
    this.arrivalTimeTouched.set(false);
    this.returnTimeTouched.set(false);
    this.lastDefinedRouteMetricsKey = '';
    this.routeMetricsPlazas.set([]);
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
      this.applyRouteDistanceKm(null);
      return;
    }
    this.applyRouteDistanceKm(rate.routeDistanceKm ?? null);
  }

  private resolveDestinationCoords(
    fromCp: LatLon | null,
    destQuery: string,
    hints: { state: string; municipality: string; settlement: string },
  ) {
    if (
      isValidLatLon(fromCp) &&
      this.mexicoGeo.coordsMatchStateHint(fromCp, hints.state)
    ) {
      return of(fromCp);
    }
    return this.mexicoGeo.whenReady().pipe(
      switchMap((geo) => {
        if (
          isValidLatLon(fromCp) &&
          this.mexicoGeo.coordsMatchStateHint(fromCp, hints.state, geo)
        ) {
          return of(fromCp);
        }
        return this.photon.firstCoordinatesForMexicanSepomex(destQuery, hints).pipe(
          map((fromPhoton) => {
            if (
              isValidLatLon(fromPhoton) &&
              this.mexicoGeo.coordsMatchStateHint(fromPhoton, hints.state, geo)
            ) {
              return fromPhoton;
            }
            if (
              isValidLatLon(fromCp) &&
              this.mexicoGeo.coordsMatchStateHint(fromCp, hints.state, geo)
            ) {
              return fromCp;
            }
            return fromPhoton ?? fromCp;
          }),
        );
      }),
    );
  }

  private resolveRouteDistances(input: {
    originId: string;
    cp: string;
    locality: string;
    cityMunicipality: string;
    municipalityName: string;
    stateName: string;
    scope: ReturnType<typeof normalizeDestinationRateScope>;
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
    this.originCoords.set(originCoords);

    this.routeLoading.set(true);
    const destCoords$ =
      input.scope === 'postal_code'
        ? this.resolvePostalCodeDestinationCoords(input)
        : this.resolveScopedDestinationCoords(input);

    return destCoords$.pipe(
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
        this.applyAutoRouteDistanceKm(routeKm);
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

  private resolvePostalCodeDestinationCoords(input: {
    cp: string;
    locality: string;
    cityMunicipality: string;
  }) {
    const hints = mexicanSepomexGeocodeHints(input.locality, input.cityMunicipality);
    const destQuery = [
      hints.settlement,
      hints.municipality,
      hints.state,
      input.cp.trim(),
      'México',
    ]
      .filter(Boolean)
      .join(', ');
    return this.geoApi
      .settlementCoordinates({
        postalCode: input.cp,
        settlement: hints.settlement,
        municipality: hints.municipality,
        state: hints.state,
      })
      .pipe(
        switchMap((fromCp) => this.resolveDestinationCoords(fromCp, destQuery, hints)),
      );
  }

  /** Ancla Photon para política municipio/estado (sin CP SEPOMex). */
  private resolveScopedDestinationCoords(input: {
    municipalityName: string;
    stateName: string;
    scope: ReturnType<typeof normalizeDestinationRateScope>;
  }) {
    const state = input.stateName.trim();
    const municipality =
      input.scope === 'municipality' ? input.municipalityName.trim() : '';
    const hints = { state, municipality, settlement: '' };
    const destQuery = [municipality, state, 'México'].filter(Boolean).join(', ');
    return this.photon
      .firstCoordinatesForMexicanSepomex(destQuery, hints)
      .pipe(
        switchMap((fromPhoton) =>
          this.resolveDestinationCoords(fromPhoton, destQuery, hints),
        ),
      );
  }

  private applyAutoRouteDistanceKm(km: number | null): void {
    if (this.routeDistanceTouched()) {
      return;
    }
    this.routeDistanceKm.set(km);
    this.routeDistanceKmInput.set(formatRouteKmInputValue(km));
    this.applySuggestedDriveTimesIfUntouched(km);
  }

  private applyRouteDistanceKm(km: number | null): void {
    this.routeDistanceKm.set(km);
    this.routeDistanceKmInput.set(formatRouteKmInputValue(km));
    this.applySuggestedDriveTimesIfUntouched(km);
  }

  /** Recalcula km/tiempos por OSRM al armar casetas (origen → casetas → destino). */
  private bindDefinedRouteMetrics(): void {
    effect((onCleanup) => {
      if (this.routeMode() !== 'CREATE_MODE') {
        this.lastDefinedRouteMetricsKey = '';
        return;
      }
      const plazas = this.routeMetricsPlazas();
      if (plazas.length === 0) {
        return;
      }
      const ctx = this.routeTollContext();
      if (!ctx) {
        return;
      }
      const key = definedRouteMetricsKey(ctx, plazas);
      if (!key || key === this.lastDefinedRouteMetricsKey) {
        return;
      }
      this.lastDefinedRouteMetricsKey = key;
      const generation = ++this.definedRouteMetricsGeneration;
      const points = definedRouteDrivingPoints({ ctx, plazas });
      if (points.length < 2) {
        return;
      }
      this.definedRouteMetricsLoading.set(true);
      const sub = this.osrm.drivingRouteThrough(points).subscribe({
        next: (route) => {
          if (generation !== this.definedRouteMetricsGeneration) {
            return;
          }
          this.definedRouteMetricsLoading.set(false);
          const km = route?.km ?? null;
          if (km != null && km > 0) {
            this.applyAutoRouteDistanceKm(km);
          }
        },
        error: () => {
          if (generation !== this.definedRouteMetricsGeneration) {
            return;
          }
          this.definedRouteMetricsLoading.set(false);
        },
      });
      onCleanup(() => {
        sub.unsubscribe();
        if (generation === this.definedRouteMetricsGeneration) {
          this.definedRouteMetricsLoading.set(false);
        }
      });
    });
  }

  private applySuggestedDriveTimesIfUntouched(routeKm: number | null): void {
    const label =
      routeKm != null && routeKm > 0
        ? formatEstimatedTimeValueNumber(
            suggestedDriveTimeHoursFromRouteKm(routeKm),
          )
        : '';
    if (!this.arrivalTimeTouched()) {
      this.estimatedArrivalTimeValue.set(label);
    }
    if (!this.returnTimeTouched()) {
      this.estimatedReturnTimeValue.set(label);
    }
  }

  private clearDistancesOnly(): void {
    this.applyRouteDistanceKm(null);
    this.applySuggestedDriveTimesIfUntouched(null);
    this.routeLoading.set(false);
    this.originCoords.set(null);
    this.destinationCoords.set(null);
  }
}
