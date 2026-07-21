import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { SessionService } from '@core/services/state/session';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { ToastService } from '@core/notifications/toast.service';
import { ExpensesService } from '@services/api/expenses';
import { EquipmentService } from '@services/api/equipment';
import { OperatorsService } from '@services/api/operators';
import {
  tripBitacoraEntriesSorted,
  tripIncidentPostedBy,
} from '@features/trips/utils/trip-incidents';
import {
  seedActualScheduleDrafts,
  validateActualScheduleBeforeSave,
  isActualScheduleFieldEditable,
  arrivalIsoForCompletionValidation,
  type ActualScheduleDrafts,
  type ActualScheduleFieldKey,
} from '@features/trips/utils/actual-schedule-edit';
import {
  dateTimeLocalValueToIso,
  isoToDateTimeLocalValue,
} from '@features/trips/utils/datetime-local';
import { TripLoadPlacesFeatureService } from '@features/trips/services/trip-load-places.service';
import { tripCargoDescriptionDisplay } from '@features/trips/utils/trip-cargo-description';
import {
  buildManiobraSettlementSummary,
  formatSettlementMxn,
} from '@features/trips/utils/maniobra-settlement';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';
import { OperationConfigurationResolverService } from '@shared/services/operation-configuration-resolver.service';
import {
  snapshotTextOrDash,
  storedOperationalDistanceKmLabel,
  storedRouteDistanceKmLabel,
} from '@features/trips/utils/maniobra-route-display';
import { operatorLicenseExpiresLabelFromIso } from '@features/trips/utils/operator-license-display';
import {
  formatTripEndpointFromParts,
  tripOperatorDisplayName,
  tripEquipmentDisplayAt,
} from '@features/trips/utils/trip-display-labels';
import {
  derivedDieselPricePerLiter,
  tripOperationalKm,
} from '@features/trips/utils/trip-operational-km';
import { tripManeuverPaymentMethodLabel } from '@shared/catalogs/trip-client-payment-options';
import { tripContainerTypeLabelMx } from '@shared/catalogs/trip-container-type-options';
import { OperationalCentersFeatureService } from '@features/clients/services/operational-centers.service';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { formatDestinationRateRouteSummary } from '@features/clients/utils/destination-rate-payload';
import {
  Expense,
  Equipment,
  Operator,
  Trip,
  TripContainerType,
  TripIncident,
  TripLoadType,
} from '@shared/models/logistics.models';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import { type ToSegmentTab } from '@shared/ui/to-segment-control/to-segment-control.component';
import { TripsFeatureService } from '@features/trips/services/trips.service';
import { parseHttpApiErrorMessage } from '@shared/utils/http-api-error';
import { isAdminRole } from '@shared/utils/access-control';
import { resourceIdsEqual } from '@shared/utils/resource-id';

export type TripsDetailTab = 'maneuver' | 'tracking' | 'settlement';

/** Pestaña inicial al abrir el detalle. */
function defaultDetailTabForTrip(trip: Trip): TripsDetailTab {
  if (trip.status === 'in_transit') {
    return 'tracking';
  }
  if (trip.status === 'completed') {
    return 'settlement';
  }
  return 'maneuver';
}

@Injectable()
export class TripsDetailDrawerFacade {
  private readonly dateShort = inject(DateShortPipe);
  private readonly tripsFeature = inject(TripsFeatureService);
  private readonly opResolver = inject(OperationConfigurationResolverService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  private readonly expensesApi = inject(ExpensesService);
  private readonly equipmentApi = inject(EquipmentService);
  private readonly operatorsApi = inject(OperatorsService);
  private readonly centersFeature = inject(OperationalCentersFeatureService);
  private readonly destinationRatesFeature = inject(DestinationRatesFeatureService);
  readonly loadPlacesCatalog = inject(TripLoadPlacesFeatureService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly equipmentCatalog = signal<readonly Equipment[]>([]);
  private equipmentCatalogLoadStarted = false;
  private readonly liveOperator = signal<Operator | null>(null);

  private dismissCallback: (() => void) | null = null;
  private closeCancelDialogCallback: (() => void) | null = null;

  readonly trip = computed(() => this.tripsFeature.selectedTrip()!);
  readonly operatorName = computed(() => tripOperatorDisplayName(this.trip()));
  readonly operatorLicenseNumberDisplay = computed(() =>
    snapshotTextOrDash(this.liveOperator()?.licenseNumber),
  );
  readonly operatorLicenseExpiresDisplay = computed(() => {
    const iso = this.liveOperator()?.licenseExpiresOn?.trim() ?? '';
    return snapshotTextOrDash(iso ? operatorLicenseExpiresLabelFromIso(iso) : '');
  });
  readonly originEndpointDisplay = computed(() =>
    formatTripEndpointFromParts(this.trip(), 'origin'),
  );
  readonly destinationEndpointDisplay = computed(() =>
    formatTripEndpointFromParts(this.trip(), 'destination'),
  );
  readonly canWriteTrips = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.TRIPS),
  );
  readonly canPostTripBitacora = computed(() => this.session.canPostTripBitacora());
  readonly canMarkTripIncident = computed(() => this.session.canMarkTripIncident());

