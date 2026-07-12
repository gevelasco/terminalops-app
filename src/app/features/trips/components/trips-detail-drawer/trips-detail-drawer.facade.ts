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
import { isoToDateTimeLocalValue } from '@features/trips/utils/datetime-local';
import { tripCargoDescriptionDisplay } from '@features/trips/utils/trip-cargo-description';
import {
  buildManiobraSettlementSummary,
  formatSettlementMxn,
} from '@features/trips/utils/maniobra-settlement';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';
import { OperationConfigurationResolverService } from '@shared/services/operation-configuration-resolver.service';
import { snapshotTextOrDash, storedOperationalDistanceKmLabel, storedRouteDistanceKmLabel } from '@features/trips/utils/maniobra-route-display';
import { tripOperatorDisplayName, tripEquipmentDisplayAt } from '@features/trips/utils/trip-display-labels';
import { tripManeuverPaymentMethodLabel } from '@shared/catalogs/trip-client-payment-options';
import { tripContainerTypeLabelMx } from '@shared/catalogs/trip-container-type-options';
import { OperationalCentersFeatureService } from '@features/clients/services/operational-centers.service';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { formatDestinationRateRouteSummary } from '@features/clients/utils/destination-rate-payload';
import {
  Expense,
  Equipment,
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
  private readonly centersFeature = inject(OperationalCentersFeatureService);
  private readonly destinationRatesFeature = inject(DestinationRatesFeatureService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly equipmentCatalog = signal<readonly Equipment[]>([]);
  private equipmentCatalogLoadStarted = false;

  private dismissCallback: (() => void) | null = null;
  private closeCancelDialogCallback: (() => void) | null = null;

  readonly trip = computed(() => this.tripsFeature.selectedTrip()!);
  readonly operatorName = computed(() => tripOperatorDisplayName(this.trip()));
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
  readonly detailTab = signal<TripsDetailTab>('maneuver');
  readonly showsSettlementTab = computed(() => this.trip().status === 'completed');
  readonly canDeleteManiobra = computed(() => isAdminRole(this.session.role()));
  readonly deleteRequiresInTransitAck = computed(
    () => this.trip().status === 'in_transit',
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
  readonly canEditRealDates = computed(
    () => this.canWriteTrips() && this.trip().status === 'in_transit',
  );
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
      }
      this.ensureEquipmentCatalogLoaded();
      this.centersFeature.loadOperationalCenters();
      this.destinationRatesFeature.loadDestinationRates();
    });

    effect((onCleanup) => {
      const tab = this.detailTab();
      const t = this.tripsFeature.selectedTrip();
      if (tab !== 'settlement' || !this.showsSettlementTab() || !t) {
        this.expensesForSettlement.set([]);
        return;
      }
      const sub = this.expensesApi
        .getExpensesPage({ tripId: t.id, limit: 0 })
        .pipe(
          map((response) => response.items),
          catchError(() => of([] as Expense[])),
        )
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
      if (t.status !== 'in_transit' && this.realDatesEditEnabled()) {
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
      isActualScheduleFieldEditable(this.trip().status, field)
    );
  }

  realCompletionMinLocal(): string | undefined {
    const trip = this.trip();
    const arrIso = arrivalIsoForCompletionValidation(trip, this.realScheduleDrafts());
    const local = isoToDateTimeLocalValue(arrIso);
    return local || undefined;
  }

  resetRealScheduleEdit(): void {
    this.realDatesEditEnabled.set(false);
    this.realDepartureDraft.set('');
    this.realArrivalDraft.set('');
    this.realCompletionDraft.set('');
    this.justificationDraft.set('');
  }

  toggleRealDatesEdit(): void {
    if (!this.canEditRealDates() || this.realDatesSaving()) {
      return;
    }
    const next = !this.realDatesEditEnabled();
    this.realDatesEditEnabled.set(next);
    if (next) {
      const seeded = seedActualScheduleDrafts(this.trip());
      this.realDepartureDraft.set(seeded.departureAt);
      this.realArrivalDraft.set(seeded.arrivedAt);
      this.realCompletionDraft.set(seeded.returnAt);
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

  unitDisplay(): string {
    const t = this.trip();
    const code =
      t.unitOperationalCodeSnapshot?.trim() ||
      t.unitOperationalCode?.trim() ||
      t.unitId?.trim();
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
    const snapName = t.originOperationalCenterNameSnapshot?.trim();
    const snapCode = t.originOperationalCenterCodeSnapshot?.trim();
    if (snapName) {
      return snapCode ? `${snapName} (${snapCode})` : snapName;
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

  tollCalculationModeLabel(): string {
    switch (this.trip().tollCalculationMode) {
      case 'auto':
        return 'Sugerido por tarifa';
      case 'manual':
        return 'Captura manual';
      default:
        return '';
    }
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
    return storedOperationalDistanceKmLabel(this.trip().operationalDistanceKm);
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

  /** Snapshot MXN/L al crear; no se recalcula si cambia el precio vigente. */
  dieselPriceAtCreationDisplay(): string {
    const raw = this.trip().dieselPricePerLiterAtCreation;
    if (raw == null) {
      return '';
    }
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
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
