import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  formatManeuverEquipmentLabel,
  resolveUnitHitchedEquipment,
  unitHitchedEquipment,
  unitMatchesManeuverOperationCode,
} from '@features/trips/utils/assignable-fleet-for-maneuver';
import {
  fleetComplianceIconsForEquipment,
  fleetComplianceIconsForUnit,
} from '@features/fleet/utils/fleet-compliance-icons.util';
import {
  gpsExpensesForUnit,
  insuranceExpensesForEquipment,
  insuranceExpensesForUnit,
} from '@features/fleet/utils/fleet-coverage-expenses.util';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import type { CreateTripPayload } from '@shared/models/api/api-trips.model';
import type { TripClientPaymentMethod } from '@shared/models/logistics.models';
import { trackFileEntry } from '@features/fleet/utils/list-trackers';
import { dateTimeLocalValueToIso } from '@features/trips/utils/datetime-local';
import {
  isPlannedScheduleValid,
  plannedScheduleArrivalOrderIssue,
  plannedScheduleCompletionDepartureOrderIssue,
  plannedScheduleCompletionOrderIssue,
  plannedScheduleIsoTriplet,
  plannedScheduleOrderToastMessage,
} from '@features/trips/utils/planned-schedule-validation';
import {
  cityMunicipalityLineFromSettlement,
  formatLocationLabelFromSettlement,
  formatSettlementOptionLabel,
  geocodeQueryFromSettlement,
  localityKey,
  normalizeMxPostalCodeDigits,
} from '@features/trips/utils/mx-postal-settlement';
import {
  formatRouteKmEsMx,
  maneuverKindFromRouteKm,
} from '@features/trips/utils/maniobra-route-display';
import { operatorLicenseExpiresLabelFromIso } from '@features/trips/utils/operator-license-display';
import { TripsFormCatalogService } from '@features/trips/services/trips-form-catalog.service';
import {
  parseNonNegativeNumber,
  stripGroupedNumberInput,
} from '@features/trips/utils/parse-non-negative';
import {
  buildRouteEndpointPrefillResult,
  destinationPrefillFromClient,
  originPrefillFromOperationalCenter,
  routeEndpointFingerprint,
  type TripRouteEndpointPrefill,
} from '@features/trips/utils/trips-new-drawer-route-prefill';
import type { Client } from '@shared/models/client.models';
import type { DestinationRate } from '@shared/models/destination-rate.models';
import {
  Equipment,
  Operator,
  Trip,
  TripContainerType,
  TripLoadType,
  Unit,
} from '@shared/models/logistics.models';
import { isFleetResourceActive } from '@shared/utils/fleet-resource-active';
import { TripsService as TripsApiService } from '@core/services/api/trips';
import { TripsFeatureService } from '@features/trips/services/trips.service';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { OperationalCentersFeatureService } from '@features/clients/services/operational-centers.service';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { isOperationalCenterNewRoute } from '@features/clients/constants/operational-center-new-route';
import { OperationalCenterSelectComponent } from '@features/clients/components/operational-center-select/operational-center-select.component';
import { TripEvaluationService } from '@shared/services/trip-evaluation.service';
import {
  destinationRateHasClientChargeForOperation,
  destinationRateHasEstimatedTime,
  destinationRateHasRouteCache,
  resolveManeuverDestinationRate,
  suggestedClientChargeFromDestinationRate,
  suggestedEstimatedTollFromDestinationRate,
  suggestedOperatorPaymentFromDestinationRate,
} from '@features/clients/utils/find-destination-rate-by-postal-code';
import { computePlannedScheduleSuggestionFromRate } from '@features/trips/utils/planned-schedule-from-destination-rate';
import type { FuelEstimateResponse } from '@shared/models/api/api-trips-fuel.model';
import {
  buildFuelEstimateRequest,
  formatFuelEstimateLiters,
  formatFuelEstimateMoney,
  fuelEstimateInputsFingerprint,
} from '@features/trips/utils/trips-fuel-estimate';
import { isValidLatLon } from '@shared/services/lat-lon';
import {
  LatLon,
  OsrmDrivingRouteService,
} from '@shared/services/osrm-driving-route.service';
import {
  MexicoPostalCodeService,
  type MxPostalSettlement,
} from '@shared/services/mexico-postal-code.service';
import { PhotonPlaceSearchService } from '@shared/services/photon-place-search.service';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToConfirmDialogComponent } from '@shared/ui/to-confirm-dialog/to-confirm-dialog.component';
import { ToDisplayFieldComponent } from '@shared/ui/to-display-field/to-display-field.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import {
  ToSelectComponent,
  ToSelectOption,
} from '@shared/ui/to-select/to-select.component';
import {
  isTripClientPaymentMethod,
  TRIP_CLIENT_PAYMENT_METHOD_OPTIONS,
} from '@shared/catalogs/trip-client-payment-options';
import {
  normalizeTripContainerType,
  TRIP_CONTAINER_TYPE_OPTIONS,
} from '@shared/catalogs/trip-container-type-options';
import { ToClientInputComponent } from '@shared/ui/to-client-input/to-client-input.component';
import { ToOperatorInputComponent } from '@shared/ui/to-operator-input/to-operator-input.component';
import {
  ToUnitInputComponent,
  type UnitPickedEvent,
} from '@shared/ui/to-unit-input/to-unit-input.component';
import { ToFleetComplianceIconsComponent } from '@shared/ui/to-fleet-compliance-icons/to-fleet-compliance-icons.component';
import { CargoDescriptionComboboxComponent } from '@features/trips/components/cargo-description-combobox/cargo-description-combobox.component';
import type { ClientCargoHistoryItem } from '@shared/models/api/api-trips-cargo-history.model';
import { combineLatest, EMPTY, of, type Observable } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';

@Component({
  selector: 'app-trips-new-drawer',
  standalone: true,
  imports: [
    ToSideDrawerComponent,
    FormsModule,
    ToButtonComponent,
    ToIconComponent,
    ToConfirmDialogComponent,
    OperationalCenterSelectComponent,
    ToDisplayFieldComponent,
    ToInputComponent,
    ToSelectComponent,
    ToClientInputComponent,
    ToOperatorInputComponent,
    ToUnitInputComponent,
    ToFleetComplianceIconsComponent,
    CargoDescriptionComboboxComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trips-new-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    './trips-new-drawer.component.scss',
  ],
})
export class TripsNewDrawerComponent {
  readonly trackFileEntry = trackFileEntry;