  readonly drawerLoading = signal(false);
  readonly expensesForSettlement = signal<readonly Expense[]>([]);

  readonly bitacoraDraft = signal('');
  readonly markAsIncidentDraft = signal(false);
  readonly bitacoraSaving = signal(false);
  readonly collectSaving = signal(false);
  readonly cancelSubmitting = signal(false);
  readonly deleteConfirmOpen = signal(false);
  readonly deleteInTransitAck = signal(false);
  readonly deleteSubmitting = signal(false);
  readonly realDatesEditEnabled = signal(false);
  readonly realDepartureDraft = signal('');
  readonly realArrivalDraft = signal('');
  readonly realCompletionDraft = signal('');
  readonly justificationDraft = signal('');
  readonly realDatesSaving = signal(false);
  readonly emptyDeliveryFormOpen = signal(false);
  readonly emptyDeliveryAtDraft = signal('');
  readonly emptyDeliveryPlaceDraft = signal('');
  readonly emptyDeliveryJustificationDraft = signal('');
  readonly emptyDeliverySaving = signal(false);
  readonly loadDateDraft = signal('');
  readonly loadPlaceDraft = signal('');
  readonly detailTab = signal<TripsDetailTab>('maneuver');
  // Lectura nullable: estos computed corren desde effects que pueden evaluarse
  // justo después de limpiar la selección (p. ej. al eliminar la maniobra).
  readonly showsSettlementTab = computed(
    () => this.tripsFeature.selectedTrip()?.status === 'completed',
  );
  readonly canDeleteManiobra = computed(() => isAdminRole(this.session.role()));
  readonly deleteRequiresInTransitAck = computed(
    () => this.tripsFeature.selectedTrip()?.status === 'in_transit',
  );
  readonly canConfirmDeleteManiobra = computed(
    () =>
      !this.deleteRequiresInTransitAck() || this.deleteInTransitAck(),
  );
  readonly detailSegmentTabs = computed((): readonly ToSegmentTab<TripsDetailTab>[] => {
    const tabs: ToSegmentTab<TripsDetailTab>[] = [
      {
        id: 'maneuver',
        label: 'Maniobra',
        icon: 'route',
        htmlId: 'maniobra-detail-tab-maneuver',
      },
      {
        id: 'tracking',
        label: 'Seguimiento',
        icon: 'tracking',
        htmlId: 'maniobra-detail-tab-tracking',
      },
    ];
    if (this.showsSettlementTab()) {
      tabs.push({
        id: 'settlement',
        label: 'Liquidación',
        icon: 'settlement',
        htmlId: 'maniobra-detail-tab-settlement',
      });
    }
    return tabs;
  });
  readonly settlementSummary = computed(() =>
    buildManiobraSettlementSummary(this.trip(), this.expensesForSettlement()),
  );
  /** Programada: fechas planeadas/carga. En curso: únicamente fechas reales. */
  readonly canEditRealDates = computed(() => {
    const status = this.tripsFeature.selectedTrip()?.status;
    return (
      this.canWriteTrips() &&
      (status === 'scheduled' || status === 'in_transit')
    );
  });
  /**
   * Entrega de vacío: solo maniobras en curso o completadas y
   * con contenedor de por medio (tipo de contenedor distinto de «No aplica»).
   */
  readonly canRegisterEmptyDelivery = computed(() => {
    const trip = this.tripsFeature.selectedTrip();
    const status = trip?.status;
    const containerType = trip?.containerType
      ?.trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const noContainer =
      !containerType ||
      containerType === 'na' ||
      containerType === 'n/a' ||
      containerType === 'no aplica';
    return (
      this.canWriteTrips() &&
      !noContainer &&
      (status === 'in_transit' || status === 'completed')
    );
  });
  readonly realScheduleDrafts = computed(
    (): ActualScheduleDrafts => ({
      departureAt: this.realDepartureDraft(),
      arrivedAt: this.realArrivalDraft(),
      returnAt: this.realCompletionDraft(),
    }),
  );
  readonly cancelKind = signal<'operative' | 'false'>('operative');
  readonly cancelNoteDraft = signal('');

