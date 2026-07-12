import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, of } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { TripsService as TripsApiService } from '@core/services/api/trips';
import { SessionService } from '@core/services/state/session';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { ClientsFeatureService } from '@features/clients/services/clients.service';
import { ClientsBalanceContextService } from '@features/clients/services/clients-balance-context.service';
import {
  boolToYesNo,
  buildClientDeliveryPayload,
  formatClientDeliveryCoord,
  normalizeContacts,
  parseOptionalInt,
  validateClientDelivery,
  yesNoToBool,
} from '@features/clients/utils/client-payload';
import { clientDeliveryRouteLinkTitle } from '@features/clients/utils/client-delivery-route-link';
import { deriveClientCommercialHealthFromSummary } from '@features/clients/utils/client-commercial-status.util';
import { formatClientBalanceMoney } from '@features/clients/utils/client-balance-summary';
import { buildClientManeuverVolumeSummary } from '@features/clients/utils/client-maneuver-volume-summary';
import {
  clientManeuversPeriodFilterTabs,
  clientManeuversPeriodRangeLabel,
  clientManeuversRangeForPreset,
  type ClientManeuversPeriodPreset,
} from '@features/clients/utils/client-maneuvers-period-filter';
import {
  buildClientManeuverPeriodTotals,
  buildClientManeuverTableRows,
  filterClientCompletedManeuversInPeriod,
} from '@features/clients/utils/client-maneuvers-table.util';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { OperationalTripsFeatureService } from '@features/trips/services/operational-trips.service';
import { isTripClientCollected } from '@features/reports/utils/reports-trip-helpers';
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
  ClientContactPerson,
} from '@shared/models/client.models';
import { type ToBadgeVariant } from '@shared/ui/to-badge/to-badge.component';
import { type ToSegmentTab } from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSelectOption } from '@shared/ui/to-select/to-select.component';
import type { ClientPaymentDueBadgeVariant } from '@features/clients/utils/client-balance-summary';
import type { Trip } from '@shared/models/logistics.models';

export type ClientDetailEditSection = 'ident' | 'fiscal' | 'delivery' | 'contacts' | 'pay';
export type ClientDrawerTab = 'details' | 'balance' | 'maneuvers';