  private readonly osrm = inject(OsrmDrivingRouteService);
  private readonly photon = inject(PhotonPlaceSearchService);
  private readonly sepomex = inject(MexicoPostalCodeService);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  private readonly tripsFeature = inject(TripsFeatureService);
  private readonly destinationRatesFeature = inject(DestinationRatesFeatureService);
  private readonly operationalCentersFeature = inject(OperationalCentersFeatureService);
  private readonly operationConfigsFeature = inject(OperationConfigurationsFeatureService);
  private readonly tripEvaluation = inject(TripEvaluationService);
  private readonly tripsApi = inject(TripsApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly catalog = inject(TripsFormCatalogService);

  readonly dieselEstimateLoading = signal(false);
  /** Control automático de diesel (config empresa en sesión). */
  readonly dieselControlEnabled = computed(() => this.session.dieselControlEnabled());
  /** Preferencia empresa: autollenado en Nueva Maniobra. */
  readonly autoRecognitionEnabled = computed(() => this.session.tripAssistPrefillEnabled());
  readonly dieselLitersPlaceholder = computed(() =>
    this.dieselControlEnabled()
      ? 'Se estima al tener distancia y configuración'
      : 'Captura manualmente',
  );
  readonly dieselAmountPlaceholder = computed(() =>
    this.dieselControlEnabled()
      ? 'Se estima al tener distancia y configuración'
      : 'Captura manualmente',
  );
  /** Si el usuario editó diesel tras la última estimación automática. */
  private readonly dieselEstimateOverride = signal(false);
  private lastFuelEstimateInputFp = '';
  private lastAutoDieselLiters = '';
  private lastAutoDieselAmount = '';
  private lastAutoDieselPricePerLiter: number | null = null;
  private applyingDieselEstimate = false;
  private applyingDieselAmountFromLiters = false;
  /** Precio MXN/L de la empresa (BD) para mostrar y recalcular monto desde litros. */
  private readonly dieselPricePerLiter = signal<number | null>(null);

  /** Tarifa por destino: bloqueo tras edición manual (cobro, operador o casetas). */
  private readonly destinationRateSuggestionLocked = signal(false);
  private lastDestinationRateInputFp = '';
  private lastAutoOperatorQuota = '';
  private lastAutoClientCharge = '';
  private lastAutoCasetasAmount = '';
  private applyingDestinationRateSuggestion = false;
  readonly operatorQuotaSuggestionUi = signal<'none' | 'auto' | 'manual'>('none');
  readonly clientChargeSuggestionUi = signal<'none' | 'auto' | 'manual'>('none');
  readonly casetasSuggestionUi = signal<'none' | 'auto' | 'manual'>('none');
  readonly destinationRateMatched = signal(false);
  readonly destinationRateChargeRecognized = signal(false);
  readonly originOperationalCenterId = model('');
  private readonly matchedDestinationRateId = signal<string | null>(null);
  private readonly routeCacheActive = signal(false);

  /** Sugerencia UX de fechas planificadas desde tiempos referenciales de tarifa. */
  readonly plannedScheduleSuggestionUi = signal<'none' | 'auto' | 'manual'>('none');
  private lastPlannedScheduleContextFp = '';
  private lastAutoPlannedArrival = '';
  private lastAutoPlannedCompletion = '';
  private applyingPlannedScheduleSuggestion = false;

  /** Creado en constructor (contexto de inyección requerido por `toObservable`). */
  private readonly fuelEstimatePipeline$: Observable<FuelEstimateResponse | undefined>;

  private readonly originPrefillApplied = signal(false);
  private lastHandledOriginCenterId = '';
  /** CP y localidad de origen bloqueados mientras el origen viene del centro operativo. */
  readonly originRouteFieldsLocked = computed(() => {
    const id = this.originOperationalCenterId().trim();
    return id !== '' && !isOperationalCenterNewRoute(id);
  });
  private readonly destinationPrefillForClientId = signal('');
  private readonly originLocalityPending = signal<string | null>(null);
  private readonly destinationLocalityPending = signal<string | null>(null);
  /** Huella del prefill completo; si el formulario coincide, se omiten SEPOMEX/Photon. */
  private readonly originCompletePrefillFingerprint = signal<string | null>(null);
  private readonly destinationCompletePrefillFingerprint = signal<string | null>(null);

  readonly dismiss = output<void>();
  readonly saved = output<Trip>();

  /** Maniobras activas ya cargadas en la página (disponibilidad operador/unidad). */
  readonly activeTrips = input<readonly Trip[]>([]);

  /** Copia mutable para pickers (`to-operator-input` / `to-unit-input`). */
  readonly pickerActiveTrips = computed(() => [...this.activeTrips()]);

  /** Copias mutables para inputs con `prefetchMode` (evita NG4 readonly→mutable). */
  readonly pickerClients = computed((): Client[] => [...this.catalog.clients()]);
  readonly pickerUnits = computed((): Unit[] =>
    this.catalog
      .units()
      .filter(
        (u) =>
          isFleetResourceActive(u) &&
          unitHitchedEquipment(u).length > 0 &&
          unitMatchesManeuverOperationCode(u, this.operationType()),
      ),
  );

  readonly selectedUnitMatchesManeuverConfiguration = computed(() => {
    const uid = this.unitId().trim();
    if (!uid) {
      return true;
    }
    const unit = this.catalog.units().find((u) => u.id === uid);
    if (!unit) {
      return false;
    }
    return unitMatchesManeuverOperationCode(unit, this.operationType());
  });
  readonly pickerOperators = computed((): Operator[] =>
    this.catalog.operators().filter((o) => isFleetResourceActive(o)),
  );

  readonly selectedUnitHitchedEquipment = computed(() => {
    const id = this.unitId().trim();
    if (!id) {
      return [];
    }
    const unit = this.catalog.units().find((u) => u.id === id);
    return resolveUnitHitchedEquipment(unit, this.catalog.equipment());
  });

  readonly equipmentPrimaryReadonly = computed(() => {
    const hitched = this.selectedUnitHitchedEquipment();
    return hitched[0] ? formatManeuverEquipmentLabel(hitched[0]) : '';
  });

  readonly equipmentSecondaryReadonly = computed(() => {
    const hitched = this.selectedUnitHitchedEquipment();
    return hitched[1] ? formatManeuverEquipmentLabel(hitched[1]) : '';
  });

  readonly selectedUnit = computed(() => {
    const id = this.unitId().trim();
    if (!id) {
      return undefined;
    }
    return this.catalog.units().find((u) => u.id === id);
  });

  readonly selectedUnitComplianceIcons = computed(() => {
    const unitId = this.unitId().trim();
    const expenses = this.catalog.fleetCoverageExpenses();
    return fleetComplianceIconsForUnit(this.selectedUnit(), {
      insuranceExpenses: insuranceExpensesForUnit(expenses, unitId),
      gpsExpenses: gpsExpensesForUnit(expenses, unitId),
    });
  });

  readonly equipmentPrimaryComplianceIcons = computed(() => {
    const hitched = this.selectedUnitHitchedEquipment();
    const equipment = hitched[0];
    const expenses = this.catalog.fleetCoverageExpenses();
    return fleetComplianceIconsForEquipment(equipment, {
      insuranceExpenses: equipment
        ? insuranceExpensesForEquipment(expenses, equipment.id)
        : [],
    });
  });

  readonly equipmentSecondaryComplianceIcons = computed(() => {
    const hitched = this.selectedUnitHitchedEquipment();
    const equipment = hitched[1];
    const expenses = this.catalog.fleetCoverageExpenses();
    return fleetComplianceIconsForEquipment(equipment, {
      insuranceExpenses: equipment
        ? insuranceExpensesForEquipment(expenses, equipment.id)
        : [],
    });
  });

  /** Escaneos / fotos adjuntos (solo en cliente hasta envío al backend). */
  readonly attachedFiles = signal<File[]>([]);

  /** Texto de ruta (origen/destino) derivado de CP + localidad + geocodificación. */
  readonly origin = model('');
  readonly destination = model('');

  readonly originCp = model('');
  readonly destinationCp = model('');

  readonly originSettlements = signal<MxPostalSettlement[]>([]);
  readonly destinationSettlements = signal<MxPostalSettlement[]>([]);

  readonly originLocalityKey = model('');
  readonly destinationLocalityKey = model('');

  readonly originCpLoading = signal(false);
  readonly destinationCpLoading = signal(false);

  readonly originCoords = signal<LatLon | null>(null);
  readonly destinationCoords = signal<LatLon | null>(null);

  /** Distancia por carretera (OSRM), solo ida. */
  readonly routeKm = signal<number | null>(null);
  /** Km operativos (ida + vuelta) desde API fuel-estimate; no calcular ×2 en cliente. */
  readonly operationalDistanceKmFromApi = signal<number | null>(null);
  readonly routeLoading = signal(false);
  /** Solo fallo de OSRM (ruta), no de Photon. */
  readonly routeFailed = signal(false);
  /** Photon sin hit cuando el par origen/destino ya estaba completo en formulario. */
  readonly originGeocodeFailed = signal(false);
  readonly destinationGeocodeFailed = signal(false);
  readonly operationType = model('sencillo');
  readonly loadType = model<TripLoadType>('vacio');
  readonly containerType = model<TripContainerType>('na');
  readonly cargoDescription = model('');
  readonly cargoHistoryItems = signal<readonly ClientCargoHistoryItem[]>([]);
  readonly approximateWeightTons = model('');
  readonly dieselLiters = model('');
  readonly dieselAmount = model('');
  readonly casetasAmount = model('');
  readonly operatorQuota = model('');
  readonly perDiemAmount = model('');
  readonly clientCharge = model('');
  readonly creditDays = model('');
  readonly requiresInvoice = model(false);
  readonly paymentMethod = model<string>('cash');
  readonly assignedOperatorId = model('');
  readonly unitId = model('');
  /** Valores internos de `ASSIGNABLE_EQUIPMENT_OPTIONS`; en Full se usan dos filas. */
  readonly equipmentPrimary = model('');
  readonly equipmentSecondary = model('');
  /** `yyyy-mm-ddTHH:mm` — mapeo 1:1 a planned_departure_at / planned_arrival_at / planned_completion_at */
  readonly plannedDepartureDateTime = model('');
  readonly plannedArrivalDateTime = model('');
  readonly plannedCompletionDateTime = model('');

  readonly plannedScheduleValid = computed(() =>
    isPlannedScheduleValid(
      this.plannedDepartureDateTime(),
      this.plannedArrivalDateTime(),
      this.plannedCompletionDateTime(),
    ),
  );
  readonly clientName = model('');
  readonly clientId = model('');

  /**
   * Si es falso, la maniobra no registra cliente/cobro (p. ej. unidades propias).
   * Al activarse, se muestran y validan los campos de la sección.
   */
  /** Por defecto activo: la mayoría de maniobras llevan cliente y cobro. */
  readonly includeClientBilling = model(true);

  /** Full → dos equipos obligatorios; otras configuraciones → uno (según catálogo). */
  readonly selectedOperationConfig = computed(() =>
    this.operationConfigsFeature.configurationByCode(this.operationType()),
  );
  readonly usesMultipleEquipmentOperation = computed(() => {
    const selected = this.selectedOperationConfig();
    return (
      this.tripEvaluation.evaluateDraft({
        operationConfigurationId: selected?.id,
        operationCode: this.operationType(),
        maxEquipmentCount: selected?.maxEquipmentCount,
      }).maxEquipmentMode === 'multi'
    );
  });

  readonly operationOptions = computed((): ToSelectOption[] =>
    this.operationConfigsFeature.activeConfigurations().map((c) => ({
      value: c.code,
      label: c.name,
    })),
  );

  readonly loadTypeOptions: ToSelectOption[] = [
    { value: 'vacio', label: 'Vacío' },
    { value: 'lleno', label: 'Lleno' },
  ];

  readonly containerTypeOptions: ToSelectOption[] = TRIP_CONTAINER_TYPE_OPTIONS;

  readonly paymentMethodOptions: ToSelectOption[] = TRIP_CLIENT_PAYMENT_METHOD_OPTIONS;

  readonly unitPlaceholder = 'Buscar unidad disponible…';

  readonly creating = signal(false);
  readonly drawerLoading = computed(() => !this.catalog.ready());
  readonly drawerBusy = computed(() => this.drawerLoading() || this.creating());

  /** Confirmación cuando las fechas planeadas ya pasaron (maniobra completada). */
  readonly pastCompletionConfirmOpen = signal(false);
  private pendingCreatePayload: CreateTripPayload | null = null;
  readonly plannedCompletionDisplayLabel = computed(() => {
    const iso = dateTimeLocalValueToIso(this.plannedCompletionDateTime().trim());
    if (!iso) {
      return '';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(d);
  });

  readonly dieselPriceLabel = computed(() => {
    const price = this.dieselPricePerLiter();
    if (price == null || !Number.isFinite(price) || price <= 0) {
      return null;
    }
    return `${formatFuelEstimateMoney(price)}/L`;
  });

  /** CP + localidad válidos en origen y destino (listo para OSRM / mensajes de error de par). */
  readonly routePairReady = computed(() => {
    const oKey = this.originLocalityKey().trim();
    const dKey = this.destinationLocalityKey().trim();
    const oCp = normalizeMxPostalCodeDigits(this.originCp());
    const dCp = normalizeMxPostalCodeDigits(this.destinationCp());
    if (oCp.length !== 5 || dCp.length !== 5 || !oKey || !dKey) {
      return false;
    }
    const oRows = this.originSettlements();
    const dRows = this.destinationSettlements();
    const oS = oRows.find((r) => localityKey(r) === oKey) ?? null;
    const dS = dRows.find((r) => localityKey(r) === dKey) ?? null;
    return !!(oS && dS);
  });

  /** Distancia OSRM (solo ida). */
  readonly routeDistanceOneWayDisplayValue = computed(() => {
    if (this.routeLoading()) {
      return 'Calculando…';
    }
    const km = this.routeKm();
    if (km !== null) {
      return `${formatRouteKmEsMx(km)} km`;
    }
    if (this.routeFailed() && this.originCoords() && this.destinationCoords()) {
      return 'No disponible (ruta)';
    }
    if (
      this.routePairReady() &&
      (this.originGeocodeFailed() || this.destinationGeocodeFailed())
    ) {
      return 'No disponible (ubicación)';
    }
    return '';
  });

  /** Distancia operativa (ida + vuelta) — valor del backend cuando diesel automático activo. */
  readonly operationalDistanceDisplayValue = computed(() => {
    if (this.routeLoading()) {
      return 'Calculando…';
    }
    if (this.dieselControlEnabled() && this.dieselEstimateLoading()) {
      return 'Calculando…';
    }
    if (!this.dieselControlEnabled()) {
      return '';
    }
    const op = this.operationalDistanceKmFromApi();
    if (op != null && Number.isFinite(op) && op > 0) {
      return `${formatRouteKmEsMx(op)} km`;
    }
    const oneWay = this.routeKm();
    if (oneWay != null && Number.isFinite(oneWay) && oneWay > 0) {
      return 'Pendiente (estimación operativa)';
    }
    return '';
  });

  /** Local si distancia ≤ 25 km; Foránea si mayor a 25 km (ruta OSRM). */
  readonly maneuverKindInputValue = computed(() => {
    if (this.routeLoading()) {
      return 'Calculando…';
    }
    const km = this.routeKm();
    if (km === null) {
      return '';
    }
    return km <= 25 ? 'Local' : 'Foránea';
  });

  readonly originLocalitySelectOptions = computed<ToSelectOption[]>(() =>
    this.originSettlements().map((row) => ({
      value: localityKey(row),
      label: formatSettlementOptionLabel(row),
    })),
  );

  readonly destinationLocalitySelectOptions = computed<ToSelectOption[]>(() =>
    this.destinationSettlements().map((row) => ({
      value: localityKey(row),
      label: formatSettlementOptionLabel(row),
    })),
  );

  readonly originCityLine = computed(() => {
    const rows = this.originSettlements();
    if (rows.length === 0) {
      return '';
    }
    const key = this.originLocalityKey();
    const s = rows.find((r) => localityKey(r) === key) ?? rows[0];
    return cityMunicipalityLineFromSettlement(s);
  });

  readonly destinationCityLine = computed(() => {
    const rows = this.destinationSettlements();
    if (rows.length === 0) {
      return '';
    }
    const key = this.destinationLocalityKey();
    const s = rows.find((r) => localityKey(r) === key) ?? rows[0];
    return cityMunicipalityLineFromSettlement(s);
  });

  readonly assignedOperator = computed(() => {
    const id = this.assignedOperatorId().trim();
    if (!id) {
      return null;
    }
    return this.catalog.operators().find((o) => o.id === id) ?? null;
  });

  readonly operatorLicenseReadonly = computed(
    () => this.assignedOperator()?.licenseNumber?.trim() ?? '',
  );

  readonly operatorLicenseExpiresReadonly = computed(() => {
    const iso = this.assignedOperator()?.licenseExpiresOn?.trim();
    if (!iso) {
      return '';
    }
    return operatorLicenseExpiresLabelFromIso(iso);
  });

  constructor() {
    this.destinationRatesFeature.loadDestinationRates();
    this.operationalCentersFeature.loadOperationalCenters();
    this.operationConfigsFeature.loadOperationConfigurations();
    this.catalog.ensureLoaded();

    effect(() => {
      const unitId = this.unitId().trim();
      const hitched = this.selectedUnitHitchedEquipment();
      const equipmentIds = [hitched[0]?.id, hitched[1]?.id].filter(
        (id): id is string => Boolean(id?.trim()),
      );
      this.catalog.ensureComplianceExpenses(unitId, equipmentIds);
    });

    this.fuelEstimatePipeline$ = combineLatest([
      toObservable(this.routeKm),
      toObservable(this.operationType),
      toObservable(this.selectedOperationConfig),
      toObservable(this.loadType),
      toObservable(this.containerType),
      toObservable(this.approximateWeightTons),
      toObservable(this.unitId),
      toObservable(this.equipmentPrimary),
      toObservable(this.equipmentSecondary),
      toObservable(this.originCoords),
      toObservable(this.destinationCoords),
    ]).pipe(
      debounceTime(600),
      map(
        ([
          distanceKm,
          operationType,
          selectedConfig,
          loadType,
          containerType,
          approximateWeightTons,
          unitId,
          equipmentPrimary,
          equipmentSecondary,
          originCoords,
          destinationCoords,
        ]) =>
          buildFuelEstimateRequest({
            distanceKm,
            operationType,
            maxEquipmentCount: this.tripEvaluation.evaluateDraft({
              operationConfigurationId: selectedConfig?.id,
              operationCode: operationType,
              maxEquipmentCount: selectedConfig?.maxEquipmentCount,
            }).maxEquipmentCount,
            loadType,
            containerType,
            approximateWeightTons,
            unitId,
            equipmentPrimary,
            equipmentSecondary,
            originCoords,
            destinationCoords,
          }),
      ),
      distinctUntilChanged((a, b) => {
        if (a === b) {
          return true;
        }
        if (!a || !b) {
          return false;
        }
        return fuelEstimateInputsFingerprint(a) === fuelEstimateInputsFingerprint(b);
      }),
      tap((req) => {
        if (!req) {
          return;
        }
        const fp = fuelEstimateInputsFingerprint(req);
        if (fp !== this.lastFuelEstimateInputFp) {
          this.lastFuelEstimateInputFp = fp;
          this.dieselEstimateOverride.set(false);
        }
      }),
      switchMap((req) => {
        if (!req || this.dieselEstimateOverride()) {
          return EMPTY;
        }
        this.dieselEstimateLoading.set(true);
        return this.tripsApi.estimateFuelConsumption(req).pipe(
          catchError((err) => {
            console.error('[Trips][FuelEstimate][Error]', err);
            return EMPTY;
          }),
          finalize(() => this.dieselEstimateLoading.set(false)),
        );
      }),
      tap((res) => {
        if (!res) {
          return;
        }
        if (
          res.operationalDistanceKm != null &&
          Number.isFinite(res.operationalDistanceKm)
        ) {
          this.operationalDistanceKmFromApi.set(res.operationalDistanceKm);
        }
        if (!this.dieselEstimateOverride()) {
          this.applyDieselEstimate(res);
        }
      }),
    );

    effect(() => {
      if (!this.usesMultipleEquipmentOperation()) {
        this.equipmentSecondary.set('');
      }
    });

    effect(() => {
      if (!this.unitId().trim()) {
        this.equipmentPrimary.set('');
        this.equipmentSecondary.set('');
      }
    });

    effect(() => {
      this.operationType();
      const unitId = this.unitId().trim();
      if (!unitId || this.selectedUnitMatchesManeuverConfiguration()) {
        return;
      }
      const configName = this.selectedOperationConfig()?.name ?? 'la configuración seleccionada';
      this.unitId.set('');
      this.equipmentPrimary.set('');
      this.equipmentSecondary.set('');
      this.toast.show(
        `La unidad ya no coincide con «${configName}». Elige una unidad compatible.`,
        'warning',
      );
    });

    effect(() => {
      const configs = this.operationConfigsFeature.activeConfigurations();
      if (configs.length === 0) {
        return;
      }
      const current = this.operationType().trim();
      if (!configs.some((c) => c.code === current)) {
        this.operationType.set(configs[0].code);
      }
    });

    effect(() => {
      const centerId = this.originOperationalCenterId().trim();

      if (isOperationalCenterNewRoute(centerId)) {
        if (this.lastHandledOriginCenterId !== centerId) {
          const wasOperationalCenter =
            this.lastHandledOriginCenterId !== '' &&
            !isOperationalCenterNewRoute(this.lastHandledOriginCenterId);
          this.lastHandledOriginCenterId = centerId;
          if (wasOperationalCenter) {
            this.clearOriginRouteEndpoint();
          }
        }
        return;
      }

      if (!centerId) {
        return;
      }

      const center = this.operationalCentersFeature.centerById(centerId);
      if (!center) {
        return;
      }

      if (this.lastHandledOriginCenterId === centerId) {
        return;
      }

      this.lastHandledOriginCenterId = centerId;
      this.routeCacheActive.set(false);
      this.matchedDestinationRateId.set(null);
      const prefill = originPrefillFromOperationalCenter(center);
      if (prefill) {
        this.applyRouteEndpointPrefill('origin', prefill);
      }
    });

    effect(() => {
      if (!this.catalog.ready() || this.originPrefillApplied()) {
        return;
      }
      const centers = this.operationalCentersFeature.centers();
      if (centers.length === 0) {
        return;
      }
      this.originPrefillApplied.set(true);
      const defaultCenter = this.operationalCentersFeature.defaultCenter();
      if (defaultCenter && !this.originOperationalCenterId().trim()) {
        this.originOperationalCenterId.set(defaultCenter.id);
      }
    });

    effect(() => {
      if (!this.includeClientBilling()) {
        this.destinationPrefillForClientId.set('');
        return;
      }
      const id = this.clientId().trim();
      if (!id || id === this.destinationPrefillForClientId()) {
        return;
      }
      const client = this.catalog.clients().find((c) => c.id === id);
      if (!client) {
        return;
      }
      this.destinationPrefillForClientId.set(id);
      if (this.autoRecognitionEnabled()) {
        if (client.payment?.hasCredit && client.payment.creditDays != null) {
          this.creditDays.set(String(client.payment.creditDays));
        } else {
          this.creditDays.set('');
        }
        const preferred = client.payment?.defaultPaymentMethod?.trim();
        if (preferred && isTripClientPaymentMethod(preferred)) {
          this.paymentMethod.set(preferred);
        }
      }
      const prefill = destinationPrefillFromClient(client);
      if (prefill) {
        this.applyRouteEndpointPrefill('destination', prefill);
      }
    });

    combineLatest([
      toObservable(this.originLocalityKey),
      toObservable(this.originSettlements),
      toObservable(this.originCp),
      toObservable(this.destinationLocalityKey),
    ])
      .pipe(
        debounceTime(200),
        map(([oKey, oRows, rawOcp, dKeyPeer]) => {
          const oCp = normalizeMxPostalCodeDigits(rawOcp);
          const oS =
            oKey && oRows.length > 0
              ? (oRows.find((r) => localityKey(r) === oKey) ?? null)
              : null;
          return { oKey, oRows, oCp, oS, dKeyPeer };
        }),
        distinctUntilChanged(
          (a, b) =>
            a.oKey === b.oKey &&
            a.oCp === b.oCp &&
            a.dKeyPeer === b.dKeyPeer &&
            a.oRows.length === b.oRows.length &&
            a.oRows.map((r) => localityKey(r)).join('|') ===
              b.oRows.map((r) => localityKey(r)).join('|'),
        ),
        tap(({ oS, oKey, oRows, oCp }) => {
          const originGeoReady = !!(oKey && oS && oCp.length === 5);
          if (!originGeoReady) {
            if (!isValidLatLon(this.originCoords())) {
              this.originCoords.set(null);
            }
            this.routeKm.set(null);
            this.routeLoading.set(false);
            this.routeFailed.set(false);
            this.originGeocodeFailed.set(false);
          }
          if (oS && oCp.length === 5) {
            this.origin.set(formatLocationLabelFromSettlement(oS, oCp));
          } else if (!oKey || oRows.length === 0) {
            this.origin.set('');
          }
        }),
        switchMap(({ oS, oKey, oCp }) => {
          if (!oKey || !oS || oCp.length !== 5) {
            return EMPTY;
          }
          if (this.shouldSkipExternalNormalization('origin', oCp)) {
            return EMPTY;
          }
          return this.photon
            .firstCoordinatesForMexicanSepomex(geocodeQueryFromSettlement(oS, oCp), {
              state: oS.state,
              municipality: oS.municipality,
              settlement: oS.settlement,
            })
            .pipe(
              tap((ll) => this.applyPhotonCoords('origin', ll)),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    combineLatest([
      toObservable(this.destinationLocalityKey),
      toObservable(this.destinationSettlements),
      toObservable(this.destinationCp),
      toObservable(this.originLocalityKey),
    ])
      .pipe(
        debounceTime(200),
        map(([dKey, dRows, rawDcp, oKeyPeer]) => {
          const dCp = normalizeMxPostalCodeDigits(rawDcp);
          const dS =
            dKey && dRows.length > 0
              ? (dRows.find((r) => localityKey(r) === dKey) ?? null)
              : null;
          return { dKey, dRows, dCp, dS, oKeyPeer };
        }),
        distinctUntilChanged(
          (a, b) =>
            a.dKey === b.dKey &&
            a.dCp === b.dCp &&
            a.oKeyPeer === b.oKeyPeer &&
            a.dRows.length === b.dRows.length &&
            a.dRows.map((r) => localityKey(r)).join('|') ===
              b.dRows.map((r) => localityKey(r)).join('|'),
        ),
        tap(({ dS, dKey, dRows, dCp }) => {
          const destGeoReady = !!(dKey && dS && dCp.length === 5);
          if (!destGeoReady) {
            if (!isValidLatLon(this.destinationCoords())) {
              this.destinationCoords.set(null);
            }
            this.routeKm.set(null);
            this.routeLoading.set(false);
            this.routeFailed.set(false);
            this.destinationGeocodeFailed.set(false);
          }
          if (dS && dCp.length === 5) {
            this.destination.set(formatLocationLabelFromSettlement(dS, dCp));
          } else if (!dKey || dRows.length === 0) {
            this.destination.set('');
          }
        }),
        switchMap(({ dS, dKey, dCp }) => {
          if (!dKey || !dS || dCp.length !== 5) {
            return EMPTY;
          }
          if (this.shouldSkipExternalNormalization('destination', dCp)) {
            return EMPTY;
          }
          return this.photon
            .firstCoordinatesForMexicanSepomex(geocodeQueryFromSettlement(dS, dCp), {
              state: dS.state,
              municipality: dS.municipality,
              settlement: dS.settlement,
            })
            .pipe(
              tap((ll) => this.applyPhotonCoords('destination', ll)),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    const sameLatLon = (a: LatLon | null, b: LatLon | null): boolean => {
      if (a === b) {
        return true;
      }
      if (!a || !b) {
        return false;
      }
      return a.lat === b.lat && a.lon === b.lon;
    };

    combineLatest([toObservable(this.originCoords), toObservable(this.destinationCoords)])
      .pipe(
        debounceTime(300),
        distinctUntilChanged(([oa, da], [ob, db]) => sameLatLon(oa, ob) && sameLatLon(da, db)),
        tap(([o, d]) => {
          if (!isValidLatLon(o) || !isValidLatLon(d)) {
            this.routeKm.set(null);
            this.operationalDistanceKmFromApi.set(null);
            this.routeLoading.set(false);
          }
        }),
        filter((pair): pair is [LatLon, LatLon] => {
          const [o, d] = pair;
          if (!isValidLatLon(o) || !isValidLatLon(d)) {
            return false;
          }
          if (this.routeCacheActive()) {
            return false;
          }
          if (!this.routePairReady()) {
            return false;
          }
          return true;
        }),
        switchMap(([o, d]) => {
          this.routeLoading.set(true);
          this.routeFailed.set(false);
          return this.osrm.drivingKm(o, d).pipe(
            map((km) => ({ km, failed: km === null })),
            catchError(() => of({ km: null, failed: true })),
            finalize(() => this.routeLoading.set(false)),
          );
        }),
        tap((r) => {
          if (r !== null && typeof r === 'object' && 'km' in r) {
            const box = r as { km: number | null; failed: boolean };
            this.routeKm.set(box.km);
            this.routeFailed.set(box.failed);
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    effect((onCleanup) => {
      if (!this.session.dieselControlEnabled()) {
        this.resetFuelEstimateAutoState();
        return;
      }
      const sub = this.fuelEstimatePipeline$.subscribe();
      onCleanup(() => {
        sub.unsubscribe();
        this.resetFuelEstimateAutoState();
      });
    });

    effect(() => {
      const snapshot = this.operationalCentersFeature.dieselReferencePrice();
      if (!snapshot?.enabled || snapshot.pricePerLiter == null) {
        return;
      }
      this.dieselPricePerLiter.set(snapshot.pricePerLiter);
      if (this.lastAutoDieselPricePerLiter == null) {
        this.lastAutoDieselPricePerLiter = snapshot.pricePerLiter;
      }
    });

    effect(() => {
      if (this.applyingDieselEstimate || this.applyingDieselAmountFromLiters) {
        return;
      }
      const price = this.dieselPricePerLiter();
      if (price == null || !Number.isFinite(price) || price <= 0) {
        return;
      }
      const liters = parseNonNegativeNumber(this.dieselLiters());
      if (liters == null) {
        return;
      }
      const nextAmount = formatFuelEstimateMoney(liters * price);
      if (stripGroupedNumberInput(this.dieselAmount()) === stripGroupedNumberInput(nextAmount)) {
        return;
      }
      this.applyingDieselAmountFromLiters = true;
      this.dieselAmount.set(nextAmount);
      this.applyingDieselAmountFromLiters = false;
    });

    effect(() => {
      if (!this.autoRecognitionEnabled()) {
        this.destinationRateMatched.set(false);
        this.destinationRateChargeRecognized.set(false);
        this.matchedDestinationRateId.set(null);
        this.clearDestinationRateSuggestionUi();
        return;
      }
      const originId = this.originOperationalCenterId().trim();
      const clientId = this.clientId().trim();
      const client = clientId
        ? this.catalog.clients().find((c) => c.id === clientId)
        : undefined;
      const clientDestinationRateId = client?.delivery?.destinationRateId;
      const cp = normalizeMxPostalCodeDigits(this.destinationCp());
      const destLocality = (() => {
        const key = this.destinationLocalityKey().trim();
        const rows = this.destinationSettlements();
        if (!key || rows.length === 0) {
          return '';
        }
        const settlement = rows.find((r) => localityKey(r) === key);
        return settlement?.settlement.trim() ?? '';
      })();
      const op = this.operationType();
      const billing = this.includeClientBilling();
      const fp = `${originId}|${cp}|${destLocality}|${op}|${billing ? '1' : '0'}`;
      const rates = this.destinationRatesFeature.rates();

      if (fp !== this.lastDestinationRateInputFp) {
        this.lastDestinationRateInputFp = fp;
        this.destinationRateSuggestionLocked.set(false);
        this.routeCacheActive.set(false);
        this.matchedDestinationRateId.set(null);
      }

      const rateOriginId = isOperationalCenterNewRoute(originId) ? '' : originId;
      const rate =
        rateOriginId && cp.length === 5 && destLocality
          ? resolveManeuverDestinationRate(rates, {
              originOperationalCenterId: rateOriginId,
              destinationPostalCode: cp,
              destinationLocality: destLocality,
              clientDestinationRateId,
            })
          : undefined;

      const departure = this.plannedDepartureDateTime().trim();
      const scheduleContextFp = `${originId}|${clientId}|${cp}|${destLocality}|${rate?.id ?? ''}`;
      if (scheduleContextFp !== this.lastPlannedScheduleContextFp) {
        this.lastPlannedScheduleContextFp = scheduleContextFp;
        this.resetPlannedScheduleSuggestionForContextChange();
      }

      if (!rateOriginId || cp.length !== 5 || !destLocality) {
        this.destinationRateMatched.set(false);
        this.destinationRateChargeRecognized.set(false);
        this.matchedDestinationRateId.set(null);
        this.clearDestinationRateSuggestionUi();
        return;
      }

      this.destinationRateMatched.set(rate != null);
      this.destinationRateChargeRecognized.set(
        rate != null && destinationRateHasClientChargeForOperation(rate, op),
      );

      if (!rate) {
        this.matchedDestinationRateId.set(null);
        this.clearDestinationRateSuggestionUi();
        return;
      }

      this.matchedDestinationRateId.set(rate.id);

      if (!this.destinationRateSuggestionLocked()) {
        this.applyDestinationRateSuggestion(rate, op, billing);
      }

      if (departure && dateTimeLocalValueToIso(departure)) {
        this.tryApplyPlannedScheduleFromMatchedRate(rate);
      }
    });

    toObservable(this.originCp)
      .pipe(
        map(() => normalizeMxPostalCodeDigits(this.originCp())),
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((cpDigits) => {
          if (cpDigits.length !== 5) {
            this.originCpLoading.set(false);
            this.originSettlements.set([]);
            this.originLocalityKey.set('');
            this.origin.set('');
            this.originCoords.set(null);
            this.originCompletePrefillFingerprint.set(null);
            return EMPTY;
          }
          if (this.shouldSkipExternalNormalization('origin', cpDigits)) {
            return EMPTY;
          }
          this.originCompletePrefillFingerprint.set(null);
          this.originCpLoading.set(true);
          return this.sepomex.lookupByPostalCode(cpDigits).pipe(
            tap((rows) => {
              this.originSettlements.set(rows);
              if (rows.length === 0) {
                this.originLocalityKey.set('');
                this.origin.set('');
                this.originCoords.set(null);
                this.toast.show('Código postal de origen no encontrado.', 'warning');
              } else {
                this.applyPendingLocalityAfterSepomex('origin', rows);
              }
            }),
            finalize(() => this.originCpLoading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    toObservable(this.destinationCp)
      .pipe(
        map(() => normalizeMxPostalCodeDigits(this.destinationCp())),
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((cpDigits) => {
          if (cpDigits.length !== 5) {
            this.destinationCpLoading.set(false);
            this.destinationSettlements.set([]);
            this.destinationLocalityKey.set('');
            this.destination.set('');
            this.destinationCoords.set(null);
            this.destinationCompletePrefillFingerprint.set(null);
            return EMPTY;
          }
          if (this.shouldSkipExternalNormalization('destination', cpDigits)) {
            return EMPTY;
          }
          this.destinationCompletePrefillFingerprint.set(null);
          this.destinationCpLoading.set(true);
          return this.sepomex.lookupByPostalCode(cpDigits).pipe(
            tap((rows) => {
              this.destinationSettlements.set(rows);
              if (rows.length === 0) {
                this.destinationLocalityKey.set('');
                this.destination.set('');
                this.destinationCoords.set(null);
                this.toast.show('Código postal de destino no encontrado.', 'warning');
              } else {
                this.applyPendingLocalityAfterSepomex('destination', rows);
              }
            }),
            finalize(() => this.destinationCpLoading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    combineLatest([
      toObservable(this.includeClientBilling),
      toObservable(this.clientId),
      toObservable(this.autoRecognitionEnabled),
    ])
      .pipe(
        map(([billing, id, autoOn]) => ({
          billing,
          id: id.trim(),
          autoOn,
        })),
        distinctUntilChanged(
          (a, b) =>
            a.billing === b.billing && a.id === b.id && a.autoOn === b.autoOn,
        ),
        switchMap(({ billing, id, autoOn }) => {
          if (!autoOn || !billing || !id) {
            this.cargoHistoryItems.set([]);
            return EMPTY;
          }
          return this.tripsApi.getClientCargoHistory(id).pipe(
            tap((res) => this.cargoHistoryItems.set(res.items ?? [])),
            catchError(() => {
              this.cargoHistoryItems.set([]);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  onCargoHistoryPicked(item: ClientCargoHistoryItem): void {
    if (!this.autoRecognitionEnabled()) {
      return;
    }
    this.cargoDescription.set(item.description);
    const op = item.operationType.trim();
    const validOp = this.operationOptions().some((o) => String(o.value) === op);
    if (validOp) {
      this.operationType.set(op);
    }
    this.containerType.set(normalizeTripContainerType(item.containerType));
    this.loadType.set(item.loadType as TripLoadType);
    this.approximateWeightTons.set(item.approximateWeightTons);
  }

  private applyPhotonCoords(side: 'origin' | 'destination', ll: LatLon | null): void {
    const current =
      side === 'origin' ? this.originCoords() : this.destinationCoords();
    if (ll) {
      if (side === 'origin') {
        this.originCoords.set(ll);
        this.originGeocodeFailed.set(false);
      } else {
        this.destinationCoords.set(ll);
        this.destinationGeocodeFailed.set(false);
      }
      return;
    }
    if (isValidLatLon(current)) {
      if (side === 'origin') {
        this.originGeocodeFailed.set(false);
      } else {
        this.destinationGeocodeFailed.set(false);
      }
      return;
    }
    if (side === 'origin') {
      this.originCoords.set(null);
      this.originGeocodeFailed.set(this.routePairReady());
    } else {
      this.destinationCoords.set(null);
      this.destinationGeocodeFailed.set(this.routePairReady());
    }
    this.routeKm.set(null);
  }

  private applyPendingLocalityAfterSepomex(
    side: 'origin' | 'destination',
    rows: MxPostalSettlement[],
  ): void {
    const pending =
      side === 'origin'
        ? this.originLocalityPending()
        : this.destinationLocalityPending();
    if (pending && rows.some((r) => localityKey(r) === pending)) {
      if (side === 'origin') {
        this.originLocalityKey.set(pending);
        this.originLocalityPending.set(null);
      } else {
        this.destinationLocalityKey.set(pending);
        this.destinationLocalityPending.set(null);
      }
      return;
    }
    if (pending) {
      const consMatch = rows.find((r) => r.settlementConsId === pending);
      if (consMatch) {
        const key = localityKey(consMatch);
        if (side === 'origin') {
          this.originLocalityKey.set(key);
          this.originLocalityPending.set(null);
        } else {
          this.destinationLocalityKey.set(key);
          this.destinationLocalityPending.set(null);
        }
        return;
      }
    }
    if (side === 'origin') {
      this.originLocalityKey.set('');
      this.originLocalityPending.set(null);
    } else {
      this.destinationLocalityKey.set('');
      this.destinationLocalityPending.set(null);
    }
  }

  /**
   * Omite SEPOMEX/Photon cuando el extremo coincide con un prefill completo (CP + localidad + coords).
   * Si el usuario edita CP/localidad, la huella deja de coincidir y se reactiva la normalización.
   */
  private shouldSkipExternalNormalization(
    side: 'origin' | 'destination',
    cpDigits: string,
  ): boolean {
    const stored =
      side === 'origin'
        ? this.originCompletePrefillFingerprint()
        : this.destinationCompletePrefillFingerprint();
    if (!stored) {
      return false;
    }
    const current =
      side === 'origin'
        ? this.currentEndpointFingerprint('origin')
        : this.currentEndpointFingerprint('destination');
    if (stored !== current) {
      return false;
    }
    const cp =
      side === 'origin'
        ? normalizeMxPostalCodeDigits(this.originCp())
        : normalizeMxPostalCodeDigits(this.destinationCp());
    if (cp !== cpDigits) {
      return false;
    }
    const coords = side === 'origin' ? this.originCoords() : this.destinationCoords();
    return isValidLatLon(coords);
  }

  private currentEndpointFingerprint(side: 'origin' | 'destination'): string {
    const cp = normalizeMxPostalCodeDigits(
      side === 'origin' ? this.originCp() : this.destinationCp(),
    );
    const key =
      side === 'origin' ? this.originLocalityKey() : this.destinationLocalityKey();
    const coords = side === 'origin' ? this.originCoords() : this.destinationCoords();
    return routeEndpointFingerprint(cp, key, coords);
  }

  /** Valores iniciales desde sesión o cliente; el usuario puede editar CP/localidad después. */
  private applyDieselEstimate(res: FuelEstimateResponse): void {
    const liters = formatFuelEstimateLiters(res.estimatedLiters);
    const amount = formatFuelEstimateMoney(res.estimatedDieselCost);
    if (
      Number.isFinite(res.dieselPricePerLiter) &&
      res.dieselPricePerLiter > 0
    ) {
      this.dieselPricePerLiter.set(res.dieselPricePerLiter);
      this.lastAutoDieselPricePerLiter = res.dieselPricePerLiter;
    }
    this.applyingDieselEstimate = true;
    this.dieselLiters.set(liters);
    this.dieselAmount.set(amount);
    this.lastAutoDieselLiters = liters;
    this.lastAutoDieselAmount = amount;
    this.applyingDieselEstimate = false;
  }

  private markDieselManualOverrideIfEdited(): void {
    if (this.applyingDieselEstimate) {
      return;
    }
    const liters = stripGroupedNumberInput(this.dieselLiters());
    const amount = stripGroupedNumberInput(this.dieselAmount());
    const autoLiters = stripGroupedNumberInput(this.lastAutoDieselLiters);
    const autoAmount = stripGroupedNumberInput(this.lastAutoDieselAmount);
    const litersEdited = liters !== '' && autoLiters !== '' && liters !== autoLiters;
    const amountEdited = amount !== '' && autoAmount !== '' && amount !== autoAmount;
    if (litersEdited || amountEdited) {
      this.dieselEstimateOverride.set(true);
    }
  }

  private clearOriginRouteEndpoint(): void {
    this.originLocalityPending.set(null);
    this.originCompletePrefillFingerprint.set(null);
    this.originSettlements.set([]);
    this.originLocalityKey.set('');
    this.originCoords.set(null);
    this.originGeocodeFailed.set(false);
    this.origin.set('');
    this.originCp.set('');
    this.originCpLoading.set(false);
    this.routeCacheActive.set(false);
    this.routeKm.set(null);
    this.routeLoading.set(false);
    this.routeFailed.set(false);
    this.operationalDistanceKmFromApi.set(null);
  }

  private applyRouteEndpointPrefill(
    side: 'origin' | 'destination',
    prefill: TripRouteEndpointPrefill,
  ): void {
    const built = buildRouteEndpointPrefillResult(prefill);
    if (!built) {
      return;
    }

    const settlement =
      built.settlements.find((r) => localityKey(r) === built.localityKey) ??
      built.settlements[0] ??
      null;
    const routeLabel =
      settlement != null
        ? formatLocationLabelFromSettlement(settlement, built.postalCode)
        : '';

    const fingerprint = routeEndpointFingerprint(
      built.postalCode,
      built.localityKey,
      built.coords,
    );

    if (side === 'origin') {
      if (built.complete) {
        this.originLocalityPending.set(null);
        this.originCompletePrefillFingerprint.set(fingerprint);
      } else {
        this.originLocalityPending.set(built.localityKey);
        this.originCompletePrefillFingerprint.set(null);
      }
      this.originSettlements.set(built.settlements);
      this.originLocalityKey.set(built.localityKey);
      if (built.coords) {
        this.originCoords.set(built.coords);
        this.originGeocodeFailed.set(false);
      }
      if (routeLabel) {
        this.origin.set(routeLabel);
      }
      this.originCp.set(built.postalCode);
    } else {
      if (built.complete) {
        this.destinationLocalityPending.set(null);
        this.destinationCompletePrefillFingerprint.set(fingerprint);
      } else {
        this.destinationLocalityPending.set(built.localityKey);
        this.destinationCompletePrefillFingerprint.set(null);
      }
      this.destinationSettlements.set(built.settlements);
      this.destinationLocalityKey.set(built.localityKey);
      if (built.coords) {
        this.destinationCoords.set(built.coords);
        this.destinationGeocodeFailed.set(false);
      }
      if (routeLabel) {
        this.destination.set(routeLabel);
      }
      this.destinationCp.set(built.postalCode);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }

  onDocumentsSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    if (list.length === 0) {
      return;
    }
    this.attachedFiles.update((prev) => [...prev, ...list]);
    input.value = '';
  }

  removeAttachedFile(index: number): void {
    this.attachedFiles.update((prev) => prev.filter((_, i) => i !== index));
  }

  private parseRequiredNonNegativeNumber(raw: string, fieldLabel: string): number | null {
    const s = stripGroupedNumberInput(raw);
    if (s === '') {
      this.toast.show(`El campo «${fieldLabel}» es obligatorio.`, 'warning');
      return null;
    }
    const n = parseNonNegativeNumber(raw);
    if (n === null) {
      this.toast.show(`«${fieldLabel}» no tiene un valor numérico válido.`, 'warning');
      return null;
    }
    return n;
  }

  private parseOptionalNonNegativeNumber(raw: string, fieldLabel: string): number | null {
    const s = stripGroupedNumberInput(raw);
    if (s === '') {
      return 0;
    }
    const n = parseNonNegativeNumber(raw);
    if (n === null) {
      this.toast.show(`«${fieldLabel}» no tiene un valor numérico válido.`, 'warning');
      return null;
    }
    return n;
  }

  private parseCreditDays(raw: string): number {
    const t = raw.trim();
    if (t === '') {
      return 0;
    }
    const n = Number.parseInt(t, 10);
    if (!Number.isFinite(n) || n < 0) {
      return 0;
    }
    return n;
  }

  private normalizePaymentMethod(v: string): TripClientPaymentMethod {
    if (isTripClientPaymentMethod(v)) {
      return v;
    }
    return 'cash';
  }

  onUnitPicked(ev: UnitPickedEvent): void {
    this.equipmentPrimary.set(ev.equipmentIds[0] ?? '');
    this.equipmentSecondary.set(ev.equipmentIds[1] ?? '');
  }

  private unitConfigurationMismatchMessage(): string {
    const configName = this.selectedOperationConfig()?.name ?? 'la configuración seleccionada';
    return `Selecciona una unidad con configuración «${configName}».`;
  }

  private labelForEquipmentId(id: string): string {
    const v = id.trim();
    if (!v) {
      return '';
    }
    const row = this.selectedUnitHitchedEquipment().find((e) => e.id === v);
    return row ? formatManeuverEquipmentLabel(row) : v;
  }

  private toastIfRequiredEmpty(value: string, fieldLabel: string): boolean {
    if (value.trim() === '') {
      this.toast.show(`El campo «${fieldLabel}» es obligatorio.`, 'warning');
      return true;
    }
    return false;
  }

  private toastIfInvalidNonNegativeNumber(raw: string, fieldLabel: string): boolean {
    const s = stripGroupedNumberInput(raw);
    if (s === '') {
      this.toast.show(`El campo «${fieldLabel}» es obligatorio.`, 'warning');
      return true;
    }
    const n = parseNonNegativeNumber(raw);
    if (n === null) {
      this.toast.show(`«${fieldLabel}» no tiene un valor numérico válido.`, 'warning');
      return true;
    }
    return false;
  }

  private toastIfInvalidOptionalNonNegativeNumber(raw: string, fieldLabel: string): boolean {
    const s = stripGroupedNumberInput(raw);
    if (s === '') {
      return false;
    }
    const n = parseNonNegativeNumber(raw);
    if (n === null) {
      this.toast.show(`«${fieldLabel}» no tiene un valor numérico válido.`, 'warning');
      return true;
    }
    return false;
  }

  private sanitizePlannedScheduleAfterDepartureChange(): void {
    const dep = this.plannedDepartureDateTime().trim();
    const arr = this.plannedArrivalDateTime().trim();
    const fin = this.plannedCompletionDateTime().trim();
    let cleared = false;

    if (arr && plannedScheduleArrivalOrderIssue(dep, arr)) {
      this.plannedArrivalDateTime.set('');
      cleared = true;
    }
    if (
      fin &&
      (plannedScheduleCompletionDepartureOrderIssue(dep, fin) ||
        plannedScheduleCompletionOrderIssue(arr, fin))
    ) {
      this.plannedCompletionDateTime.set('');
      cleared = true;
    }

    if (cleared) {
      this.plannedScheduleSuggestionUi.set('manual');
      this.lastAutoPlannedArrival = '';
      this.lastAutoPlannedCompletion = '';
    }
  }

  private maybeToastPlannedScheduleOrder(): void {
    if (this.plannedScheduleValid()) {
      return;
    }
    const dep = this.plannedDepartureDateTime().trim();
    const arr = this.plannedArrivalDateTime().trim();
    const fin = this.plannedCompletionDateTime().trim();
    const message = plannedScheduleOrderToastMessage(dep, arr, fin);
    if (message) {
      this.toast.show(message, 'warning');
      return;
    }
    if (!dep || !arr || !fin) {
      return;
    }
    this.toast.show(
      'El plan debe cumplir: salida ≤ llegada cliente ≤ llegada / fin.',
      'warning',
    );
  }

  onOriginCpBlur(): void {
    const digits = normalizeMxPostalCodeDigits(this.originCp());
    if (digits !== this.originCp()) {
      this.originCp.set(digits);
    }
    if (digits.length === 0) {
      this.toast.show('Indica el código postal de origen (5 dígitos).', 'warning');
      return;
    }
    if (digits.length !== 5) {
      this.toast.show('El código postal de origen debe tener 5 dígitos.', 'warning');
    }
  }

  onDestinationCpBlur(): void {
    const digits = normalizeMxPostalCodeDigits(this.destinationCp());
    if (digits !== this.destinationCp()) {
      this.destinationCp.set(digits);
    }
    if (digits.length === 0) {
      this.toast.show('Indica el código postal de destino (5 dígitos).', 'warning');
      return;
    }
    if (digits.length !== 5) {
      this.toast.show('El código postal de destino debe tener 5 dígitos.', 'warning');
    }
  }

  onClientBlur(): void {
    if (!this.includeClientBilling()) {
      return;
    }
    this.toastIfRequiredEmpty(this.clientName(), 'Cliente');
  }

  onUnitBlur(): void {
    if (this.unitId().trim() === '') {
      this.toast.show('Selecciona una unidad.', 'warning');
      return;
    }
    if (!this.selectedUnitMatchesManeuverConfiguration()) {
      this.toast.show(this.unitConfigurationMismatchMessage(), 'warning');
    }
  }

  onPlannedDepartureBlur(): void {
    const t = this.plannedDepartureDateTime().trim();
    if (!t) {
      if (this.plannedScheduleSuggestionUi() === 'auto') {
        this.clearPlannedScheduleAutoFields();
      }
      this.toast.show('Indica fecha y hora de salida.', 'warning');
      this.maybeToastPlannedScheduleOrder();
      return;
    }
    if (!dateTimeLocalValueToIso(t)) {
      this.toast.show('La fecha y hora de salida no son válidas.', 'warning');
      return;
    }
    if (this.plannedScheduleSuggestionUi() !== 'manual') {
      this.tryApplyPlannedScheduleFromMatchedRate();
    }
    this.sanitizePlannedScheduleAfterDepartureChange();
    this.maybeToastPlannedScheduleOrder();
  }

  onPlannedArrivalBlur(): void {
    this.markPlannedScheduleManualOverrideIfEdited();
    const dep = this.plannedDepartureDateTime().trim();
    const t = this.plannedArrivalDateTime().trim();
    const orderIssue = plannedScheduleArrivalOrderIssue(dep, t);
    if (orderIssue) {
      this.toast.show(orderIssue, 'warning');
      return;
    }
    if (!t) {
      this.toast.show('Indica fecha y hora de llegada al cliente.', 'warning');
      this.maybeToastPlannedScheduleOrder();
      return;
    }
    if (!dateTimeLocalValueToIso(t)) {
      this.toast.show('La fecha y hora de llegada al cliente no son válidas.', 'warning');
      return;
    }
    this.maybeToastPlannedScheduleOrder();
  }

  onPlannedCompletionBlur(): void {
    this.markPlannedScheduleManualOverrideIfEdited();
    const dep = this.plannedDepartureDateTime().trim();
    const arr = this.plannedArrivalDateTime().trim();
    const t = this.plannedCompletionDateTime().trim();
    const departureOrderIssue = plannedScheduleCompletionDepartureOrderIssue(dep, t);
    if (departureOrderIssue) {
      this.toast.show(departureOrderIssue, 'warning');
      return;
    }
    const orderIssue = plannedScheduleCompletionOrderIssue(arr, t);
    if (orderIssue) {
      this.toast.show(orderIssue, 'warning');
      return;
    }
    if (!t) {
      this.toast.show('Indica fecha y hora de llegada / fin de maniobra.', 'warning');
      this.maybeToastPlannedScheduleOrder();
      return;
    }
    if (!dateTimeLocalValueToIso(t)) {
      this.toast.show('La fecha y hora de llegada / fin no son válidas.', 'warning');
      return;
    }
    this.maybeToastPlannedScheduleOrder();
  }

  onDieselLitersBlur(): void {
    this.markDieselManualOverrideIfEdited();
    this.toastIfInvalidNonNegativeNumber(this.dieselLiters(), 'Diesel (litros)');
  }

  onDieselAmountBlur(): void {
    this.markDieselManualOverrideIfEdited();
    this.toastIfInvalidNonNegativeNumber(this.dieselAmount(), 'Diesel (monto)');
  }

  onCasetasBlur(): void {
    this.markDestinationRateManualOverrideIfEdited();
    this.toastIfInvalidNonNegativeNumber(this.casetasAmount(), 'Casetas');
  }

  onOperatorQuotaBlur(): void {
    this.markDestinationRateManualOverrideIfEdited();
    this.toastIfInvalidNonNegativeNumber(this.operatorQuota(), 'Operador');
  }

  onPerDiemAmountBlur(): void {
    this.toastIfInvalidOptionalNonNegativeNumber(this.perDiemAmount(), 'Viáticos');
  }

  onAssignedOperatorBlur(): void {
    if (this.assignedOperatorId().trim() === '') {
      this.toast.show('Selecciona un operador disponible.', 'warning');
    }
  }

  onClientChargeBlur(): void {
    if (!this.includeClientBilling()) {
      return;
    }
    this.markDestinationRateManualOverrideIfEdited();
    this.toastIfInvalidNonNegativeNumber(this.clientCharge(), 'Cobro');
  }

  submit(): void {
    if (this.creating()) {
      return;
    }
    const oCp = normalizeMxPostalCodeDigits(this.originCp());
    const dCp = normalizeMxPostalCodeDigits(this.destinationCp());
    if (oCp.length !== 5 || dCp.length !== 5) {
      this.toast.show(
        'Indica códigos postales de origen y destino (5 dígitos, solo México).',
        'warning',
      );
      return;
    }
    if (this.originSettlements().length === 0 || this.destinationSettlements().length === 0) {
      this.toast.show(
        'No hay datos SEPOMex para uno de los códigos postales; revisa e intenta de nuevo.',
        'warning',
      );
      return;
    }
    const okO = this.originSettlements().some(
      (r) => localityKey(r) === this.originLocalityKey(),
    );
    const okD = this.destinationSettlements().some(
      (r) => localityKey(r) === this.destinationLocalityKey(),
    );
    if (!okO || !okD) {
      this.toast.show('Selecciona la localidad de origen y la de destino.', 'warning');
      return;
    }

    const oKey = this.originLocalityKey().trim();
    const dKey = this.destinationLocalityKey().trim();
    const oS =
      this.originSettlements().find((r) => localityKey(r) === oKey) ?? null;
    const dS =
      this.destinationSettlements().find((r) => localityKey(r) === dKey) ?? null;
    if (!oS || !dS) {
      this.toast.show('Selecciona la localidad de origen y la de destino.', 'warning');
      return;
    }

    const origin = this.origin().trim();
    const destination = this.destination().trim();
    if (!origin || !destination) {
      this.toast.show(
        'No se pudo armar la ruta; espera un momento tras elegir CP y localidad.',
        'warning',
      );
      return;
    }

    const includeBilling = this.includeClientBilling();
    let client: string | undefined;
    if (includeBilling) {
      const c = this.clientName().trim();
      if (!c) {
        this.toast.show('Selecciona o escribe un cliente.', 'warning');
        return;
      }
      client = c;
    }

    const uid = this.unitId().trim();
    if (!uid) {
      this.toast.show('Selecciona una unidad.', 'warning');
      return;
    }

    if (!this.selectedUnitMatchesManeuverConfiguration()) {
      this.toast.show(this.unitConfigurationMismatchMessage(), 'warning');
      return;
    }

    const oprId = this.assignedOperatorId().trim();
    if (!oprId) {
      this.toast.show('Selecciona un operador disponible.', 'warning');
      return;
    }

    const config = this.operationType();
    const eq1 = this.equipmentPrimary().trim();
    const eq2 = this.equipmentSecondary().trim();

    if (this.usesMultipleEquipmentOperation()) {
      if (!eq1 || !eq2) {
        const configName = this.selectedOperationConfig()?.name ?? 'esta configuración';
        this.toast.show(
          `La unidad elegida no tiene la configuración de equipos requerida para ${configName}.`,
          'warning',
        );
        return;
      }
    } else if (!eq1) {
      this.toast.show('La unidad elegida no tiene equipo configurado.', 'warning');
      return;
    }

    const plannedSchedule = plannedScheduleIsoTriplet(
      this.plannedDepartureDateTime(),
      this.plannedArrivalDateTime(),
      this.plannedCompletionDateTime(),
    );
    if (!plannedSchedule) {
      this.toast.show(
        'Completa salida, llegada cliente y llegada / fin en orden cronológico.',
        'warning',
      );
      return;
    }

    const liters = this.parseRequiredNonNegativeNumber(this.dieselLiters(), 'Diesel (litros)');
    if (liters === null) {
      return;
    }
    const dieselAmt = this.parseRequiredNonNegativeNumber(this.dieselAmount(), 'Diesel (monto)');
    if (dieselAmt === null) {
      return;
    }
    const casetas = this.parseRequiredNonNegativeNumber(this.casetasAmount(), 'Casetas');
    if (casetas === null) {
      return;
    }
    const opQuota = this.parseRequiredNonNegativeNumber(this.operatorQuota(), 'Operador');
    if (opQuota === null) {
      return;
    }
    const viaticos = this.parseOptionalNonNegativeNumber(this.perDiemAmount(), 'Viáticos');
    if (viaticos === null) {
      return;
    }

    let cobro = 0;
    if (includeBilling) {
      const parsed = this.parseRequiredNonNegativeNumber(this.clientCharge(), 'Cobro');
      if (parsed === null) {
        return;
      }
      cobro = parsed;
    }

    const op = config;
    const equipmentLabels = this.usesMultipleEquipmentOperation()
        ? [this.labelForEquipmentId(eq1), this.labelForEquipmentId(eq2)]
        : [this.labelForEquipmentId(eq1)];

    const oCpDigits = normalizeMxPostalCodeDigits(this.originCp());
    const dCpDigits = normalizeMxPostalCodeDigits(this.destinationCp());
    const kmSnap = this.routeKm();
    const maneuverKindSnap = maneuverKindFromRouteKm(kmSnap);
    const opSnap = this.assignedOperator();
    const licNum = opSnap?.licenseNumber?.trim() ?? '';
    const licExp = this.operatorLicenseExpiresReadonly().trim();

    const equipmentIds = this.usesMultipleEquipmentOperation()
        ? [eq1, eq2].map((id) => id.trim()).filter(Boolean)
        : [eq1.trim()].filter(Boolean);

    const payload: CreateTripPayload = {
      origin,
      destination,
      operationType: op.trim(),
      loadType: this.loadType(),
      containerType: this.containerType(),
      cargoDescription: this.cargoDescription().trim(),
      approximateWeightTons: this.approximateWeightTons().trim(),
      dieselLiters: String(liters),
      dieselAmount: String(dieselAmt),
      ...(this.dieselControlEnabled() && this.dieselPricePerLiter() != null
        ? { dieselPricePerLiterAtCreation: this.dieselPricePerLiter()! }
        : {}),
      casetasAmount: String(casetas),
      operatorQuota: String(opQuota),
      ...(viaticos > 0 ? { perDiemAmount: String(viaticos) } : {}),
      clientCharge: String(cobro),
      creditDays: includeBilling ? this.parseCreditDays(this.creditDays()) : 0,
      requiresInvoice: includeBilling ? this.requiresInvoice() : false,
      paymentMethod: includeBilling
        ? this.normalizePaymentMethod(this.paymentMethod())
        : 'cash',
      operatorId: oprId,
      unitId: uid,
      clientName: client,
      clientId: includeBilling
        ? this.clientId().trim() || undefined
        : undefined,
      equipment: equipmentLabels,
      equipmentIds,
      plannedDepartureAt: plannedSchedule.plannedDepartureAt,
      plannedArrivalAt: plannedSchedule.plannedArrivalAt,
      plannedCompletionAt: plannedSchedule.plannedCompletionAt,
      attachedDocumentFileNames: this.attachedFiles().map((f) => f.name),
      routeDistanceKm: kmSnap,
      isRoundTrip: true,
      maneuverKind: maneuverKindSnap,
      originPostalCode: oCpDigits.length === 5 ? oCpDigits : undefined,
      originCityMunicipality: cityMunicipalityLineFromSettlement(oS),
      originLocality: formatSettlementOptionLabel(oS),
      destinationPostalCode: dCpDigits.length === 5 ? dCpDigits : undefined,
      destinationCityMunicipality: cityMunicipalityLineFromSettlement(dS),
      destinationLocality: formatSettlementOptionLabel(dS),
      operatorLicenseNumber: licNum !== '' ? licNum : undefined,
      operatorLicenseExpiresLabel: licExp !== '' ? licExp : undefined,
      ...(this.casetasAssistAuto()
        ? { tollCalculationMode: 'auto' as const }
        : { tollCalculationMode: 'manual' as const }),
      ...(this.matchedDestinationRateId()
        ? { destinationRateId: this.matchedDestinationRateId()! }
        : {}),
      ...(() => {
        const centerId = this.originOperationalCenterId().trim();
        if (!centerId || isOperationalCenterNewRoute(centerId)) {
          return {};
        }
        return { originOperationalCenterId: centerId };
      })(),
    };
    if (this.plannedCompletionIsInPast(plannedSchedule.plannedCompletionAt)) {
      this.pendingCreatePayload = payload;
      this.pastCompletionConfirmOpen.set(true);
      return;
    }

    this.runCreateTrip(payload);
  }

  /** El fin de maniobra planeado ya ocurrió → se registrará como completada. */
  private plannedCompletionIsInPast(plannedCompletionAt: string): boolean {
    const t = Date.parse(plannedCompletionAt);
    return Number.isFinite(t) && t < Date.now();
  }

  confirmPastCompletionCreate(): void {
    const payload = this.pendingCreatePayload;
    if (!payload) {
      this.pastCompletionConfirmOpen.set(false);
      return;
    }
    this.pastCompletionConfirmOpen.set(false);
    this.pendingCreatePayload = null;
    this.runCreateTrip(payload);
  }

  cancelPastCompletionCreate(): void {
    this.pastCompletionConfirmOpen.set(false);
    this.pendingCreatePayload = null;
  }

  private runCreateTrip(payload: CreateTripPayload): void {
    this.creating.set(true);
    this.tripsFeature
      .createTrip(payload)
      .pipe(
        finalize(() => this.creating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (trip) => this.saved.emit(trip),
        error: () => this.toast.show('No se pudo guardar la maniobra.', 'error'),
      });
  }

  private applyDestinationRateSuggestion(
    rate: DestinationRate,
    operationType: string,
    includeBilling: boolean,
  ): void {
    if (!this.autoRecognitionEnabled()) {
      return;
    }
    const opPay = suggestedOperatorPaymentFromDestinationRate(rate, operationType);
    const toll = suggestedEstimatedTollFromDestinationRate(rate, operationType);

    this.applyingDestinationRateSuggestion = true;

    if (opPay != null) {
      const formatted = formatFuelEstimateMoney(opPay);
      this.operatorQuota.set(formatted);
      this.lastAutoOperatorQuota = formatted;
      this.operatorQuotaSuggestionUi.set('auto');
    }

    if (includeBilling) {
      const charge = suggestedClientChargeFromDestinationRate(rate, operationType);
      const formatted = formatFuelEstimateMoney(charge);
      this.clientCharge.set(formatted);
      this.lastAutoClientCharge = formatted;
      this.clientChargeSuggestionUi.set('auto');
    } else {
      this.clientChargeSuggestionUi.set('none');
    }

    if (toll != null) {
      const formatted = formatFuelEstimateMoney(toll);
      this.casetasAmount.set(formatted);
      this.lastAutoCasetasAmount = formatted;
      this.casetasSuggestionUi.set('auto');
    }

    if (destinationRateHasRouteCache(rate)) {
      this.routeKm.set(rate.routeDistanceKm ?? null);
      this.routeFailed.set(false);
      this.routeLoading.set(false);
      this.routeCacheActive.set(true);
    }

    this.applyingDestinationRateSuggestion = false;
  }

  private markDestinationRateManualOverrideIfEdited(): void {
    if (this.applyingDestinationRateSuggestion) {
      return;
    }
    const op = stripGroupedNumberInput(this.operatorQuota());
    const charge = stripGroupedNumberInput(this.clientCharge());
    const casetas = stripGroupedNumberInput(this.casetasAmount());
    const autoOp = stripGroupedNumberInput(this.lastAutoOperatorQuota);
    const autoCharge = stripGroupedNumberInput(this.lastAutoClientCharge);
    const autoCasetas = stripGroupedNumberInput(this.lastAutoCasetasAmount);
    let locked = false;

    if (autoOp !== '' && op !== '' && op !== autoOp) {
      this.operatorQuotaSuggestionUi.set('manual');
      locked = true;
    }
    if (autoCharge !== '' && charge !== '' && charge !== autoCharge) {
      this.clientChargeSuggestionUi.set('manual');
      locked = true;
    }
    if (autoCasetas !== '' && casetas !== '' && casetas !== autoCasetas) {
      this.casetasSuggestionUi.set('manual');
      locked = true;
    }
    if (locked) {
      this.destinationRateSuggestionLocked.set(true);
    }
  }

  private clearDestinationRateSuggestionUi(): void {
    this.operatorQuotaSuggestionUi.set('none');
    this.clientChargeSuggestionUi.set('none');
    this.casetasSuggestionUi.set('none');
    if (this.lastAutoClientCharge !== '') {
      this.clientCharge.set('');
    }
    this.lastAutoOperatorQuota = '';
    this.lastAutoClientCharge = '';
    this.lastAutoCasetasAmount = '';
  }

  private resetPlannedScheduleSuggestionForContextChange(): void {
    this.plannedScheduleSuggestionUi.set('none');
    this.lastAutoPlannedArrival = '';
    this.lastAutoPlannedCompletion = '';
    this.applyingPlannedScheduleSuggestion = true;
    this.plannedArrivalDateTime.set('');
    this.plannedCompletionDateTime.set('');
    this.applyingPlannedScheduleSuggestion = false;
  }

  private clearPlannedScheduleAutoFields(): void {
    this.plannedScheduleSuggestionUi.set('none');
    this.lastAutoPlannedArrival = '';
    this.lastAutoPlannedCompletion = '';
    this.applyingPlannedScheduleSuggestion = true;
    this.plannedArrivalDateTime.set('');
    this.plannedCompletionDateTime.set('');
    this.applyingPlannedScheduleSuggestion = false;
  }

  private tryApplyPlannedScheduleFromMatchedRate(rate?: DestinationRate): void {
    if (!this.autoRecognitionEnabled()) {
      return;
    }
    if (this.plannedScheduleSuggestionUi() === 'manual') {
      return;
    }
    const departure = this.plannedDepartureDateTime().trim();
    if (!departure || !dateTimeLocalValueToIso(departure)) {
      return;
    }
    const matched =
      rate ??
      this.destinationRatesFeature
        .rates()
        .find((r) => r.id === this.matchedDestinationRateId());
    if (!matched || !destinationRateHasEstimatedTime(matched)) {
      return;
    }
    const suggested = computePlannedScheduleSuggestionFromRate(departure, matched);
    if (!suggested) {
      return;
    }
    this.applyingPlannedScheduleSuggestion = true;
    this.plannedArrivalDateTime.set(suggested.arrivalLocal);
    this.plannedCompletionDateTime.set(suggested.completionLocal);
    this.lastAutoPlannedArrival = suggested.arrivalLocal;
    this.lastAutoPlannedCompletion = suggested.completionLocal;
    this.plannedScheduleSuggestionUi.set('auto');
    this.applyingPlannedScheduleSuggestion = false;
  }

  private markPlannedScheduleManualOverrideIfEdited(): void {
    if (this.applyingPlannedScheduleSuggestion) {
      return;
    }
    const arrival = this.plannedArrivalDateTime().trim();
    const completion = this.plannedCompletionDateTime().trim();
    if (
      (this.lastAutoPlannedArrival !== '' &&
        arrival !== '' &&
        arrival !== this.lastAutoPlannedArrival) ||
      (this.lastAutoPlannedCompletion !== '' &&
        completion !== '' &&
        completion !== this.lastAutoPlannedCompletion)
    ) {
      this.plannedScheduleSuggestionUi.set('manual');
    }
  }

  dieselDerivedState(field: 'liters' | 'amount'): 'none' | 'pending' | 'ready' {
    if (!this.dieselControlEnabled()) {
      return 'none';
    }
    if (this.dieselAssistAuto(field)) {
      return 'ready';
    }
    return 'pending';
  }

  dieselAssistAuto(field: 'liters' | 'amount'): boolean {
    if (!this.dieselControlEnabled()) {
      return false;
    }
    const current = stripGroupedNumberInput(
      field === 'liters' ? this.dieselLiters() : this.dieselAmount(),
    );
    const auto = stripGroupedNumberInput(
      field === 'liters' ? this.lastAutoDieselLiters : this.lastAutoDieselAmount,
    );
    return auto !== '' && current === auto;
  }

  casetasAssistAuto(): boolean {
    return this.casetasSuggestionUi() === 'auto';
  }

  operatorAssistAuto(): boolean {
    return this.operatorQuotaSuggestionUi() === 'auto';
  }

  /** Limpia estado automático de diesel; no borra valores que el usuario capturó a mano. */
  private resetFuelEstimateAutoState(): void {
    this.dieselEstimateLoading.set(false);
    this.operationalDistanceKmFromApi.set(null);
    this.lastFuelEstimateInputFp = '';
    this.lastAutoDieselLiters = '';
    this.lastAutoDieselAmount = '';
    this.lastAutoDieselPricePerLiter = null;
  }
}
