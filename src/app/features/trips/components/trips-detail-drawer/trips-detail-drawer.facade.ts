import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { SessionService } from '@core/services/state/session';
import { ToastService } from '@core/notifications/toast.service';
import { ExpensesService } from '@services/api/expenses';
import { tripIncidentPostedBy } from '@features/trips/utils/trip-incidents';
import { tripCargoDescriptionDisplay } from '@features/trips/utils/trip-cargo-description';
import {
  buildManiobraSettlementSummary,
  formatSettlementMxn,
} from '@features/trips/utils/maniobra-settlement';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';
import { OperationConfigurationResolverService } from '@shared/services/operation-configuration-resolver.service';
import { snapshotTextOrDash, storedOperationalDistanceKmLabel, storedRouteDistanceKmLabel } from '@features/trips/utils/maniobra-route-display';
import { tripOperatorDisplayName } from '@features/trips/utils/trip-display-labels';
import {
  Expense,
  Trip,
  TripContainerType,
  TripIncident,
  TripLoadType,
} from '@shared/models/logistics.models';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import { type ToSegmentTab } from '@shared/ui/to-segment-control/to-segment-control.component';
import { TripsFeatureService } from '@features/trips/services/trips.service';

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
  private readonly destroyRef = inject(DestroyRef);

  private dismissCallback: (() => void) | null = null;
  private closeCancelDialogCallback: (() => void) | null = null;

  readonly trip = computed(() => this.tripsFeature.selectedTrip()!);
  readonly operatorName = computed(() => tripOperatorDisplayName(this.trip()));

  readonly drawerLoading = signal(false);
  readonly expensesForSettlement = signal<readonly Expense[]>([]);

  readonly incidentDraft = signal('');
  readonly incidentSaving = signal(false);
  readonly collectSaving = signal(false);
  readonly cancelSubmitting = signal(false);
  readonly detailTab = signal<TripsDetailTab>('maneuver');
  readonly showsSettlementTab = computed(() => this.trip().status === 'completed');
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
  readonly cancelKind = signal<'operative' | 'false'>('operative');
  readonly cancelNoteDraft = signal('');

  private detailTabTripId: string | undefined;

  constructor() {
    effect(() => {
      const t = this.tripsFeature.selectedTrip();
      if (!t) {
        return;
      }
      if (t.id !== this.detailTabTripId) {
        this.detailTabTripId = t.id;
        this.detailTab.set(defaultDetailTabForTrip(t));
      }
    });

    effect((onCleanup) => {
      const sub = this.expensesApi
        .getExpensesList()
        .pipe(catchError(() => of([])))
        .subscribe((rows) => this.expensesForSettlement.set(rows));
      onCleanup(() => sub.unsubscribe());
    });

    effect(() => {
      if (!this.showsSettlementTab() && this.detailTab() === 'settlement') {
        this.detailTab.set('maneuver');
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
    const s = this.trip().status;
    return s === 'scheduled' || s === 'in_transit';
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
          const detail =
            err instanceof Error
              ? err.message.trim()
              : typeof err === 'string'
                ? err.trim()
                : '';
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

  enCursoDisplay(): string {
    const t = this.trip().departureAt;
    return t ? this.fmt(t) : '-';
  }

  completadaDisplay(): string {
    const t = this.trip().arrivedAt;
    return t ? this.fmt(t) : '-';
  }

  unitDisplay(unitId: string): string {
    return unitId?.trim() || '-';
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
    return this.showsClientBillingBlock() && (s === 'completed' || s === 'cancelled');
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

  containerLabel(c: TripContainerType): string {
    const labels: Record<TripContainerType, string> = {
      '20ft': '20 pies',
      '40ft': '40 pies',
      '40hc': '40 pies HC (High Cube)',
      na: 'N/A',
    };
    return labels[c];
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
    switch (method) {
      case 'transfer':
        return 'Transferencia';
      case 'check':
        return 'Cheque';
      case 'cash':
        return 'Efectivo';
      default:
        return '—';
    }
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

  settlementLineDate(iso: string | null): string {
    return iso ? this.fmt(iso) : '—';
  }

  settlementPaymentBadgeClass(): string {
    switch (this.settlementSummary().paymentStatus) {
      case 'paid':
        return 'maniobra-settlement__badge maniobra-settlement__badge--paid';
      case 'credit_pending':
        return 'maniobra-settlement__badge maniobra-settlement__badge--credit';
      case 'cash_pending':
        return 'maniobra-settlement__badge maniobra-settlement__badge--pending';
      default:
        return 'maniobra-settlement__badge maniobra-settlement__badge--neutral';
    }
  }

  litersDisplay(raw: string | undefined): string {
    const s = this.displayGroupedNumber(raw);
    return s === '—' ? '—' : `${s} L`;
  }

  invoiceLabel(): string {
    return this.trip().requiresInvoice === true ? 'Sí' : 'No';
  }

  equipmentAt(index: number): string {
    const ids = this.trip().equipmentIds;
    const id = ids?.[index]?.trim();
    if (id) {
      return id;
    }
    const list = this.trip().equipment;
    return list[index]?.trim() ?? '—';
  }

  incidentAuthorLabel(inc: TripIncident): string {
    return tripIncidentPostedBy(inc, []);
  }

  incidentsSorted(): TripIncident[] {
    const list = this.trip().incidents ?? [];
    return [...list].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
  }

  onIncidentDraftInput(ev: Event): void {
    this.incidentDraft.set((ev.target as HTMLTextAreaElement).value);
  }

  registerIncident(): void {
    const text = this.incidentDraft().trim();
    if (!text) {
      this.toast.show('Describe brevemente el incidente antes de registrarlo.', 'warning');
      return;
    }
    const postedBy = this.session.username()?.trim();
    if (!postedBy) {
      this.toast.show('Inicia sesión para registrar incidentes.', 'warning');
      return;
    }
    this.incidentSaving.set(true);
    this.tripsFeature
      .postTripIncident(this.trip().id, text, postedBy)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.incidentDraft.set('');
          this.incidentSaving.set(false);
          this.toast.show('Incidente registrado con la fecha y hora actual.', 'success');
        },
        error: () => {
          this.incidentSaving.set(false);
          this.toast.show('No se pudo registrar el incidente. Inténtalo de nuevo.', 'error');
        },
      });
  }
}