  private detailTabTripId: string | undefined;

  constructor() {
    effect(() => {
      const id = this.tripsFeature.selectedTripId();
      const trip = this.tripsFeature.selectedTrip();
      this.drawerLoading.set(Boolean(id && !trip));
    });

    effect(() => {
      const t = this.tripsFeature.selectedTrip();
      if (!t) {
        return;
      }
      if (t.id !== this.detailTabTripId) {
        this.detailTabTripId = t.id;
        this.detailTab.set(defaultDetailTabForTrip(t));
        this.closeEmptyDeliveryForm();
      }
      this.ensureEquipmentCatalogLoaded();
      this.centersFeature.loadOperationalCenters();
      this.destinationRatesFeature.loadDestinationRates();
    });

    effect((onCleanup) => {
      const t = this.tripsFeature.selectedTrip();
      const operatorId = t?.operatorId?.trim();
      if (!operatorId) {
        this.liveOperator.set(null);
        return;
      }
      const current = this.liveOperator();
      if (current && resourceIdsEqual(current.id, operatorId)) {
        return;
      }
      this.liveOperator.set(null);
      const sub = this.operatorsApi
        .getOperatorById(operatorId)
        .pipe(catchError(() => of(null)))
        .subscribe((op) => this.liveOperator.set(op));
      onCleanup(() => sub.unsubscribe());
    });

    effect((onCleanup) => {
      const tab = this.detailTab();
      const t = this.tripsFeature.selectedTrip();
      if (tab !== 'settlement' || !this.showsSettlementTab() || !t) {
        this.expensesForSettlement.set([]);
        return;
      }
      const sub = this.expensesApi
        .getAllExpenses({ tripId: t.id })
        .pipe(catchError(() => of([] as Expense[])))
        .subscribe((rows) => this.expensesForSettlement.set(rows));
      onCleanup(() => sub.unsubscribe());
    });

    effect(() => {
      if (!this.showsSettlementTab() && this.detailTab() === 'settlement') {
        this.detailTab.set('maneuver');
      }
    });

    effect(() => {
      const t = this.tripsFeature.selectedTrip();
      if (!t) {
        return;
      }
      if (
        t.status !== 'scheduled' &&
        t.status !== 'in_transit' &&
        this.realDatesEditEnabled()
      ) {
        this.resetRealScheduleEdit();
      }
    });
  }

  bindDismiss(callback: () => void): void {
    this.dismissCallback = callback;
  }

  bindCloseCancelDialog(callback: () => void): void {
    this.closeCancelDialogCallback = callback;
  }

  markReady(): void {
    if (this.tripsFeature.selectedTrip()) {
      this.drawerLoading.set(false);
    }
  }

  requestDismiss(): void {
    this.dismissCallback?.();
  }

  selectDetailTab(tab: TripsDetailTab): void {
    this.detailTab.set(tab);
  }

  canCancelManiobra(): boolean {
    if (!this.canWriteTrips()) {
      return false;
    }
    const s = this.trip().status;
    return s === 'scheduled' || s === 'in_transit';
  }

  openDeleteConfirm(): void {
    this.deleteInTransitAck.set(false);
    this.deleteConfirmOpen.set(true);
  }

  closeDeleteConfirm(): void {
    if (this.deleteSubmitting()) {
      return;
    }
    this.deleteConfirmOpen.set(false);
    this.deleteInTransitAck.set(false);
  }

  onDeleteInTransitAckChange(ev: Event): void {
    this.deleteInTransitAck.set((ev.target as HTMLInputElement).checked);
  }

