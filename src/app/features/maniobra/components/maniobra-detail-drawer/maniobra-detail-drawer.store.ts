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
import { UnitsService } from '@services/api/units';
import { EquipmentService } from '@services/api/equipment';
import { labelForEquipmentId } from '@shared/utils/fleet/equipment-label';
import { labelForUnitId } from '@shared/utils/fleet/unit-label';
import { ToastService } from '@core/notifications/toast.service';
import { ExpensesService } from '@services/api/expenses';
import { OperatorsService } from '@services/api/operators';
import { tripIncidentPostedBy } from '@features/maniobra/utils/trip-incidents';
import { tripCargoDescriptionDisplay } from '@features/maniobra/utils/trip-cargo-description';
import {
  buildManiobraSettlementSummary,
  formatSettlementMxn,
} from '@features/maniobra/utils/maniobra-settlement';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';
import { TripsService } from '@services/api/trips';
import {
  snapshotTextOrDash,
  storedRouteDistanceKmLabel,
} from '@features/maniobra/utils/maniobra-route-display';
import {
  Expense,
  Operator,
  Trip,
  TripContainerType,
  TripIncident,
  TripLoadType,
  TripOperationType,
} from '@shared/models/logistics.models';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import { type ToSegmentTab } from '@shared/ui/to-segment-control/to-segment-control.component';

export type ManiobraDetailTab = 'maneuver' | 'tracking' | 'settlement';

export interface ManiobraDetailDrawerHostInputs {
  trip: Trip;
  operatorName: string;
}

export interface ManiobraDetailDrawerHostCallbacks {
  dismiss: () => void;
  maniobraTripChange: (trip: Trip) => void;
  closeCancelDialog: () => void;
}

/** Pestaña inicial al abrir el detalle. */
function defaultDetailTabForTrip(trip: Trip): ManiobraDetailTab {
  if (trip.status === 'in_transit') {
    return 'tracking';
  }
  if (trip.status === 'completed') {
    return 'settlement';
  }
  return 'maneuver';
}

@Injectable()
export class ManiobraDetailDrawerStore {
  private readonly dateShort = inject(DateShortPipe);
  private readonly tripsApi = inject(TripsService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  private readonly unitsApi = inject(UnitsService);
  private readonly equipmentApi = inject(EquipmentService);
  private readonly operatorsApi = inject(OperatorsService);
  readonly unitsCatalog = signal<import('@shared/models/logistics.models').Unit[]>([]);
  readonly equipmentCatalog = signal<import('@shared/models/logistics.models').Equipment[]>([]);
  private readonly expensesApi = inject(ExpensesService);
  private readonly destroyRef = inject(DestroyRef);

  private hostCallbacks: ManiobraDetailDrawerHostCallbacks | null = null;

  private readonly tripSource = signal<Trip | null>(null);
  private readonly operatorNameSource = signal('');

  readonly trip = computed(() => this.tripSource()!);
  readonly operatorName = computed(() => this.operatorNameSource());

  readonly operators = signal<Operator[]>([]);
  readonly drawerLoading = signal(true);
  readonly expensesForSettlement = signal<readonly Expense[]>([]);

  readonly incidentDraft = signal('');
  readonly incidentSaving = signal(false);
  readonly collectSaving = signal(false);
  readonly cancelSubmitting = signal(false);
  readonly detailTab = signal<ManiobraDetailTab>('maneuver');
  readonly showsSettlementTab = computed(() => this.trip().status === 'completed');
  readonly detailSegmentTabs = computed((): readonly ToSegmentTab<ManiobraDetailTab>[] => {
    const tabs: ToSegmentTab<ManiobraDetailTab>[] = [
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
    this.operatorsApi
      .getOperatorsList()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rows) => {
        this.operators.set(rows);
        this.drawerLoading.set(false);
      });

    this.unitsApi
      .getUnitsList()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rows) => this.unitsCatalog.set(rows));

    this.equipmentApi
      .getEquipmentList()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rows) => this.equipmentCatalog.set(rows));

    effect((onCleanup) => {
      const t = this.tripSource();
      if (!t) {
        return;
      }
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

  bindHost(
    inputs: ManiobraDetailDrawerHostInputs,
    callbacks: ManiobraDetailDrawerHostCallbacks,
  ): void {
    this.hostCallbacks = callbacks;
    const trip = inputs.trip;
    this.tripSource.set(trip);
    this.operatorNameSource.set(inputs.operatorName);
    if (trip.id !== this.detailTabTripId) {
      this.detailTabTripId = trip.id;
      this.detailTab.set(defaultDetailTabForTrip(trip));
    }
  }

  markReady(): void {
    // drawerLoading se resuelve tras operatorsRepo.list()
  }

  requestDismiss(): void {
    this.hostCallbacks?.dismiss();
  }

  selectDetailTab(tab: ManiobraDetailTab): void {
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
    this.tripsApi
      .postTripCancel(this.trip().id, {
        falseManeuver: falseM,
        note: falseM ? note : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.cancelSubmitting.set(false);
          this.hostCallbacks?.closeCancelDialog();
          this.hostCallbacks?.maniobraTripChange(updated);
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
    return labelForUnitId(unitId, this.unitsCatalog());
  }

  isFullTrip(): boolean {
    return this.trip().operationType === 'full';
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
    this.tripsApi
      .patchTripClientCollected(this.trip().id, next)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.collectSaving.set(false);
          this.tripSource.set(updated);
          this.hostCallbacks?.maniobraTripChange(updated);
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

  operationLabel(op: TripOperationType): string {
    const labels: Record<TripOperationType, string> = {
      sencillo: 'Sencillo',
      full: 'Full',
      plana: 'Plana',
    };
    return labels[op];
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

  distanceDisplay(): string {
    return storedRouteDistanceKmLabel(this.trip().routeDistanceKm);
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
      return labelForEquipmentId(id, this.equipmentCatalog());
    }
    const list = this.trip().equipment;
    return list[index]?.trim() ?? '—';
  }

  incidentAuthorLabel(inc: TripIncident): string {
    return tripIncidentPostedBy(inc, this.operators());
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
    this.tripsApi
      .postTripIncident(this.trip().id, text, postedBy)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.incidentDraft.set('');
          this.incidentSaving.set(false);
          this.tripSource.set(updated);
          this.hostCallbacks?.maniobraTripChange(updated);
          this.toast.show('Incidente registrado con la fecha y hora actual.', 'success');
        },
        error: () => {
          this.incidentSaving.set(false);
          this.toast.show('No se pudo registrar el incidente. Inténtalo de nuevo.', 'error');
        },
      });
  }
}
