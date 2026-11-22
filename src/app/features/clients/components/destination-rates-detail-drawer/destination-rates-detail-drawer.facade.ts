import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { RouteTollPlazaRow } from '@core/services/api/routing';
import { enrichTollPlazaRowsForMap } from '@features/clients/utils/destination-rate-route-toll-plazas.util';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
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
import { destinationRateSakbeSearchLabel } from '@features/clients/utils/destination-rate-sakbe-search.util';
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
import { parseMexicanCityMunicipalityLine } from '@features/clients/utils/destination-rate-state-resolve.util';
import { operationalDistanceFromRouteKm } from '@features/clients/utils/destination-rate-route-resolution';
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
import { OsrmDrivingRouteService } from '@shared/services/osrm-driving-route.service';

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
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  private readonly sepomex = inject(MexicoPostalCodeService);
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
  readonly originOperationalCenterId = signal('');
  readonly priceDrafts = signal<DestinationRatePriceDraft[]>([]);
  readonly excludedTollPlazaKeys = signal<string[]>([]);
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
  private readonly routeMetricsPlazas = signal<readonly RouteTollPlazaRow[]>([]);
  private lastDefinedRouteMetricsKey = '';
  private definedRouteMetricsGeneration = 0;

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

  readonly viewPriceDrafts = computed(() =>
    destinationRatePriceDraftsForSave(priceDraftsFromRate(this.rate())),
  );

  readonly lastUpdatedLabel = computed(() => {
    const r = this.rate();
    return formatDestinationRateUpdatedAt(r.updatedAt ?? r.createdAt);
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
      norm(this.originOperationalCenterId()) !== norm(r.originOperationalCenterId)
    );
  });

  readonly editRouteTollPlazas = computed(() => {
    if (this.editRouteLocationStale()) {
      return [];
    }
    return enrichTollPlazaRowsForMap(this.rate().routeTollPlazas ?? []);
  });

  readonly editRouteMetricsPending = computed(() => this.definedRouteMetricsLoading());

  readonly editShowRouteMetrics = computed(
    () => this.routeTollContext() != null || this.routeDistanceKm() != null,
  );

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

  readonly editShowRouteCustomize = computed(() => this.routeTollContext() != null);

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
    if (this.editing() && this.editRouteLocationStale()) {
      return null;
    }
    const r = this.rate();
    const oLat = r.originLatitude;
    const oLon = r.originLongitude;
    const dLat = r.destinationLatitude;
    const dLon = r.destinationLongitude;
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
    return {
      originLat: oLat,
      originLon: oLon,
      destinationLat: dLat,
      destinationLon: dLon,
      originSearch: destinationRateSakbeSearchLabel(
        r.originLocality,
        r.originCityMunicipality,
      ),
      destinationSearch: destinationRateSakbeSearchLabel(
        r.locality,
        r.cityMunicipality,
      ),
      ...(waypoints.length > 0 ? { waypoints } : {}),
    };
  });

  onPostalRouteReset(
    editor: DestinationRatePricesEditorComponent | undefined,
  ): void {
    this.excludedTollPlazaKeys.set([]);
    this.draftRouteWaypoints.set([]);
    this.appliedRouteWaypoints.set([]);
    this.routeCustomizeOpen.set(false);
    this.routeMetricsPlazas.set([]);
    this.lastDefinedRouteMetricsKey = '';
    this.definedRouteMetricsGeneration += 1;
    if (!this.routeDistanceTouched()) {
      this.routeDistanceKm.set(null);
      this.routeDistanceKmInput.set('');
      this.applySuggestedDriveTimesIfUntouched(null);
    }
    this.priceDrafts.update((rows) =>
      rows.map((row) => ({ ...row, estimatedTollAmount: '' })),
    );
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

  updateExcludedTollPlazaKeys(keys: string[]): void {
    this.excludedTollPlazaKeys.set(keys);
  }

  onRouteWaypointsRecalculate(): void {
    this.excludedTollPlazaKeys.set([]);
  }

  onRouteWaypointsReset(): void {
    this.excludedTollPlazaKeys.set([]);
  }

  updateDraftRouteWaypoints(rows: DestinationRateRouteWaypointDraft[]): void {
    this.draftRouteWaypoints.set(rows);
  }

  updateAppliedRouteWaypoints(rows: DestinationRateRouteWaypointDraft[]): void {
    this.appliedRouteWaypoints.set(rows);
  }

  updateRouteCustomizeOpen(open: boolean): void {
    this.routeCustomizeOpen.set(open);
  }

  persist(routeTollPlazas?: readonly RouteTollPlazaRow[]): void {
    if (this.saving()) {
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
      excludedTollPlazaKeys: this.excludedTollPlazaKeys(),
      routeWaypoints: this.appliedRouteWaypoints(),
      routeTollPlazas,
      routeDistanceKm: this.routeDistanceKm(),
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
    this.originOperationalCenterId.set(r.originOperationalCenterId);
    this.referencePostalCode.set(r.postalCode);
    this.priceDrafts.set(priceDraftsForEditorFromRate(r));
    this.active.set(r.active ? 'yes' : 'no');
    this.notes.set(r.notes ?? '');
    const estimated = estimatedTimesFormStringsFromRate(r);
    this.estimatedArrivalTimeValue.set(estimated.arrival);
    this.estimatedReturnTimeValue.set(estimated.returnValue);
    this.excludedTollPlazaKeys.set(r.excludedTollPlazaKeys ?? []);
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
  }

  private applyAutoRouteDistanceKm(km: number | null): void {
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

  private bindDefinedRouteMetrics(): void {
    effect((onCleanup) => {
      if (!this.editing()) {
        this.lastDefinedRouteMetricsKey = '';
        return;
      }
      void this.appliedRouteWaypoints();
      const ctx = this.routeTollContext();
      if (!ctx) {
        return;
      }
      const key = definedRouteMetricsKey(
        ctx,
        this.routeMetricsPlazas(),
        this.excludedTollPlazaKeys(),
      );
      if (!key || key === this.lastDefinedRouteMetricsKey) {
        return;
      }
      this.lastDefinedRouteMetricsKey = key;
      const generation = ++this.definedRouteMetricsGeneration;
      const points = definedRouteDrivingPoints({
        ctx,
        plazas: this.routeMetricsPlazas(),
      });
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