  confirmDeleteManiobra(): void {
    if (!this.canConfirmDeleteManiobra()) {
      return;
    }
    this.deleteSubmitting.set(true);
    const code = this.trip().maneuverCode;
    this.tripsFeature
      .deleteTrip(this.trip().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleteSubmitting.set(false);
          this.deleteConfirmOpen.set(false);
          this.deleteInTransitAck.set(false);
          this.toast.show(`Maniobra ${code} eliminada del sistema.`, 'success');
          this.requestDismiss();
        },
        error: (err: unknown) => {
          this.deleteSubmitting.set(false);
          const detail = parseHttpApiErrorMessage(err)?.trim() ?? '';
          this.toast.show(
            detail || 'No se pudo eliminar la maniobra. Inténtalo de nuevo.',
            'error',
          );
        },
      });
  }

  prepareCancelDialog(): void {
    this.cancelKind.set('operative');
    this.cancelNoteDraft.set('');
  }

  resetCancelModalForm(): void {
    this.cancelSubmitting.set(false);
    this.cancelKind.set('operative');
    this.cancelNoteDraft.set('');
  }

  onCancelNoteInput(ev: Event): void {
    this.cancelNoteDraft.set((ev.target as HTMLTextAreaElement).value);
  }

  confirmCancelManiobra(): void {
    const falseM = this.cancelKind() === 'false';
    const note = this.cancelNoteDraft().trim();
    if (falseM && note === '') {
      this.toast.show(
        'Describe brevemente el motivo para registrar una maniobra en falso.',
        'warning',
      );
      return;
    }
    this.cancelSubmitting.set(true);
    this.tripsFeature
      .cancelTrip(this.trip().id, {
        falseManeuver: falseM,
        note: falseM ? note : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.cancelSubmitting.set(false);
          this.closeCancelDialogCallback?.();
          const enFalso = updated.falseManeuver === true;
          this.toast.show(
            enFalso
              ? `Maniobra ${updated.maneuverCode} registrada en falso (se mantiene el cobro).`
              : `Maniobra ${updated.maneuverCode} cancelada correctamente.`,
            'success',
          );
          this.requestDismiss();
        },
        error: (err: unknown) => {
          this.cancelSubmitting.set(false);
          const detail = parseHttpApiErrorMessage(err)?.trim() ?? '';
          this.toast.show(
            detail || 'No se pudo cancelar la maniobra. Inténtalo de nuevo.',
            'error',
          );
        },
      });
  }

  cancellationNoteDisplay(): string {
    const n = this.trip().cancellationNote?.trim();
    return n ?? '';
  }

  fmt(iso: string | null | undefined): string {
    return this.dateShort.transform(iso ?? undefined);
  }

  showRealScheduleField(field: ActualScheduleFieldKey): boolean {
    const t = this.trip();
    if (t.status === 'scheduled') {
      return false;
    }
    const persisted = Boolean(t[field]?.trim());
    if (!persisted) {
      return false;
    }
    if (!this.realDatesEditEnabled()) {
      return true;
    }
    return !isActualScheduleFieldEditable(t.status, field);
  }

  canEditRealScheduleField(field: ActualScheduleFieldKey): boolean {
    return (
      this.realDatesEditEnabled() &&
      // Programada: aún no hay fechas reales; se editan las planeadas.
      !this.editingPlannedDates() &&
      isActualScheduleFieldEditable(this.trip().status, field)
    );
  }

  realCompletionMinLocal(): string | undefined {
    const trip = this.trip();
    const arrIso = arrivalIsoForCompletionValidation(trip, this.realScheduleDrafts());
    const local = isoToDateTimeLocalValue(arrIso);
    return local || undefined;
  }

  editingPlannedDates(): boolean {
    return this.trip().status === 'scheduled';
  }

  datesEditLabel(): string {
    return this.editingPlannedDates() ? 'Editar fechas' : 'Editar fechas reales';
  }

  resetRealScheduleEdit(): void {
    this.realDatesEditEnabled.set(false);
    this.realDepartureDraft.set('');
    this.realArrivalDraft.set('');
    this.realCompletionDraft.set('');
    this.loadDateDraft.set('');
    this.loadPlaceDraft.set('');
    this.justificationDraft.set('');
  }

  toggleRealDatesEdit(): void {
    if (!this.canEditRealDates() || this.realDatesSaving()) {
      return;
    }
    const next = !this.realDatesEditEnabled();
    this.realDatesEditEnabled.set(next);
    if (next) {
      this.closeEmptyDeliveryForm();
      const trip = this.trip();
      if (trip.status === 'scheduled') {
        this.realDepartureDraft.set(
          isoToDateTimeLocalValue(trip.plannedDepartureAt),
        );
        this.realArrivalDraft.set(
          isoToDateTimeLocalValue(trip.plannedArrivalAt),
        );
        this.realCompletionDraft.set(
          isoToDateTimeLocalValue(trip.plannedCompletionAt),
        );
        this.loadDateDraft.set(isoToDateTimeLocalValue(trip.loadDate));
        this.loadPlaceDraft.set(trip.loadPlace?.trim() ?? '');
        this.loadPlacesCatalog.ensureLoaded();
      } else {
        const seeded = seedActualScheduleDrafts(trip);
        this.realDepartureDraft.set(seeded.departureAt);
        this.realArrivalDraft.set(seeded.arrivedAt);
        this.realCompletionDraft.set(seeded.returnAt);
      }
      this.justificationDraft.set('');
      return;
    }
    this.resetRealScheduleEdit();
  }

  onJustificationDraftInput(ev: Event): void {
    this.justificationDraft.set((ev.target as HTMLTextAreaElement).value);
  }

  saveRealSchedule(): void {
    if (!this.canEditRealDates() || this.realDatesSaving() || !this.realDatesEditEnabled()) {
      return;
    }

    if (this.editingPlannedDates()) {
      this.savePlannedDates();
      return;
    }

    const result = validateActualScheduleBeforeSave(
      this.trip(),
      this.realScheduleDrafts(),
      this.justificationDraft(),
    );

    if ('error' in result) {
      if (result.error === 'no_changes') {
        this.toast.show('No hay cambios en fechas reales para guardar.', 'info');
        return;
      }
      this.toast.show(result.error, 'warning');
      return;
    }

    this.realDatesSaving.set(true);
    this.tripsFeature
      .updateActualSchedule(this.trip().id, result.payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.realDatesSaving.set(false);
          this.resetRealScheduleEdit();
          this.toast.show('Cronograma real actualizado.', 'success');
        },
        error: (err: unknown) => {
          this.realDatesSaving.set(false);
          const detail =
            err instanceof Error
              ? err.message.trim()
              : typeof err === 'string'
                ? err.trim()
                : '';
          this.toast.show(
            detail || 'No se pudo actualizar el cronograma real. Inténtalo de nuevo.',
            'error',
          );
        },
      });
  }

  private savePlannedDates(): void {
    const departureIso = dateTimeLocalValueToIso(this.realDepartureDraft());
    const arrivalIso = dateTimeLocalValueToIso(this.realArrivalDraft());
    const completionIso = dateTimeLocalValueToIso(this.realCompletionDraft());
    if (!departureIso || !arrivalIso || !completionIso) {
      this.toast.show('Captura todas las fechas planeadas.', 'warning');
      return;
    }
    if (
      new Date(arrivalIso).getTime() < new Date(departureIso).getTime() ||
      new Date(completionIso).getTime() < new Date(arrivalIso).getTime()
    ) {
      this.toast.show(
        'Las fechas deben respetar el orden: salida, llegada y fin.',
        'warning',
      );
      return;
    }

    const loadDateIso = dateTimeLocalValueToIso(this.loadDateDraft());
    const place = this.loadPlaceDraft().trim();
    const justification = this.justificationDraft().trim();
    if (!justification) {
      this.toast.show(
        'La justificación es obligatoria al actualizar las fechas.',
        'warning',
      );
      return;
    }
    this.realDatesSaving.set(true);
    this.tripsFeature
      .updateLoadInfo(this.trip().id, {
        plannedDepartureAt: departureIso,
        plannedArrivalAt: arrivalIso,
        plannedCompletionAt: completionIso,
        ...(loadDateIso ? { loadDate: loadDateIso } : {}),
        ...(place ? { loadPlace: place } : {}),
        plannedDatesJustification: justification,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.realDatesSaving.set(false);
          if (place) {
            this.loadPlacesCatalog.registerLocalPlace(place);
          }
          this.resetRealScheduleEdit();
          this.toast.show('Fechas de la maniobra actualizadas.', 'success');
        },
        error: (err: unknown) => {
          this.realDatesSaving.set(false);
          this.toast.show(
            parseHttpApiErrorMessage(err) ||
              'No se pudieron actualizar las fechas. Inténtalo de nuevo.',
            'error',
          );
        },
      });
  }

  hasEmptyDelivery(): boolean {
    return Boolean(this.trip().emptyDeliveryAt?.trim());
  }

  /** Piso del datepicker: la mayor entre fin planeado y fin real. */
  emptyDeliveryMinLocal(): string | undefined {
    const iso = this.emptyDeliveryMinIso();
    const local = isoToDateTimeLocalValue(iso);
    return local || undefined;
  }

  openEmptyDeliveryForm(): void {
    if (!this.canRegisterEmptyDelivery() || this.emptyDeliverySaving()) {
      return;
    }
    const t = this.trip();
    this.emptyDeliveryAtDraft.set(isoToDateTimeLocalValue(t.emptyDeliveryAt));
    this.emptyDeliveryPlaceDraft.set(t.emptyDeliveryPlace?.trim() ?? '');
    this.emptyDeliveryJustificationDraft.set('');
    this.loadPlacesCatalog.ensureLoaded();
    this.emptyDeliveryFormOpen.set(true);
  }

  toggleEmptyDeliveryForm(): void {
    if (this.emptyDeliveryFormOpen()) {
      this.closeEmptyDeliveryForm();
      return;
    }
    this.openEmptyDeliveryForm();
  }

  emptyDeliveryToggleLabel(): string {
    return this.hasEmptyDelivery()
      ? 'Editar entrega de vacío'
      : 'Agregar entrega de vacío';
  }

  onEmptyDeliveryJustificationInput(ev: Event): void {
    this.emptyDeliveryJustificationDraft.set(
      (ev.target as HTMLTextAreaElement).value,
    );
  }

  closeEmptyDeliveryForm(): void {
    this.emptyDeliveryFormOpen.set(false);
    this.emptyDeliveryAtDraft.set('');
    this.emptyDeliveryPlaceDraft.set('');
    this.emptyDeliveryJustificationDraft.set('');
  }

  saveEmptyDelivery(): void {
    if (
      !this.canRegisterEmptyDelivery() ||
      this.emptyDeliverySaving() ||
      !this.emptyDeliveryFormOpen()
    ) {
      return;
    }
    const iso = dateTimeLocalValueToIso(this.emptyDeliveryAtDraft());
    if (!iso) {
      this.toast.show('Captura la fecha de entrega de vacío.', 'warning');
      return;
    }
    const place = this.emptyDeliveryPlaceDraft().trim();
    if (!place) {
      this.toast.show('Captura el lugar de entrega de vacío.', 'warning');
      return;
    }
    const justification = this.emptyDeliveryJustificationDraft().trim();
    if (this.hasEmptyDelivery() && !justification) {
      this.toast.show(
        'La justificación es obligatoria al actualizar una entrega de vacío.',
        'warning',
      );
      return;
    }
    const minIso = this.emptyDeliveryMinIso();
    if (minIso && new Date(iso).getTime() < new Date(minIso).getTime()) {
      this.toast.show(
        'La entrega de vacío no puede ser anterior al fin planeado ni al fin real.',
        'warning',
      );
      return;
    }

    this.emptyDeliverySaving.set(true);
    this.tripsFeature
      .updateEmptyDelivery(this.trip().id, {
        emptyDeliveryAt: iso,
        emptyDeliveryPlace: place,
        ...(justification
          ? { emptyDeliveryJustification: justification }
          : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.emptyDeliverySaving.set(false);
          this.loadPlacesCatalog.registerLocalPlace(place);
          this.closeEmptyDeliveryForm();
          this.toast.show('Entrega de vacío registrada.', 'success');
        },
        error: (err: unknown) => {
          this.emptyDeliverySaving.set(false);
          this.toast.show(
            parseHttpApiErrorMessage(err) ||
              'No se pudo registrar la entrega de vacío. Inténtalo de nuevo.',
            'error',
          );
        },
      });
  }

  private emptyDeliveryMinIso(): string | null {
    const t = this.trip();
    const candidates = [t.plannedCompletionAt, t.returnAt]
      .map((iso) => iso?.trim())
      .filter((iso): iso is string => Boolean(iso))
      .map((iso) => new Date(iso).getTime())
      .filter((ms) => Number.isFinite(ms));
    if (candidates.length === 0) {
      return null;
    }
    return new Date(Math.max(...candidates)).toISOString();
  }

  unitDisplay(): string {
    const t = this.trip();
    const code = t.unitOperationalCode?.trim() || t.unitId?.trim();
    return code || '—';
  }

  destinationRateDisplay(): string {
    const raw = this.trip().destinationRateId;
    if (raw == null || raw === '') {
      return '';
    }
    const id = String(raw).trim();
    const rate = this.destinationRatesFeature.rates().find((r) => r.id === id);
    if (rate) {
      const summary = formatDestinationRateRouteSummary(rate);
      const cp = rate.postalCode.trim();
      return cp ? `${summary} · CP ${cp}` : summary;
    }
    return `Tarifa ${id}`;
  }

  originOperationalCenterDisplay(): string {
    const t = this.trip();
    const id = t.originOperationalCenterId?.trim();
    if (!id) {
      return '';
    }
    const center = this.centersFeature.centerById(id);
    if (center) {
      const name = center.name?.trim();
      const code = center.code?.trim();
      if (name && code) {
        return `${name} (${code})`;
      }
      return name || code || id;
    }
    return id;
  }

  plannedScheduleDisplay(iso: string | null | undefined): string {
    const t = iso?.trim();
    return t ? this.fmt(t) : '—';
  }

  isFullTrip(): boolean {
    return this.opResolver.usesMultipleEquipment(
      this.opResolver.contextFromTrip(this.trip()),
    );
  }

  showsClientBillingBlock(): boolean {
    return this.trip().hasClientBilling !== false;
  }

  canMarkClientCollected(): boolean {
    const s = this.trip().status;
    return (
      this.canWriteTrips() &&
      this.showsClientBillingBlock() &&
      (s === 'completed' || s === 'cancelled')
    );
  }

  showsClientCollectionStatus(): boolean {
    const s = this.trip().status;
    return (
      this.showsClientBillingBlock() && (s === 'completed' || s === 'cancelled')
    );
  }

  clientCollected(): boolean {
    const at = this.trip().clientCollectedAt;
    return typeof at === 'string' && at.trim().length > 0;
  }

  clientCollectedAtLabel(): string {
    const at = this.trip().clientCollectedAt;
    return at ? this.fmt(at) : '';
  }

  toggleClientCollected(): void {
    if (!this.canMarkClientCollected() || this.collectSaving()) {
      return;
    }
    const next = !this.clientCollected();
    this.collectSaving.set(true);
    this.tripsFeature
      .setClientCollected(this.trip().id, next)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.collectSaving.set(false);
          this.toast.show(
            next
              ? `Cobro de ${updated.maneuverCode} confirmado; cuenta como ingreso en reportes.`
              : `Cobro de ${updated.maneuverCode} marcado como pendiente (crédito).`,
            'success',
          );
        },
        error: (err: unknown) => {
          this.collectSaving.set(false);
          const detail =
            err instanceof Error
              ? err.message.trim()
              : typeof err === 'string'
                ? err.trim()
                : '';
          this.toast.show(
            detail || 'No se pudo actualizar el estado de cobro.',
            'error',
          );
        },
      });
  }

  detailStatusPillClasses(): string {
    const t = this.trip();
    const base = 'to-table-pill maniobra-detail__status-pill';
    if (t.status === 'cancelled' && t.falseManeuver === true) {
      return `${base} to-table-pill--false-maneuver`;
    }
    switch (t.status) {
      case 'in_transit':
        return `${base} to-table-pill--course`;
      case 'completed':
        return `${base} to-table-pill--done`;
      case 'scheduled':
        return `${base} to-table-pill--delayed`;
      case 'cancelled':
        return `${base} to-table-pill--cancelled`;
      default:
        return `${base} to-table-pill--unknown`;
    }
  }

  detailStatusLabel(): string {
    const t = this.trip();
    return tripStatusUiLabel(t.status, {
      falseManeuver: t.falseManeuver === true,
    });
  }

  operationLabel(): string {
    return this.opResolver.resolveTripDisplay(this.trip()).label;
  }

  loadLabel(load: TripLoadType): string {
    return load === 'vacio' ? 'Vacío' : 'Lleno';
  }

  containerLabel(c: TripContainerType | string): string {
    return tripContainerTypeLabelMx(c);
  }

  routeDistanceDisplay(): string {
    return storedRouteDistanceKmLabel(this.trip().routeDistanceKm);
  }

  operationalDistanceDisplay(): string {
    return storedOperationalDistanceKmLabel(tripOperationalKm(this.trip()));
  }

  /** @deprecated Usar `routeDistanceDisplay` (solo ida). */
  distanceDisplay(): string {
    return this.routeDistanceDisplay();
  }

  routeSnapshotOrDash(value: string | undefined): string {
    return snapshotTextOrDash(value);
  }

  maneuverKindDisplay(): string {
    const k = this.trip().maneuverKind?.trim();
    return k ? k : '—';
  }

  weightDisplay(): string {
    const t = this.trip().approximateWeightTons?.trim() ?? '';
    return t.length > 0 ? `${t} Ton` : '—';
  }

  /** Precio diesel derivado de monto / litros. */
  dieselPriceAtCreationDisplay(): string {
    const n = derivedDieselPricePerLiter(this.trip());
    if (n == null || !Number.isFinite(n) || n <= 0) {
      return '';
    }
    return `${new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(n)} / L`;
  }

  cargoDescriptionDisplay(): string {
    return tripCargoDescriptionDisplay(this.trip().cargoDescription);
  }

  loadPlaceDisplay(): string {
    return tripCargoDescriptionDisplay(this.trip().loadPlace);
  }

  paymentLabel(method?: Trip['paymentMethod']): string {
    return tripManeuverPaymentMethodLabel(method);
  }

  displayGroupedNumber(raw: string | undefined): string {
    if (raw === undefined) {
      return '—';
    }
    const t = raw.replace(/\s/g, '').replace(/,/g, '').trim();
    if (t === '') {
      return '—';
    }
    const n = Number(t);
    if (!Number.isFinite(n)) {
      return raw.trim() || '—';
    }
    return new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(n);
  }

  displayMoney(raw: string | undefined): string {
    const s = this.displayGroupedNumber(raw);
    return s === '—' ? '—' : `$${s}`;
  }

  settlementMoney(amount: number): string {
    return formatSettlementMxn(amount);
  }

  settlementMarginPctLabel(): string {
    const pct = this.settlementSummary().marginPct;
    return pct == null ? '—' : `${pct}%`;
  }

  settlementLineDate(iso: string | null): string {
    return iso ? this.fmt(iso) : '—';
  }

  settlementPaymentBadgeClass(): string {
    const summary = this.settlementSummary();
    const base = 'maniobra-settlement__badge';
    switch (summary.paymentStatus) {
      case 'paid':
        return `${base} maniobra-settlement__badge--paid`;
      case 'credit_pending':
        switch (summary.creditDueUrgency) {
          case 'on_track':
            return `${base} maniobra-settlement__badge--credit-on-track`;
          case 'due_today':
            return `${base} maniobra-settlement__badge--credit-due-today`;
          case 'overdue':
            return `${base} maniobra-settlement__badge--credit-overdue`;
          default:
            return `${base} maniobra-settlement__badge--credit-due-today`;
        }
      case 'cash_pending':
        return `${base} maniobra-settlement__badge--pending`;
      default:
        return `${base} maniobra-settlement__badge--neutral`;
    }
  }

  litersDisplay(raw: string | undefined): string {
    const s = this.displayGroupedNumber(raw);
    return s === '—' ? '—' : `${s} L`;
  }

  invoiceLabel(): string {
    return this.trip().requiresInvoice === true ? 'Sí' : 'No';
  }

  creditDaysLabel(): string {
    const days = Math.max(0, this.trip().creditDays ?? 0);
    return `${days} días`;
  }

  equipmentAt(index: number): string {
    return tripEquipmentDisplayAt(this.trip(), index, this.equipmentCatalog());
  }

  private ensureEquipmentCatalogLoaded(): void {
    if (this.equipmentCatalogLoadStarted) {
      return;
    }
    this.equipmentCatalogLoadStarted = true;
    this.equipmentApi
      .getEquipmentList()
      .pipe(
        catchError(() => of([] as Equipment[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => this.equipmentCatalog.set(list));
  }

  bitacoraAuthorLabel(inc: TripIncident): string {
    return tripIncidentPostedBy(inc, []);
  }

  bitacoraSorted(): TripIncident[] {
    return tripBitacoraEntriesSorted(this.trip());
  }

  onBitacoraDraftInput(ev: Event): void {
    this.bitacoraDraft.set((ev.target as HTMLTextAreaElement).value);
  }

  onMarkAsIncidentDraftChange(ev: Event): void {
    this.markAsIncidentDraft.set((ev.target as HTMLInputElement).checked);
  }

  registerBitacoraEntry(): void {
    const text = this.bitacoraDraft().trim();
    if (!text) {
      this.toast.show('Escribe una nota antes de agregarla a la bitácora.', 'warning');
      return;
    }
    const postedBy = this.session.username()?.trim();
    if (!postedBy) {
      this.toast.show('Inicia sesión para registrar entradas en la bitácora.', 'warning');
      return;
    }
    const isIncident =
      this.canMarkTripIncident() && this.markAsIncidentDraft();
    this.bitacoraSaving.set(true);
    this.tripsFeature
      .postTripIncident(this.trip().id, text, postedBy, isIncident)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.bitacoraDraft.set('');
          this.markAsIncidentDraft.set(false);
          this.bitacoraSaving.set(false);
          this.toast.show(
            isIncident
              ? 'Incidente registrado en la bitácora.'
              : 'Entrada agregada a la bitácora.',
            'success',
          );
        },
        error: () => {
          this.bitacoraSaving.set(false);
          this.toast.show('No se pudo guardar la entrada. Inténtalo de nuevo.', 'error');
        },
      });
  }
}
