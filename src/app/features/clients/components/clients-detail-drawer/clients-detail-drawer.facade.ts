import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of, switchMap, type Observable } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { ClientsService as ClientsApiService } from '@core/services/api/clients';
import { TripsService as TripsApiService } from '@core/services/api/trips';
import { SessionService } from '@core/services/state/session';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { ClientsFeatureService } from '@features/clients/services/clients.service';
import { ClientsBalanceContextService } from '@features/clients/services/clients-balance-context.service';
import {
  boolToYesNo,
  buildClientDeliveryPayload,
  normalizeContacts,
  normalizeDeliveries,
  parseOptionalInt,
  validateClientDelivery,
  yesNoToBool,
} from '@features/clients/utils/client-payload';
import {
  clientDeliveries,
  deliveryPlaceLabel,
  isSameClientDeliveryLocation,
  withClientDeliveries,
} from '@features/clients/utils/client-deliveries';
import { clientDeliveryRouteStatusLabel } from '@features/clients/utils/client-delivery-route-link';
import { deriveClientCommercialHealthFromSummary } from '@features/clients/utils/client-commercial-status.util';
import { formatClientBalanceMoney } from '@features/clients/utils/client-balance-summary';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';
import { clientCommercialPillClass, clientCommercialStatusMod } from '@shared/utils/client-commercial-pill';
import {
  CLIENT_YES_NO_OPTIONS,
  clientCommercialHealthLabel,
} from '@shared/catalogs/client-form-options';
import {
  TRIP_MANEUVER_PAYMENT_METHOD_OPTIONS,
  tripManeuverPaymentMethodLabel,
} from '@shared/catalogs/trip-client-payment-options';
import type {
  Client,
  ClientAttachedDocument,
  ClientContactPerson,
  ClientDelivery,
} from '@shared/models/client.models';
import { isAdminRole } from '@shared/utils/access-control';
import { parseHttpApiErrorMessage } from '@shared/utils/http-api-error';
import { type ToBadgeVariant } from '@shared/ui/to-badge/to-badge.component';
import { type ToSegmentTab } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSelectOption } from '@shared/ui/to-select/to-select.component';
import type { ClientPaymentDueBadgeVariant } from '@features/clients/utils/client-balance-summary';

export type ClientDetailEditSection = 'ident' | 'fiscal' | 'delivery' | 'contacts' | 'pay';
export type ClientDrawerTab = 'details' | 'balance';