@Injectable()
export class ClientsDetailDrawerFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly clientsFeature = inject(ClientsFeatureService);
  private readonly balanceContext = inject(ClientsBalanceContextService);
  private readonly operationalTrips = inject(OperationalTripsFeatureService);
  private readonly tripsApi = inject(TripsApiService);
  private readonly operationConfigsFeature = inject(OperationConfigurationsFeatureService);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);

  private dismissCallback: (() => void) | null = null;

  readonly tripsLoading = computed(() => this.operationalTrips.loading());
  readonly balanceLoading = computed(() => this.balanceContext.clientBalanceLoading());
  readonly clientTrips = computed(() => this.operationalTrips.trips());
  readonly balanceExpenses = computed(() => this.balanceContext.expenses());

  readonly client = computed(() => this.clientsFeature.selectedClient()!);

  readonly drawerLoading = signal(true);
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
    {
      id: 'maneuvers',
      label: 'Maniobras',
      icon: 'route',
      htmlId: 'clients-detail-tab-maneuvers',
    },
  ];
  readonly maneuversPeriodPreset = signal<ClientManeuversPeriodPreset>('month');
  readonly maneuversPeriodFilterTabs = clientManeuversPeriodFilterTabs();
  readonly editingSection = signal<ClientDetailEditSection | null>(null);
  readonly saving = signal(false);
  readonly collectionConfirming = signal(false);
  readonly collectionConfirmRequest = signal<{
    kind: 'confirm' | 'revert';
    tripId: string;
    maneuverCode: string;
  } | null>(null);
  readonly collectionConfirmOpen = computed(
    () => this.collectionConfirmRequest() !== null,
  );
  readonly canWriteCommercial = computed(() =>
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

  readonly savedDeliveryPostalCode = signal('');
  readonly deliveryCp = signal('');
  readonly deliveryCity = signal('');
  readonly deliveryLocality = signal('');
  readonly deliverySettlementConsId = signal('');
  readonly deliveryLatitude = signal<number | null>(null);
  readonly deliveryLongitude = signal<number | null>(null);
  readonly deliveryDestinationRateId = signal<string | null>(null);
  readonly deliveryIsUnpricedRoute = signal(false);

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

  readonly volumeSummary = computed(() =>
    buildClientManeuverVolumeSummary(this.client().id, this.clientTrips()),
  );

  readonly balanceSummary = computed(() => this.balanceContext.resolvedClientBalance());

  readonly derivedCommercialHealth = computed(() =>
    deriveClientCommercialHealthFromSummary(this.balanceSummary()),
  );

  readonly maneuversPeriodRangeLabel = computed(() =>
    clientManeuversPeriodRangeLabel(this.maneuversPeriodPreset()),
  );

  readonly filteredManeuverTrips = computed(() => {
    const range = clientManeuversRangeForPreset(this.maneuversPeriodPreset());
    return filterClientCompletedManeuversInPeriod(
      this.client().id,
      this.clientTrips(),
      range.from,
      range.to,
    );
  });

  readonly maneuverTableRows = computed(() =>
    buildClientManeuverTableRows(
      this.filteredManeuverTrips(),
      (value) => this.balanceMoney(value),
      this.balanceExpenses(),
    ),
  );

  readonly maneuverTablePageSize = computed(() =>
    Math.max(this.maneuverTableRows().length, 1),
  );

  readonly maneuverPeriodTotals = computed(() =>
    buildClientManeuverPeriodTotals(
      this.filteredManeuverTrips(),
      this.balanceExpenses(),
    ),
  );

  constructor() {
    effect(() => {
      const c = this.clientsFeature.selectedClient();
      if (!c) {
        return;
      }
      this.balanceContext.ensureTripsLoaded();
      const idChanged = this.priorClientId !== c.id;
      this.priorClientId = c.id;
      this.drawerLoading.set(false);
      if (idChanged) {
        this.drawerTab.set('balance');
        this.maneuversPeriodPreset.set('month');
        this.editingSection.set(null);
        this.cancelContactForm();
      }
      if (idChanged || this.editingSection() === null) {
        this.patchFormFromClient(c);
      }
    });

    effect(() => {
      const c = this.clientsFeature.selectedClient();
      const tab = this.drawerTab();
      if (!c) {
        return;
      }
      if (tab === 'balance') {
        this.balanceContext.ensureClientBalanceLoaded(c.id);
      } else if (tab === 'maneuvers') {
        const tripIds = this.filteredManeuverTrips().map((trip) => trip.id);
        this.balanceContext.ensureExpensesForTrips(tripIds);
      }
    });

    effect(() => {
      const c = this.clientsFeature.selectedClient();
      if (!c) {
        return;
      }
      this.operationalTrips.loadTrips();
      this.operationConfigsFeature.loadOperationConfigurations();
    });
  }

  private priorClientId: string | undefined;

  bindDismiss(callback: () => void): void {
    this.dismissCallback = callback;
  }

  markReady(): void {
    const c = this.clientsFeature.selectedClient();
    if (c) {
      this.drawerLoading.set(false);
    }
  }

  requestDismiss(): void {
    this.dismissCallback?.();
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

  onManeuversPeriodSelect(preset: ClientManeuversPeriodPreset): void {
    this.maneuversPeriodPreset.set(preset);
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

  maneuverMarginLabel(): string {
    const t = this.maneuverPeriodTotals();
    if (t.totalPactado <= 0) {
      return '—';
    }
    return `${t.marginPct}%`;
  }

  maneuverUtilidadLabel(): string {
    return this.balanceMoney(this.maneuverPeriodTotals().utilidad);
  }

  paymentDueBadgeVariant(v: ClientPaymentDueBadgeVariant): ToBadgeVariant {
    return v;
  }

  canConfirmClientCollection(tripId: string): boolean {
    if (!this.canWriteTrips()) {
      return false;
    }
    const trip = this.tripForCollection(tripId);
    if (!trip) {
      return false;
    }
    if (isTripClientCollected(trip)) {
      return false;
    }
    return this.tripAllowsClientCollection(trip);
  }

  canRevertClientCollection(tripId: string): boolean {
    if (!this.canWriteTrips()) {
      return false;
    }
    const trip = this.tripForCollection(tripId);
    if (!trip) {
      return false;
    }
    if (!isTripClientCollected(trip)) {
      return false;
    }
    return this.tripAllowsClientCollection(trip);
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
      )
      .subscribe((updated) => {
        if (!updated) {
          return;
        }
        this.collectionConfirmRequest.set(null);
        this.balanceContext.invalidateBalances();
        this.balanceContext.ensureClientBalanceLoaded(this.client().id);
        this.balanceContext.ensureOverviewLoaded();
        this.operationalTrips.refreshTrips();
        this.toast.show(
          collected
            ? `Cobro de ${updated.maneuverCode} confirmado; cuenta como ingreso en reportes.`
            : `Cobro de ${updated.maneuverCode} revertido; la maniobra vuelve a saldo pendiente.`,
          'success',
        );
      });
  }

  volumeTotalManeuversLabel(): string {
    const n = this.volumeSummary().allManeuverCount;
    if (n === 0) {
      return '—';
    }
    return `${n} ${n === 1 ? 'maniobra' : 'maniobras'}`;
  }

  volumeManeuversPerMonthLabel(): string {
    const v = this.volumeSummary();
    if (!v.hasData) {
      return '—';
    }
    const n = v.maneuversPerMonth;
    const rounded = n < 10 ? n.toFixed(1) : String(Math.round(n));
    const meses = v.monthsWindow === 1 ? 'mes' : 'meses';
    return `${rounded} en promedio (${v.monthsWindow} ${meses} de actividad)`;
  }

  volumeBilledPerMonthLabel(): string {
    const v = this.volumeSummary();
    if (!v.hasData) {
      return '—';
    }
    return `${formatClientBalanceMoney(v.billedPerMonth)} / mes (suma de cobros pactados)`;
  }

  volumeOperationalPerMonthLabel(): string {
    const v = this.volumeSummary();
    if (!v.hasData) {
      return '—';
    }
    return `${formatClientBalanceMoney(v.operationalPerMonth)} / mes (diesel, casetas, operador)`;
  }

  volumeProfitPerMonthLabel(): string {
    const v = this.volumeSummary();
    if (!v.hasData) {
      return '—';
    }
    return `${formatClientBalanceMoney(v.profitPerMonth)} / mes (facturación aprox. menos costos operativos)`;
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
    if (!this.canWriteCommercial()) {
      return;
    }
    this.patchFormFromClient(this.client());
    this.editingSection.set(section);
  }

  cancelSectionEdit(): void {
    this.patchFormFromClient(this.client());
    this.editingSection.set(null);
    this.cancelContactForm();
  }

  showClientEdit(section: ClientDetailEditSection): boolean {
    return this.canWriteCommercial() && this.editingSection() !== section;
  }

  openContactForm(): void {
    if (!this.canWriteCommercial()) {
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

  saveFiscal(): void {
    const base = this.client();
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
    this.persistClient(updated);
  }

  saveDelivery(): void {
    const err = validateClientDelivery({
      postalCode: this.deliveryCp(),
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
    const base = this.client();
    const updated: Client = {
      ...base,
      delivery,
    };
    this.persistClient(updated);
  }

  deliveryCoordLabel(value: number | undefined): string {
    return formatClientDeliveryCoord(value);
  }

  deliveryRouteLinkLabel(): string {
    const delivery = this.client().delivery;
    if (!delivery?.postalCode?.trim() || !delivery.locality?.trim()) {
      return '—';
    }
    if (delivery.destinationRateId) {
      return clientDeliveryRouteLinkTitle('linked') ?? 'Ruta tarifada disponible';
    }
    if (delivery.isUnpricedRoute) {
      return (
        clientDeliveryRouteLinkTitle('unpriced') ??
        'Ruta sin tarifa (pendiente de configuración)'
      );
    }
    return '—';
  }

  hasClientDelivery(): boolean {
    return !!this.client().delivery?.postalCode?.trim();
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
        commercialHealth: base.payment?.commercialHealth ?? 'watch_list',
        ...(hasCr && days != null ? { creditDays: days } : {}),
        ...(hasCr && this.payCreditAmount().trim()
          ? { approximateCreditAmount: this.payCreditAmount().trim() }
          : {}),
        defaultPaymentMethod: this.payDefaultPaymentMethod().trim() || undefined,
      },
    };
    this.persistClient(updated);
  }

  private persistClient(updated: Client): void {
    this.saving.set(true);
    this.clientsFeature
      .updateClient(updated)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.show('Cliente actualizado.', 'success');
          this.editingSection.set(null);
          this.cancelContactForm();
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudo guardar.', 'error');
        },
      });
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
    const d = c.delivery;
    this.savedDeliveryPostalCode.set(d?.postalCode?.trim() ?? '');
    this.deliveryCp.set(d?.postalCode ?? '');
    this.deliveryCity.set(d?.cityMunicipality ?? '');
    this.deliveryLocality.set(d?.locality ?? '');
    this.deliverySettlementConsId.set(d?.settlementConsId ?? '');
    this.deliveryLatitude.set(d?.latitude ?? null);
    this.deliveryLongitude.set(d?.longitude ?? null);
    this.deliveryDestinationRateId.set(d?.destinationRateId?.trim() || null);
    this.deliveryIsUnpricedRoute.set(d?.isUnpricedRoute === true);
    this.contacts.set([...(c.contacts ?? [])].map((row) => ({ ...row })));
    const p = c.payment;
    this.payHasCredit.set(boolToYesNo(p?.hasCredit ?? false));
    this.payCreditDays.set(p?.creditDays != null ? String(p.creditDays) : '');
    this.payCreditAmount.set(p?.approximateCreditAmount ?? '');
    this.payDefaultPaymentMethod.set(p?.defaultPaymentMethod ?? '');
  }

  private tripForCollection(tripId: string): Trip | undefined {
    const id = tripId.trim();
    if (!id) {
      return undefined;
    }
    return this.clientTrips().find((t) => t.id === id);
  }

  private tripAllowsClientCollection(trip: Trip): boolean {
    if (trip.hasClientBilling === false) {
      return false;
    }
    return trip.status === 'completed' || trip.status === 'cancelled';
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
