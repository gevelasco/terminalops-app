import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
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
import type { RouteTollPlazaRow } from '@core/services/api/routing';
import { GeoApiService } from '@core/services/api/geo';
import { enrichTollPlazaRowsForMap } from '@features/clients/utils/destination-rate-route-toll-plazas.util';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { OperationalCentersFeatureService } from '@features/clients/services/operational-centers.service';
import {
  buildCreateDestinationRatePayload,
  destinationRatePriceDraftsForSave,
  priceDraftsForEditorFromRate,
  priceDraftsFromRate,
  validateDestinationRateForm,
} from '@features/clients/utils/destination-rate-payload';
import {
  CLIENT_YES_NO_OPTIONS,
  DESTINATION_RATE_AVAILABILITY_OPTIONS,
} from '@shared/catalogs/client-form-options';
import {
  DestinationRatePricesEditorComponent,
  type DestinationRateRouteTollContext,
} from '@features/clients/components/destination-rate-prices-editor/destination-rate-prices-editor.component';
import { destinationRatePlaceSearchLabel } from '@features/clients/utils/destination-rate-place-search.util';
import {
  routeWaypointDraftsFromStored,
  routeWaypointsToTollQuery,
} from '@features/clients/utils/destination-rate-route-waypoints.util';
import type { DestinationRateRouteWaypointDraft } from '@features/clients/utils/destination-rate-route-waypoints.util';
import {
  estimatedTimesFormStringsFromRate,
  formatDestinationRateEstimatedTimeDisplay,
} from '@features/clients/utils/destination-rate-estimated-time';
import { formatDestinationRateUpdatedAt } from '@features/clients/utils/format-destination-rate-updated-at';
import type {
  DestinationRate,
  DestinationRatePriceDraft,
} from '@shared/models/destination-rate.models';
import { isAdminRole } from '@shared/utils/access-control';
import { parseHttpApiErrorMessage } from '@shared/utils/http-api-error';
import { ToSelectOption } from '@shared/ui/to-select/to-select.component';
import { MexicoPostalCodeService } from '@shared/services/mexico-postal-code.service';
import { municipalityFromSepomexSettlements } from '@features/trips/utils/mx-postal-settlement';
import { municipalityLabelForTable } from '@features/clients/utils/destination-rates-table-rows';
import { cityMunicipalityNeedsEnrichment } from '@features/clients/utils/destination-rates-map-activity';
import {
  mexicanSepomexGeocodeHints,
  parseMexicanCityMunicipalityLine,
  resolveDestinationRatePlaceFields,
} from '@features/clients/utils/destination-rate-state-resolve.util';
import {
  isDestinationRateRouteInputComplete,
  operationalDistanceFromRouteKm,
} from '@features/clients/utils/destination-rate-route-resolution';
import {
  formatRouteKmEsMx,
  formatRouteKmInputValue,
  parseRouteKmOneWayInput,
} from '@features/trips/utils/maniobra-route-display';
import {
  definedRouteDrivingPoints,
  definedRouteMetricsKey,
} from '@features/clients/utils/destination-rate-defined-route-metrics.util';
import {
  suggestedDriveTimeHoursFromRouteKm,
} from '@features/clients/utils/destination-rate-drive-time.util';
import { formatEstimatedTimeValueNumber } from '@features/clients/utils/destination-rate-estimated-time';
import {
  OsrmDrivingRouteService,
  type LatLon,
} from '@shared/services/osrm-driving-route.service';
import { isValidLatLon, latLonFromPrefill } from '@shared/services/lat-lon';
import { PhotonPlaceSearchService } from '@shared/services/photon-place-search.service';
import { MexicoGeoStateService } from '@shared/services/mexico-geo-state.service';
import { normalizeDestinationRateScope } from '@shared/models/destination-rate-scope';

const EMPTY_RATE: DestinationRate = {
  id: '',
  companyId: '',
  originOperationalCenterId: '',
  originPostalCode: '',
  originCityMunicipality: '',
  originLocality: '',
  postalCode: '',
  cityMunicipality: '',
  locality: '',
  isRoundTrip: true,
  prices: [],
  active: true,
};