@Injectable()
export class ClientsDetailDrawerFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly clientsFeature = inject(ClientsFeatureService);
  private readonly clientsApi = inject(ClientsApiService);
  private readonly balanceContext = inject(ClientsBalanceContextService);
  private readonly tripsApi = inject(TripsApiService);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);

  private dismissCallback: (() => void) | null = null;

  readonly balanceLoading = computed(() => this.balanceContext.clientBalanceLoading());
  readonly client = computed(() => this.clientsFeature.selectedClient()!);

  readonly drawerLoading = computed(() => this.clientsFeature.detailLoading());
  readonly drawerTab = signal<ClientDrawerTab>('balance');
  readonly drawerSegmentTabs: readonly ToSegmentTab<ClientDrawerTab>[] = [
    {
      id: 'details',
      label: 'Detalles',
      icon: 'document',
      htmlId: 'clients-detail-tab-details',
    },
    {
      id: 'balance',
      label: 'Balance',
      icon: 'settlement',
      htmlId: 'clients-detail-tab-balance',
    },
  ];
  readonly editingSection = signal<ClientDetailEditSection | null>(null);
  readonly saving = signal(false);
  readonly deleteConfirmOpen = signal(false);
  readonly deleteSubmitting = signal(false);
  readonly canDeleteClient = computed(() => isAdminRole(this.session.role()));
  readonly collectionConfirming = signal(false);
  readonly collectionConfirmRequest = signal<{
    kind: 'confirm' | 'revert';
    tripId: string;
    maneuverCode: string;
  } | null>(null);
  readonly collectionConfirmOpen = computed(
    () => this.collectionConfirmRequest() !== null,
  );
  readonly canWriteClients = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.CLIENTS),
  );
  readonly canWriteTrips = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.TRIPS),
  );

  readonly yesNoOptions: ToSelectOption[] = CLIENT_YES_NO_OPTIONS;

  readonly editName = signal('');
  readonly editRfc = signal('');
  readonly editRelationshipStartedOn = signal('');
  readonly editNotes = signal('');

  readonly billLegal = signal('');
  readonly billRegime = signal('');
  readonly billZip = signal('');
  readonly billCfdi = signal('');
  readonly billEmail = signal('');
  readonly billPhone = signal('');
  readonly editDocuments = signal<ClientAttachedDocument[]>([]);
  readonly editNewFilesFiscal = signal<File[]>([]);
  /** Snapshot al abrir edición fiscal (para detectar deletes). */
  private originalFiscalDocuments: ClientAttachedDocument[] = [];

  readonly fiscalDocuments = computed(() =>
    (this.client().documents ?? []).filter((d) => d.slot === 'fiscal'),
  );
  readonly editFiscalDocuments = computed(() =>
    this.editDocuments().filter((d) => d.slot === 'fiscal'),
  );

  readonly savedDeliveryPostalCode = signal('');
  readonly deliveryCp = signal('');
  readonly deliveryCity = signal('');
  readonly deliveryLocality = signal('');
  readonly deliverySettlementConsId = signal('');
  readonly deliveryLatitude = signal<number | null>(null);
  readonly deliveryLongitude = signal<number | null>(null);
  readonly deliveryDestinationRateId = signal<string | null>(null);
  readonly deliveryIsUnpricedRoute = signal(false);
  readonly deliveries = signal<ClientDelivery[]>([]);
  readonly deliveryFormNonce = signal(0);

  readonly contacts = signal<ClientContactPerson[]>([]);

  readonly addingContact = signal(false);
  readonly newContactName = signal('');
  readonly newContactRole = signal('');
  readonly newContactPhone = signal('');
  readonly newContactEmail = signal('');

  readonly payHasCredit = signal('no');
  readonly payCreditDays = signal('');
  readonly payCreditAmount = signal('');
  readonly payDefaultPaymentMethod = signal('');

  readonly paymentMethodOptions = TRIP_MANEUVER_PAYMENT_METHOD_OPTIONS;

  readonly balanceSummary = computed(() => this.balanceContext.resolvedClientBalance());

  readonly derivedCommercialHealth = computed(() =>
    deriveClientCommercialHealthFromSummary(this.balanceSummary()),
  );

  private readonly now = new Date();
  readonly periodFromMonth = signal(this.now.getMonth() + 1);
  readonly periodFromYear = signal(this.now.getFullYear());
  readonly periodToMonth = signal(this.now.getMonth() + 1);
  readonly periodToYear = signal(this.now.getFullYear());

  readonly currentMonthYear = computed(() => ({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  }));

  readonly periodFrom = computed(() => {
    const m = String(this.periodFromMonth()).padStart(2, '0');
    return `${this.periodFromYear()}-${m}-01`;
  });
  readonly periodTo = computed(() => {
    const m = this.periodToMonth();
    const y = this.periodToYear();
    const lastDay = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  readonly periodLabel = computed(() => {
    const fm = this.periodFromMonth();
    const fy = this.periodFromYear();
    const tm = this.periodToMonth();
    const ty = this.periodToYear();
    const fmt = new Intl.DateTimeFormat('es-MX', { month: 'long' });
    const fromLabel = fmt.format(new Date(fy, fm - 1, 1, 12));
    if (fm === tm && fy === ty) {
      return `${fromLabel.charAt(0).toUpperCase() + fromLabel.slice(1)} ${fy}`;
    }
    const toLabel = fmt.format(new Date(ty, tm - 1, 1, 12));
    return `${fromLabel.charAt(0).toUpperCase() + fromLabel.slice(1)} ${fy} – ${toLabel.charAt(0).toUpperCase() + toLabel.slice(1)} ${ty}`;
  });

  readonly periodSummary = computed(() => this.balanceSummary().period);

  constructor() {
    effect(() => {
      const c = this.clientsFeature.selectedClient();
      if (!c) {
        return;
      }
      const idChanged = this.priorClientId !== c.id;
      this.priorClientId = c.id;
      if (idChanged) {
        const pending = this.clientsFeature.pendingDrawerTab();
        this.drawerTab.set(
          pending === 'details' || pending === 'balance' ? pending : 'balance',
        );
        if (pending === 'details' || pending === 'balance') {
          this.clientsFeature.clearPendingDrawerTab();
        }
        this.editingSection.set(null);
        this.cancelContactForm();
        this.cancelDeliveryForm();
        this.periodFromMonth.set(this.now.getMonth() + 1);
        this.periodFromYear.set(this.now.getFullYear());
        this.periodToMonth.set(this.now.getMonth() + 1);
        this.periodToYear.set(this.now.getFullYear());
      }
      if (idChanged || this.editingSection() === null) {
        this.patchFormFromClient(c);
      }
    });

    effect(() => {
      const client = this.clientsFeature.selectedClient();
      const tab = this.clientsFeature.pendingDrawerTab();
      if (!client || (tab !== 'details' && tab !== 'balance')) {
        return;
      }
      this.clientsFeature.clearPendingDrawerTab();
      this.drawerTab.set(tab);
    });

    effect(() => {
      const clientId = this.clientsFeature.selectedClientId();
      const tab = this.drawerTab();
      const from = this.periodFrom();
      const to = this.periodTo();
      if (!clientId || tab !== 'balance') {
        return;
      }
      this.balanceContext.ensureClientBalanceLoaded(clientId, from, to);
    });
  }

  private priorClientId: string | undefined;

  onPeriodFromChange(value: { month: number; year: number }): void {
    this.periodFromMonth.set(value.month);
    this.periodFromYear.set(value.year);
    if (
      value.year > this.periodToYear() ||
      (value.year === this.periodToYear() && value.month > this.periodToMonth())
    ) {
      this.periodToMonth.set(value.month);
      this.periodToYear.set(value.year);
    }
  }

  onPeriodToChange(value: { month: number; year: number }): void {
    this.periodToMonth.set(value.month);
    this.periodToYear.set(value.year);
    if (
      value.year < this.periodFromYear() ||
      (value.year === this.periodFromYear() && value.month < this.periodFromMonth())
    ) {
      this.periodFromMonth.set(value.month);
      this.periodFromYear.set(value.year);
    }
  }

  bindDismiss(callback: () => void): void {
    this.dismissCallback = callback;
  }

  markReady(): void {
    // El skeleton lo controla `detailLoading` del GET por id.
  }

  requestDismiss(): void {
    this.dismissCallback?.();
  }

  openDeleteConfirm(): void {
    if (!this.canDeleteClient() || this.deleteSubmitting() || this.saving()) {
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

  confirmDeleteClient(): void {
    if (!this.canDeleteClient() || this.deleteSubmitting() || this.saving()) {
      return;
    }
    const client = this.client();
    const label = client.name?.trim() || 'Cliente';
    this.deleteSubmitting.set(true);
    this.clientsFeature
      .deleteClient(client.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleteSubmitting.set(false);
          this.deleteConfirmOpen.set(false);
          this.clientsApi.invalidateClientPickerCache();
          this.balanceContext.invalidateBalances();
          this.balanceContext.ensureOverviewLoaded();
          this.toast.show(`${label} dado de baja en Comercial.`, 'success');
          this.requestDismiss();
        },
        error: (err: unknown) => {
          this.deleteSubmitting.set(false);
          const detail = parseHttpApiErrorMessage(err)?.trim() ?? '';
          this.toast.show(
            detail ? detail : 'No se pudo dar de baja al cliente.',
            'error',
          );
        },
      });
  }

  onDocKey(ev: KeyboardEvent): void {
    if (ev.key !== 'Escape') {
      return;
    }
    if (this.editingSection() !== null) {
      ev.preventDefault();
      this.cancelSectionEdit();
      return;
    }
    this.requestDismiss();
  }

  selectDrawerTab(tab: ClientDrawerTab): void {
    if (this.drawerTab() === tab) {
      return;
    }
    this.cancelSectionEdit();
    this.drawerTab.set(tab);
  }

  healthSummary(): string {
    return clientCommercialHealthLabel(this.derivedCommercialHealth());
  }

  commercialHealthPillClass(): string {
    return clientCommercialPillClass(this.derivedCommercialHealth());
  }

  balanceMoney(value: number): string {
    return formatClientBalanceMoney(value);
  }

  balanceMarginLabel(): string {
    const b = this.balanceSummary();
    if (!b.hasBillable) {
      return '—';
    }
    return `${this.balanceMoney(b.margin)} (${b.marginPct}%)`;
  }

  paymentDueBadgeVariant(v: ClientPaymentDueBadgeVariant): ToBadgeVariant {
    return v;
  }

  canConfirmClientCollection(tripId: string): boolean {
    if (!this.canWriteTrips()) return false;
    const id = tripId.trim();
    return this.balanceSummary().upcomingPayments.some((r) => r.tripId === id);
  }

  canRevertClientCollection(tripId: string): boolean {
    if (!this.canWriteTrips()) return false;
    const id = tripId.trim();
    return this.balanceSummary().paymentHistory.some((r) => r.tripId === id);
  }

  openClientCollectionConfirm(
    kind: 'confirm' | 'revert',
    tripId: string,
    maneuverCode: string,
  ): void {
    if (this.collectionConfirming() || this.saving()) {
      return;
    }
    const normalizedTripId = tripId.trim();
    if (!normalizedTripId) {
      return;
    }
    if (kind === 'confirm' && !this.canConfirmClientCollection(normalizedTripId)) {
      return;
    }
    if (kind === 'revert' && !this.canRevertClientCollection(normalizedTripId)) {
      return;
    }
    this.collectionConfirmRequest.set({
      kind,
      tripId: normalizedTripId,
      maneuverCode: maneuverCode.trim() || normalizedTripId,
    });
  }

  closeCollectionConfirm(): void {
    if (this.collectionConfirming()) {
      return;
    }
    this.collectionConfirmRequest.set(null);
  }

  submitCollectionConfirm(): void {
    const request = this.collectionConfirmRequest();
    if (!request || this.collectionConfirming() || this.saving()) {
      return;
    }
    const collected = request.kind === 'confirm';
    if (collected && !this.canConfirmClientCollection(request.tripId)) {
      return;
    }
    if (!collected && !this.canRevertClientCollection(request.tripId)) {
      return;
    }
    this.collectionConfirming.set(true);
    this.tripsApi
      .patchTripClientCollected(request.tripId, collected)
      .pipe(
        catchError(() => {
          this.toast.show(
            collected
              ? 'No se pudo confirmar el cobro.'
              : 'No se pudo revertir el cobro.',
            'error',
          );
          return of(null);
        }),
        finalize(() => this.collectionConfirming.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((updated) => {
        if (!updated) {
          return;
        }
        this.collectionConfirmRequest.set(null);
        this.balanceContext.invalidateBalances();
        this.balanceContext.ensureClientBalanceLoaded(
          this.client().id,
          this.periodFrom(),
          this.periodTo(),
        );
        this.balanceContext.ensureOverviewLoaded();
        this.toast.show(
          collected
            ? `Cobro de ${updated.maneuverCode} confirmado; cuenta como ingreso en reportes.`
            : `Cobro de ${updated.maneuverCode} revertido; la maniobra vuelve a saldo pendiente.`,
          'success',
        );
      });
  }

  periodVolumeTotalManeuversLabel(): string {
    const p = this.periodSummary();
    if (!p) return '—';
    const n = p.volumeAllCount;
    if (n === 0) return '—';
    return `${n} ${n === 1 ? 'maniobra' : 'maniobras'}`;
  }

  periodVolumeBillableManeuversLabel(): string {
    const p = this.periodSummary();
    if (!p || p.volumeBillableCount === 0) return '—';
    const n = p.volumeBillableCount;
    return `${n} ${n === 1 ? 'maniobra' : 'maniobras'}`;
  }

  periodVolumeBilledPerMonthLabel(): string {
    const p = this.periodSummary();
    if (!p || p.volumeBillableCount === 0) return '—';
    return formatClientBalanceMoney(p.volumeBilledPerMonth);
  }

  periodVolumeOperationalPerMonthLabel(): string {
    const p = this.periodSummary();
    if (!p || p.volumeBillableCount === 0) return '—';
    return formatClientBalanceMoney(p.volumeOperationalPerMonth);
  }

  periodVolumeProfitPerMonthLabel(): string {
    const p = this.periodSummary();
    if (!p || p.volumeBillableCount === 0) return '—';
    return formatClientBalanceMoney(p.volumeProfitPerMonth);
  }

  avgDelayDaysLabel(): string {
    const balance = this.balanceSummary();
    const days = balance.avgDelayDays;
    if (days == null) {
      return '— (sin historial de cobro)';
    }
    if (days <= 0) {
      const abs = Math.abs(days);
      return abs === 0
        ? 'Puntual (paga en fecha de vencimiento)'
        : `−${abs} días (paga antes del vencimiento)`;
    }
    return `${days} días de atraso en promedio`;
  }

  avgDelayDaysMod(): 'success' | 'warning' | 'danger' | '' {
    const days = this.balanceSummary().avgDelayDays;
    if (days == null) return '';
    if (days <= 0) return 'success';
    if (days <= 7) return 'warning';
    return 'danger';
  }

  delayDaysLabel(days: number): string {
    if (days === 0) return 'Puntual';
    if (days < 0) return `${Math.abs(days)}d antes`;
    return `${days}d atraso`;
  }

  receivableManeuverCount(): number {
    return this.balanceSummary().upcomingPayments.length;
  }

  receivableManeuverCountLabel(): string {
    const n = this.receivableManeuverCount();
    return `${n} ${n === 1 ? 'maniobra' : 'maniobras'}`;
  }

  creditExposureStatus(): { label: string; variant: 'success' | 'warning' | 'danger'; icon: ToIconName } {
    const limit = this.parsedCreditLimit();
    const receivable = this.balanceSummary().receivable;

    if (limit <= 0) {
      return { label: 'Sin límite definido', variant: 'success', icon: 'info' };
    }

    const usage = receivable / limit;
    if (receivable > limit) {
      return { label: `Excedido (${Math.round(usage * 100)}% del límite)`, variant: 'danger', icon: 'cancelCircle' };
    }
    if (usage >= 0.8) {
      return { label: `Cerca del límite (${Math.round(usage * 100)}%)`, variant: 'warning', icon: 'warning' };
    }
    return { label: `Dentro del límite (${Math.round(usage * 100)}%)`, variant: 'success', icon: 'checkCircle' };
  }

  historicManeuverCountLabel(): string {
    const n = this.balanceSummary().volumeAllCount;
    return `${n} ${n === 1 ? 'maniobra' : 'maniobras'}`;
  }

  historicMarginPctLabel(): string {
    const pct = this.balanceSummary().marginPct;
    return `${pct}%`;
  }

  private parsedCreditLimit(): number {
    const raw = this.client().payment?.approximateCreditAmount?.trim() ?? '';
    const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/,/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) && num > 0 ? num : 0;
  }

  commercialHealthStatusMod(): string {
    return clientCommercialStatusMod(this.derivedCommercialHealth());
  }

  relationshipStartedLabel(): string {
    return this.formatYmdEs(this.client().relationshipStartedOn);
  }

  creditYesNoLabel(): string {
    const has = this.client().payment?.hasCredit ?? false;
    return has ? 'Sí' : 'No';
  }

  creditDaysLabel(): string {
    const d = this.client().payment?.creditDays;
    return d != null && d > 0 ? String(d) : '—';
  }

  creditAmountLabel(): string {
    const t = this.client().payment?.approximateCreditAmount?.trim();
    return t || '—';
  }

  defaultPaymentMethodLabel(): string {
    return tripManeuverPaymentMethodLabel(this.client().payment?.defaultPaymentMethod);
  }

  startEditSection(section: ClientDetailEditSection): void {
    if (!this.canWriteClients()) {
      return;
    }
    this.patchFormFromClient(this.client());
    if (section === 'fiscal') {
      this.originalFiscalDocuments = [...(this.client().documents ?? [])];
      this.editNewFilesFiscal.set([]);
    }
    this.editingSection.set(section);
  }

  cancelSectionEdit(): void {
    this.patchFormFromClient(this.client());
    this.editNewFilesFiscal.set([]);
    this.originalFiscalDocuments = [];
    this.editingSection.set(null);
    this.cancelContactForm();
    this.cancelDeliveryForm();
  }

  showClientEdit(section: ClientDetailEditSection): boolean {
    return this.canWriteClients() && this.editingSection() !== section;
  }

  openContactForm(): void {
    if (!this.canWriteClients()) {
      return;
    }
    this.addingContact.set(true);
  }

  cancelContactForm(): void {
    this.newContactName.set('');
    this.newContactRole.set('');
    this.newContactPhone.set('');
    this.newContactEmail.set('');
    this.addingContact.set(false);
  }

  commitContact(): void {
    const name = this.newContactName().trim();
    if (!name) {
      this.toast.show('Indica el nombre del contacto.', 'warning');
      return;
    }
    const id = `ct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const role = this.newContactRole().trim();
    const phone = this.newContactPhone().trim();
    const email = this.newContactEmail().trim();
    this.contacts.update((list) => [
      ...list,
      {
        id,
        name,
        ...(role ? { role } : {}),
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
      },
    ]);
    this.cancelContactForm();
  }

  removeContact(id: string): void {
    this.contacts.update((list) => list.filter((c) => c.id !== id));
  }

  cancelDeliveryForm(): void {
    this.resetDeliveryFormFields();
  }

  commitDelivery(): void {
    if (this.saving()) {
      return;
    }
    const err = validateClientDelivery({
      postalCode: this.deliveryCp(),
      cityMunicipality: this.deliveryCity(),
      locality: this.deliveryLocality(),
      settlementConsId: this.deliverySettlementConsId(),
      latitude: this.deliveryLatitude(),
      longitude: this.deliveryLongitude(),
    });
    if (err) {
      this.toast.show(err, 'warning');
      return;
    }
    const delivery = buildClientDeliveryPayload({
      postalCode: this.deliveryCp(),
      cityMunicipality: this.deliveryCity(),
      locality: this.deliveryLocality(),
      settlementConsId: this.deliverySettlementConsId(),
      latitude: this.deliveryLatitude(),
      longitude: this.deliveryLongitude(),
      destinationRateId: this.deliveryDestinationRateId(),
      isUnpricedRoute: this.deliveryIsUnpricedRoute(),
    });
    if (!delivery) {
      this.toast.show('Indica el código postal de entrega.', 'warning');
      return;
    }
    const duplicate = this.deliveries().some((row) =>
      isSameClientDeliveryLocation(row, delivery),
    );
    if (duplicate) {
      this.toast.show('Esa ubicación de entrega ya está registrada.', 'warning');
      return;
    }
    const id = `dlv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const next = [...this.deliveries(), { ...delivery, id }];
    this.persistClient(withClientDeliveries(this.client(), normalizeDeliveries(next)), {
      successMessage: 'Nuevo lugar de entrega agregado.',
      closeSection: false,
      resetForm: true,
    });
  }

  removeDelivery(id: string): void {
    if (this.saving()) {
      return;
    }
    const removed = this.deliveries().find((row) => row.id === id);
    if (!removed) {
      return;
    }
    const next = this.deliveries().filter((row) => row.id !== id);
    this.persistClient(withClientDeliveries(this.client(), normalizeDeliveries(next)), {
      successMessage: `Lugar de entrega ${deliveryPlaceLabel(removed)} eliminado.`,
      closeSection: false,
    });
  }

  private resetDeliveryFormFields(): void {
    this.savedDeliveryPostalCode.set('');
    this.deliveryCp.set('');
    this.deliveryCity.set('');
    this.deliveryLocality.set('');
    this.deliverySettlementConsId.set('');
    this.deliveryLatitude.set(null);
    this.deliveryLongitude.set(null);
    this.deliveryDestinationRateId.set(null);
    this.deliveryIsUnpricedRoute.set(false);
    this.deliveryFormNonce.update((n) => n + 1);
  }

  saveIdentification(): void {
    const nameText = this.editName().trim();
    if (!nameText) {
      this.toast.show('Indica la razón social o nombre del cliente.', 'warning');
      return;
    }
    const rfc = this.editRfc().trim();
    const rel = this.editRelationshipStartedOn().trim();

    const base = this.client();
    const updated: Client = {
      ...base,
      name: nameText,
      ...(rfc ? { rfc } : { rfc: undefined }),
      ...(rel ? { relationshipStartedOn: rel } : { relationshipStartedOn: undefined }),
      notes: this.editNotes().trim() || undefined,
    };
    this.persistClient(updated);
  }

  onEditDocumentsSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    if (!list.length) {
      return;
    }
    this.editNewFilesFiscal.update((prev) => [...prev, ...list]);
    input.value = '';
  }

  removeEditDocument(id: string): void {
    this.editDocuments.update((prev) => prev.filter((d) => d.id !== id));
  }

  removeEditNewFile(index: number): void {
    this.editNewFilesFiscal.update((prev) => prev.filter((_, i) => i !== index));
  }

  downloadClientDocument(d: ClientAttachedDocument): void {
    const documentId = Number(d.id);
    if (!Number.isInteger(documentId) || documentId < 1) {
      this.toast.show(
        'Este documento aún no está en el almacenamiento (vuelve a subirlo).',
        'info',
      );
      return;
    }
    if (d.hasStoredFile === false) {
      this.toast.show(
        'Este documento solo tiene nombre registrado; súbelo de nuevo para poder descargarlo.',
        'info',
      );
      return;
    }
    this.clientsApi
      .downloadClientDocument(this.client().id, documentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ url }) => {
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.download = d.fileName || 'documento';
          document.body.appendChild(a);
          a.click();
          a.remove();
        },
        error: () => {
          this.toast.show('No se pudo descargar el documento.', 'error');
        },
      });
  }

  private syncClientDocuments(
    kept: readonly ClientAttachedDocument[],
    newFiles: readonly File[],
    original: readonly ClientAttachedDocument[],
  ): Observable<unknown> {
    const clientId = this.client().id;
    const keptIds = new Set(
      kept
        .map((d) => Number(d.id))
        .filter((id) => Number.isInteger(id) && id > 0),
    );
    const deletes = original
      .filter((d) => {
        const id = Number(d.id);
        return Number.isInteger(id) && id > 0 && !keptIds.has(id);
      })
      .map((d) => this.clientsApi.deleteClientDocument(clientId, Number(d.id)));
    const uploads = newFiles.map((file) =>
      this.clientsApi.uploadClientDocument(clientId, 'fiscal', file),
    );
    const ops = [...deletes, ...uploads];
    return ops.length === 0 ? of(null) : forkJoin(ops);
  }

  displayIsoDate(ymd: string | undefined): string {
    return this.formatYmdEs(ymd);
  }

  saveFiscal(): void {
    if (this.saving()) {
      return;
    }
    const base = this.client();
    const kept = this.editDocuments();
    const newFiles = this.editNewFilesFiscal();
    const original = this.originalFiscalDocuments;
    const updated: Client = {
      ...base,
      billing: {
        invoiceLegalName: this.billLegal().trim() || undefined,
        taxRegime: this.billRegime().trim() || undefined,
        fiscalZip: this.billZip().trim() || undefined,
        cfdiUse: this.billCfdi().trim() || undefined,
        billingEmail: this.billEmail().trim() || undefined,
        billingPhone: this.billPhone().trim() || undefined,
      },
    };
    this.saving.set(true);
    this.syncClientDocuments(kept, newFiles, original)
      .pipe(
        switchMap(() => this.clientsFeature.updateClient(updated)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.editNewFilesFiscal.set([]);
          this.saving.set(false);
          this.toast.show('Cliente actualizado.', 'success');
          this.editingSection.set(null);
          this.cancelContactForm();
          this.cancelDeliveryForm();
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudo guardar.', 'error');
        },
      });
  }

  deliveryRouteLinkLabel(delivery: ClientDelivery): string {
    return clientDeliveryRouteStatusLabel(delivery);
  }

  hasClientDelivery(): boolean {
    return clientDeliveries(this.client()).some((row) => !!row.postalCode?.trim());
  }

  clientDeliveriesList(): ClientDelivery[] {
    return clientDeliveries(this.client());
  }

  saveContacts(): void {
    const base = this.client();
    const updated: Client = {
      ...base,
      contacts: normalizeContacts(this.contacts()),
    };
    this.persistClient(updated);
  }

  savePayment(): void {
    const hasCr = yesNoToBool(this.payHasCredit());
    const days = parseOptionalInt(this.payCreditDays());
    if (hasCr && (days === undefined || days <= 0)) {
      this.toast.show(
        'Si el cliente tiene crédito, indica los días de plazo (mayor a 0).',
        'warning',
      );
      return;
    }

    const base = this.client();
    const updated: Client = {
      ...base,
      payment: {
        hasCredit: hasCr,
        ...(hasCr && days != null ? { creditDays: days } : {}),
        ...(hasCr && this.payCreditAmount().trim()
          ? { approximateCreditAmount: this.payCreditAmount().trim() }
          : {}),
        defaultPaymentMethod: this.payDefaultPaymentMethod().trim() || undefined,
      },
    };
    this.persistClient(updated);
  }

  private persistClient(
    updated: Client,
    options?: { successMessage?: string; closeSection?: boolean; resetForm?: boolean },
  ): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.clientsFeature
      .updateClient(updated)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.show(options?.successMessage ?? 'Cliente actualizado.', 'success');
          if (options?.closeSection === false) {
            this.syncDeliveriesFromClient();
            if (options.resetForm) {
              this.resetDeliveryFormFields();
            }
            return;
          }
          this.editingSection.set(null);
          this.cancelContactForm();
          this.cancelDeliveryForm();
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudo guardar.', 'error');
        },
      });
  }

  private syncDeliveriesFromClient(): void {
    this.deliveries.set(
      clientDeliveries(this.client()).map((row, index) => ({
        ...row,
        id:
          row.id?.trim() ||
          `dlv-${index}-${row.postalCode ?? ''}-${row.locality ?? ''}`,
      })),
    );
  }

  private patchFormFromClient(c: Client): void {
    this.editName.set(c.name);
    this.editRfc.set(c.rfc ?? '');
    this.editRelationshipStartedOn.set(c.relationshipStartedOn ?? '');
    this.editNotes.set(c.notes ?? '');
    const b = c.billing ?? {};
    this.billLegal.set(b.invoiceLegalName ?? '');
    this.billRegime.set(b.taxRegime ?? '');
    this.billZip.set(b.fiscalZip ?? '');
    this.billCfdi.set(b.cfdiUse ?? '');
    this.billEmail.set(b.billingEmail ?? '');
    this.billPhone.set(b.billingPhone ?? '');
    this.editDocuments.set([...(c.documents ?? [])]);
    this.syncDeliveriesFromClient();
    this.resetDeliveryFormFields();
    this.contacts.set([...(c.contacts ?? [])].map((row) => ({ ...row })));
    const p = c.payment;
    this.payHasCredit.set(boolToYesNo(p?.hasCredit ?? false));
    this.payCreditDays.set(p?.creditDays != null ? String(p.creditDays) : '');
    this.payCreditAmount.set(p?.approximateCreditAmount ?? '');
    this.payDefaultPaymentMethod.set(p?.defaultPaymentMethod ?? '');
  }


  private formatYmdEs(ymd: string | undefined): string {
    const t = (ymd ?? '').trim();
    if (!t) {
      return '—';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      return t;
    }
    const d = new Date(`${t}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      return t;
    }
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(d);
  }
}