@Injectable()
export class DestinationRatesDetailDrawerFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ratesFeature = inject(DestinationRatesFeatureService);
  private readonly operationConfigs = inject(OperationConfigurationsFeatureService);
  private readonly centersFeature = inject(OperationalCentersFeatureService);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  private readonly sepomex = inject(MexicoPostalCodeService);
  private readonly geoApi = inject(GeoApiService);
  private readonly photon = inject(PhotonPlaceSearchService);
  private readonly mexicoGeo = inject(MexicoGeoStateService);
  private readonly osrm = inject(OsrmDrivingRouteService);

  private dismissCallback: (() => void) | null = null;

  readonly rate = computed(
    () => this.ratesFeature.selectedRate() ?? EMPTY_RATE,
  );
  readonly drawerLoading = computed(
    () =>
      this.ratesFeature.detailLoading() ||
      this.ratesFeature.selectedRate() == null,
  );
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly deleteConfirmOpen = signal(false);
  readonly deleteSubmitting = signal(false);
  readonly canWriteDestinationRates = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.DESTINATION_RATES),
  );
  readonly canDeleteDestinationRate = computed(() =>
    isAdminRole(this.session.role()),
  );
  readonly linkedManeuverCount = computed(
    () => this.rate().maneuverCount ?? 0,
  );
  readonly canConfirmDeleteDestinationRate = computed(
    () => this.linkedManeuverCount() === 0,
  );

  readonly yesNoOptions: ToSelectOption[] = CLIENT_YES_NO_OPTIONS;
  readonly availabilityOptions: ToSelectOption[] = DESTINATION_RATE_AVAILABILITY_OPTIONS;

  readonly postalCode = signal('');
  readonly cityMunicipality = signal('');
  readonly locality = signal('');
  readonly municipalityName = signal('');
  readonly stateName = signal('');
  readonly originOperationalCenterId = signal('');
  readonly rateScope = computed(() =>
    normalizeDestinationRateScope(
      this.rate().destinationScope ?? this.session.destinationRateScope(),
    ),
  );
  readonly priceDrafts = signal<DestinationRatePriceDraft[]>([]);
  readonly routeCustomizeOpen = signal(false);
  readonly draftRouteWaypoints = signal<DestinationRateRouteWaypointDraft[]>([]);
  readonly appliedRouteWaypoints = signal<DestinationRateRouteWaypointDraft[]>([]);
  readonly active = signal('yes');
  readonly notes = signal('');
  readonly estimatedArrivalTimeValue = signal('');
  readonly estimatedReturnTimeValue = signal('');
  readonly routeDistanceKm = signal<number | null>(null);
  readonly routeDistanceKmInput = signal('');
  private readonly routeDistanceTouched = signal(false);
  private readonly arrivalTimeTouched = signal(false);
  private readonly returnTimeTouched = signal(false);
  private readonly definedRouteMetricsLoading = signal(false);
  private readonly routeResolving = signal(false);
  private readonly originCoords = signal<LatLon | null>(null);
  private readonly destinationCoords = signal<LatLon | null>(null);
  private readonly routeMetricsPlazas = signal<readonly RouteTollPlazaRow[]>([]);
  private lastDefinedRouteMetricsKey = '';
  private definedRouteMetricsGeneration = 0;

  readonly referencePostalCode = signal('');

  readonly headerLabel = computed(() => {
    const r = this.rate();
    const scope = this.rateScope();
    if (scope === 'state') {
      return r.stateName?.trim() || r.cityMunicipality.trim() || 'Tarifa por estado';
    }
    if (scope === 'municipality') {
      const muni = r.municipalityName?.trim() || '';
      const state = r.stateName?.trim() || '';
      if (muni && state) {
        return `${muni}, ${state}`;
      }
      return muni || state || r.cityMunicipality.trim() || 'Tarifa por municipio';
    }
    const loc = r.locality.trim();
    const cp = r.postalCode.trim();
    if (loc && cp) {
      return `${loc} · CP ${cp}`;
    }
    return cp || loc || 'Tarifa por destino';
  });

  readonly viewPriceDrafts = computed(() =>
    destinationRatePriceDraftsForSave(priceDraftsFromRate(this.rate())),
  );

  readonly lastUpdatedLabel = computed(() => {
    const r = this.rate();
    return formatDestinationRateUpdatedAt(r.updatedAt ?? r.createdAt);
  });

  /** Distancia ida+vuelta (ruta × 2) para la ficha de lectura. */
  readonly viewOperationalDistanceLabel = computed(() => {
    const km = this.rate().routeDistanceKm;
    if (km == null || km <= 0) {
      return '—';
    }
    return `${formatRouteKmEsMx(operationalDistanceFromRouteKm(km))} km`;
  });

  readonly viewEstimatedArrivalTimeLabel = computed(() =>
    formatDestinationRateEstimatedTimeDisplay(
      this.rate().estimatedArrivalTimeValue,
    ),
  );

  readonly viewEstimatedReturnTimeLabel = computed(() =>
    formatDestinationRateEstimatedTimeDisplay(
      this.rate().estimatedReturnTimeValue,
    ),
  );

  private readonly displayMunicipalityByCp = signal<ReadonlyMap<string, string>>(
    new Map(),
  );
  private readonly displayStateFromSepomex = signal('');

  /** Municipio para vista (SEPOMex si el guardado es solo estado o está incompleto). */
  readonly viewCityMunicipalityLabel = computed(() => {
    const r = this.rate();
    const parsed = parseMexicanCityMunicipalityLine(r.cityMunicipality);
    const state = parsed.state || this.displayStateFromSepomex();
    return municipalityLabelForTable(r, state, this.displayMunicipalityByCp());
  });

  readonly viewDestinationStateLabel = computed(() => {
    const fromSepomex = this.displayStateFromSepomex().trim();
    if (fromSepomex) {
      return fromSepomex;
    }
    const parsed = parseMexicanCityMunicipalityLine(this.rate().cityMunicipality);
    if (parsed.state.trim()) {
      return parsed.state.trim();
    }
    const raw = this.rate().cityMunicipality.trim();
    if (raw && cityMunicipalityNeedsEnrichment(raw, raw)) {
      return raw;
    }
    return '—';
  });

  readonly routeMapOriginLabel = computed(() => {
    const r = this.rate();
    return (
      r.originLocality.trim() ||
      r.originOperationalCenterName?.trim() ||
      'Origen'
    );
  });

  readonly viewRouteTollPlazas = computed(() =>
    enrichTollPlazaRowsForMap(this.rate().routeTollPlazas ?? []),
  );

  readonly editRouteLocationStale = computed(() => {
    if (!this.editing()) {
      return false;
    }
    const r = this.rate();
    const norm = (value: string) => value.trim();
    return (
      norm(this.postalCode()) !== norm(r.postalCode) ||
      norm(this.locality()) !== norm(r.locality) ||
      norm(this.cityMunicipality()) !== norm(r.cityMunicipality) ||
      norm(this.municipalityName()) !== norm(r.municipalityName ?? '') ||
      norm(this.stateName()) !== norm(r.stateName ?? '') ||
      norm(this.originOperationalCenterId()) !== norm(r.originOperationalCenterId)
    );
  });

  readonly editRouteTollPlazas = computed(() => {
    if (this.editRouteLocationStale()) {
      return [];
    }
    return enrichTollPlazaRowsForMap(this.rate().routeTollPlazas ?? []);
  });

  readonly editRouteMetricsPending = computed(
    () => this.definedRouteMetricsLoading() || this.routeResolving(),
  );

  readonly editShowRouteMetrics = computed(() => {
    if (
      this.routeTollContext() != null ||
      this.routeDistanceKm() != null ||
      this.routeResolving()
    ) {
      return true;
    }
    // Tras cambiar municipio/estado la ruta se invalida; mantén km editables
    // (no dejar solo tiempos) mientras se completa el destino.
    return this.editing() && this.rateScope() !== 'postal_code';
  });

  readonly editRouteDistanceDisplay = computed(() => {
    const km = this.routeDistanceKm();
    if (km == null || km <= 0) {
      return '';
    }
    return formatRouteKmEsMx(km);
  });

  readonly editOperationalDistanceDisplay = computed(() => {
    const km = this.routeDistanceKm();
    if (km == null || km <= 0) {
      return '';
    }
    return formatRouteKmEsMx(operationalDistanceFromRouteKm(km));
  });

  readonly routeMapDestinationLabel = computed(() => {
    const r = this.rate();
    const loc = r.locality.trim();
    const city = r.cityMunicipality.trim();
    if (loc && city) {
      return `${loc}, ${city}`;
    }
    return loc || city || 'Destino';
  });

  readonly routeTollContext = computed((): DestinationRateRouteTollContext | null => {
    const r = this.rate();
    const stale = this.editing() && this.editRouteLocationStale();
    let oLat: number | null | undefined;
    let oLon: number | null | undefined;
    let dLat: number | null | undefined;
    let dLon: number | null | undefined;

    if (stale) {
      const origin = this.originCoords();
      const dest = this.destinationCoords();
      if (!isValidLatLon(origin) || !isValidLatLon(dest)) {
        return null;
      }
      oLat = origin.lat;
      oLon = origin.lon;
      dLat = dest.lat;
      dLon = dest.lon;
    } else {
      oLat = r.originLatitude;
      oLon = r.originLongitude;
      dLat = r.destinationLatitude;
      dLon = r.destinationLongitude;
    }

    if (
      oLat == null ||
      oLon == null ||
      dLat == null ||
      dLon == null ||
      !Number.isFinite(oLat) ||
      !Number.isFinite(oLon) ||
      !Number.isFinite(dLat) ||
      !Number.isFinite(dLon)
    ) {
      return null;
    }
    const waypoints = this.editing()
      ? routeWaypointsToTollQuery(this.appliedRouteWaypoints())
      : routeWaypointsToTollQuery(r.routeWaypoints ?? []);
    const destinationSearch = stale
      ? destinationRatePlaceSearchLabel(
          this.locality(),
          this.cityMunicipality().trim() ||
            [this.municipalityName(), this.stateName()].filter(Boolean).join(', '),
        )
      : destinationRatePlaceSearchLabel(r.locality, r.cityMunicipality);
    return {
      originLat: oLat,
      originLon: oLon,
      destinationLat: dLat,
      destinationLon: dLon,
      originSearch: destinationRatePlaceSearchLabel(
        r.originLocality,
        r.originCityMunicipality,
      ),
      destinationSearch,
      ...(waypoints.length > 0 ? { waypoints } : {}),
    };
  });

  onPostalRouteReset(
    editor: DestinationRatePricesEditorComponent | undefined,
  ): void {
    this.draftRouteWaypoints.set([]);
    this.appliedRouteWaypoints.set([]);
    this.routeCustomizeOpen.set(false);
    this.routeMetricsPlazas.set([]);
    this.lastDefinedRouteMetricsKey = '';
    this.definedRouteMetricsGeneration += 1;
    this.originCoords.set(null);
    this.destinationCoords.set(null);
    this.routeResolving.set(false);
    if (!this.routeDistanceTouched()) {
      this.routeDistanceKm.set(null);
      this.routeDistanceKmInput.set('');
      this.applySuggestedDriveTimesIfUntouched(null);
    }
    editor?.resetRouteDerivedState();
  }

  bindDismiss(cb: () => void): void {
    this.dismissCallback = cb;
  }

  markReady(): void {
    this.syncFromRate();
  }

  constructor() {
    effect(() => {
      const detail = this.ratesFeature.selectedRate();
      if (!detail) {
        return;
      }
      if (this.editing()) {
        return;
      }
      this.syncFromRate();
    });

    effect((onCleanup) => {
      const r = this.rate();
      const cp = r.postalCode.trim();
      if (cp.length !== 5) {
        this.displayMunicipalityByCp.set(new Map());
        this.displayStateFromSepomex.set('');
        return;
      }
      const parsed = parseMexicanCityMunicipalityLine(r.cityMunicipality);
      const needsMunicipality = cityMunicipalityNeedsEnrichment(
        r.cityMunicipality,
        parsed.state,
      );
      const sub = this.sepomex.lookupByPostalCode(cp).subscribe((rows) => {
        this.displayStateFromSepomex.set(rows[0]?.state?.trim() ?? '');
        if (!needsMunicipality) {
          return;
        }
        const muni = municipalityFromSepomexSettlements(rows, r.locality);
        if (muni) {
          this.displayMunicipalityByCp.set(new Map([[cp, muni]]));
        } else {
          this.displayMunicipalityByCp.set(new Map());
        }
      });
      onCleanup(() => sub.unsubscribe());
    });
    this.bindEditRouteDistancePipeline();
    this.bindDefinedRouteMetrics();
  }

  updateRouteMetricsPlazas(plazas: readonly RouteTollPlazaRow[]): void {
    this.routeMetricsPlazas.set(plazas);
  }

  onRouteDistanceKmTyped(raw: string): void {
    this.routeDistanceTouched.set(true);
    this.routeDistanceKmInput.set(raw);
    const parsed = parseRouteKmOneWayInput(raw);
    if (parsed == null) {
      return;
    }
    this.routeDistanceKm.set(parsed);
    this.applySuggestedDriveTimesIfUntouched(parsed);
  }

  onRouteDistanceKmBlur(): void {
    const parsed = parseRouteKmOneWayInput(this.routeDistanceKmInput());
    if (parsed != null) {
      this.routeDistanceKm.set(parsed);
      this.routeDistanceKmInput.set(formatRouteKmInputValue(parsed));
      this.applySuggestedDriveTimesIfUntouched(parsed);
      return;
    }
    this.routeDistanceKmInput.set(formatRouteKmInputValue(this.routeDistanceKm()));
  }

  onEstimatedArrivalTimeTyped(raw: string): void {
    this.arrivalTimeTouched.set(true);
    this.estimatedArrivalTimeValue.set(raw);
  }

  onEstimatedReturnTimeTyped(raw: string): void {
    this.returnTimeTouched.set(true);
    this.estimatedReturnTimeValue.set(raw);
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
    if (!this.canWriteDestinationRates()) {
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

  persist(routeTollPlazas?: readonly RouteTollPlazaRow[]): void {
    if (this.saving()) {
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

    const payload = buildCreateDestinationRatePayload({
      originOperationalCenterId: this.originOperationalCenterId(),
      postalCode: this.postalCode(),
      cityMunicipality: this.cityMunicipality(),
      locality: this.locality(),
      municipalityName: this.municipalityName(),
      stateName: this.stateName(),
      priceDrafts: this.priceDrafts(),
      active: this.active() === 'yes',
      notes: this.notes(),
      estimatedArrivalTimeValue: this.estimatedArrivalTimeValue(),
      estimatedReturnTimeValue: this.estimatedReturnTimeValue(),
      routeWaypoints: this.appliedRouteWaypoints(),
      routeTollPlazas,
      routeDistanceKm: this.routeDistanceKm(),
      destinationLatitude: this.destinationCoords()?.lat ?? null,
      destinationLongitude: this.destinationCoords()?.lon ?? null,
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

  openDeleteConfirm(): void {
    if (
      !this.canDeleteDestinationRate() ||
      this.deleteSubmitting() ||
      this.saving() ||
      this.editing()
    ) {
      return;
    }
    this.deleteConfirmOpen.set(true);
  }

  closeDeleteConfirm(): void {
    if (this.deleteSubmitting()) {
      return;
    }
    this.deleteConfirmOpen.set(false);
  }

  confirmDeleteDestinationRate(): void {
    if (
      !this.canDeleteDestinationRate() ||
      !this.canConfirmDeleteDestinationRate() ||
      this.deleteSubmitting() ||
      this.saving()
    ) {
      return;
    }
    const id = this.rate().id;
    this.deleteSubmitting.set(true);
    this.ratesFeature
      .deleteDestinationRate(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleteSubmitting.set(false);
          this.deleteConfirmOpen.set(false);
          this.toast.show('Tarifa eliminada.', 'success');
          this.requestDismiss();
        },
        error: (err: unknown) => {
          this.deleteSubmitting.set(false);
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
    const place = resolveDestinationRatePlaceFields(r);
    this.municipalityName.set(place.municipality);
    this.stateName.set(place.state);
    this.originOperationalCenterId.set(r.originOperationalCenterId);
    this.referencePostalCode.set(r.postalCode);
    this.priceDrafts.set(priceDraftsForEditorFromRate(r));
    this.active.set(r.active ? 'yes' : 'no');
    this.notes.set(r.notes ?? '');
    const estimated = estimatedTimesFormStringsFromRate(r);
    this.estimatedArrivalTimeValue.set(estimated.arrival);
    this.estimatedReturnTimeValue.set(estimated.returnValue);
    const stored = routeWaypointDraftsFromStored(r.routeWaypoints ?? []);
    this.draftRouteWaypoints.set(stored);
    this.appliedRouteWaypoints.set(stored);
    this.routeCustomizeOpen.set(false);
    const km = r.routeDistanceKm ?? null;
    this.routeDistanceKm.set(km);
    this.routeDistanceKmInput.set(formatRouteKmInputValue(km));
    this.routeDistanceTouched.set(false);
    this.arrivalTimeTouched.set(false);
    this.returnTimeTouched.set(false);
    this.routeMetricsPlazas.set([]);
    this.lastDefinedRouteMetricsKey = '';
    this.originCoords.set(null);
    this.destinationCoords.set(null);
    this.routeResolving.set(false);
  }

  applyAutoRouteDistanceKm(km: number | null): void {
    if (this.routeDistanceTouched()) {
      return;
    }
    this.routeDistanceKm.set(km);
    this.routeDistanceKmInput.set(formatRouteKmInputValue(km));
    this.applySuggestedDriveTimesIfUntouched(km);
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

  /** Geocode + OSRM cuando el destino/origen cambian en edición. */
  private bindEditRouteDistancePipeline(): void {
    combineLatest([
      toObservable(this.editing),
      toObservable(this.editRouteLocationStale),
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
            editing,
            stale,
            originId,
            cp,
            locality,
            cityMunicipality,
            municipalityName,
            stateName,
            scope,
          ]) =>
            editing &&
            stale &&
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
          ([
            ,
            ,
            originId,
            cp,
            locality,
            cityMunicipality,
            municipalityName,
            stateName,
            scope,
          ]) =>
            this.resolveEditRouteDistances({
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

  private resolveEditOriginCoords(originId: string): LatLon | null {
    const center = this.centersFeature.centerById(originId);
    const fromCenter = latLonFromPrefill(center?.latitude, center?.longitude);
    if (isValidLatLon(fromCenter)) {
      return fromCenter;
    }
    const r = this.rate();
    if (r.originOperationalCenterId === originId) {
      return latLonFromPrefill(r.originLatitude, r.originLongitude);
    }
    return null;
  }

  private resolveEditRouteDistances(input: {
    originId: string;
    cp: string;
    locality: string;
    cityMunicipality: string;
    municipalityName: string;
    stateName: string;
    scope: ReturnType<typeof normalizeDestinationRateScope>;
  }) {
    if (!this.editing() || !this.editRouteLocationStale()) {
      return of(undefined);
    }

    const originCoords = this.resolveEditOriginCoords(input.originId);
    if (!isValidLatLon(originCoords)) {
      this.originCoords.set(null);
      this.destinationCoords.set(null);
      if (!this.routeDistanceTouched()) {
        this.applyAutoRouteDistanceKm(null);
      }
      return of(undefined);
    }
    this.originCoords.set(originCoords);
    this.routeResolving.set(true);

    const destCoords$ =
      input.scope === 'postal_code'
        ? this.resolvePostalCodeDestinationCoords(input)
        : this.resolveScopedDestinationCoords(input);

    return destCoords$.pipe(
      switchMap((destCoords) => {
        if (!this.editing() || !this.editRouteLocationStale()) {
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
        if (!this.editing() || !this.editRouteLocationStale()) {
          return;
        }
        this.applyAutoRouteDistanceKm(routeKm);
      }),
      catchError(() => {
        if (this.editing() && this.editRouteLocationStale()) {
          this.destinationCoords.set(null);
          if (!this.routeDistanceTouched()) {
            this.applyAutoRouteDistanceKm(null);
          }
        }
        return of(null);
      }),
      finalize(() => {
        if (this.editing()) {
          this.routeResolving.set(false);
        }
      }),
      map(() => undefined),
    );
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

  /** Recalcula km/tiempos al cambiar casetas manuales en edición. */
  private bindDefinedRouteMetrics(): void {
    effect((onCleanup) => {
      if (!this.editing()) {
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
}
