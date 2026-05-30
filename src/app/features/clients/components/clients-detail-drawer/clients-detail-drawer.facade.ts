import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService } from '@core/notifications/toast.service';
import { ClientsFeatureService } from '@features/clients/services/clients.service';
import {
  boolToYesNo,
  buildClientDeliveryPayload,
  commercialHealthFromUnknown,
  formatClientDeliveryCoord,
  normalizeContacts,
  parseOptionalInt,
  validateClientDelivery,
  yesNoToBool,
} from '@features/clients/utils/client-payload';
import { buildClientBalanceSummary } from '@features/clients/utils/client-balance-summary';
import { buildClientManeuverVolumeSummary } from '@features/clients/utils/client-maneuver-volume-summary';
import {
  CLIENT_COMMERCIAL_HEALTH_OPTIONS,
  CLIENT_YES_NO_OPTIONS,
  clientCommercialHealthLabel,
} from '@shared/catalogs/client-form-options';
import {
  TRIP_MANEUVER_PAYMENT_METHOD_OPTIONS,
  tripManeuverPaymentMethodLabel,
} from '@shared/catalogs/trip-client-payment-options';
import type {
  Client,
  ClientCommercialHealth,
  ClientContactPerson,
} from '@shared/models/client.models';
import type { Trip } from '@shared/models/logistics.models';
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
  private readonly toast = inject(ToastService);

  private dismissCallback: (() => void) | null = null;
  private readonly tripsSignal = signal<readonly Trip[]>([]);

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
  ];
  readonly editingSection = signal<ClientDetailEditSection | null>(null);
  readonly saving = signal(false);

  readonly yesNoOptions: ToSelectOption[] = CLIENT_YES_NO_OPTIONS;
  readonly healthOptions: ToSelectOption[] = CLIENT_COMMERCIAL_HEALTH_OPTIONS;

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

  readonly contacts = signal<ClientContactPerson[]>([]);

  readonly addingContact = signal(false);
  readonly newContactName = signal('');
  readonly newContactRole = signal('');
  readonly newContactPhone = signal('');
  readonly newContactEmail = signal('');

  readonly payHasCredit = signal('no');
  readonly payCreditDays = signal('');
  readonly payCreditAmount = signal('');
  readonly payHealth = signal('not_evaluated');
  readonly payDefaultPaymentMethod = signal('');

  readonly paymentMethodOptions = TRIP_MANEUVER_PAYMENT_METHOD_OPTIONS;

  readonly volumeSummary = computed(() =>
    buildClientManeuverVolumeSummary(this.client().id, this.tripsSignal()),
  );

  readonly balanceSummary = computed(() =>
    buildClientBalanceSummary(this.client().id, this.tripsSignal()),
  );

  private readonly mxMoney0 = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  });

  constructor() {
    effect(() => {
      const c = this.clientsFeature.selectedClient();
      if (!c) {
        return;
      }
      const idChanged = this.priorClientId !== c.id;
      this.priorClientId = c.id;
      this.tripsSignal.set([]);
      this.drawerLoading.set(false);
      if (idChanged) {
        this.drawerTab.set('balance');
        this.editingSection.set(null);
        this.cancelContactForm();
      }
      if (idChanged || this.editingSection() === null) {
        this.patchFormFromClient(c);
      }
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

  healthSummary(): string {
    return clientCommercialHealthLabel(this.client().payment?.commercialHealth);
  }

  balanceMoney(value: number): string {
    return this.mxMoney0.format(value);
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
    return `${this.mxMoney0.format(v.billedPerMonth)} / mes (suma de cobros pactados)`;
  }

  volumeOperationalPerMonthLabel(): string {
    const v = this.volumeSummary();
    if (!v.hasData) {
      return '—';
    }
    return `${this.mxMoney0.format(v.operationalPerMonth)} / mes (diesel, casetas, operador)`;
  }

  volumeProfitPerMonthLabel(): string {
    const v = this.volumeSummary();
    if (!v.hasData) {
      return '—';
    }
    return `${this.mxMoney0.format(v.profitPerMonth)} / mes (facturación aprox. menos costos operativos)`;
  }

  commercialHealthStatusMod(): string {
    const h =
      (this.client().payment?.commercialHealth as ClientCommercialHealth | undefined) ??
      'not_evaluated';
    switch (h) {
      case 'good_standing':
        return 'fleet-unit-detail__status--client-good';
      case 'watch_list':
        return 'fleet-unit-detail__status--client-watch';
      case 'restricted':
        return 'fleet-unit-detail__status--client-restricted';
      case 'not_evaluated':
      default:
        return 'fleet-unit-detail__status--client-na';
    }
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
    this.patchFormFromClient(this.client());
    this.editingSection.set(section);
  }

  cancelSectionEdit(): void {
    this.patchFormFromClient(this.client());
    this.editingSection.set(null);
    this.cancelContactForm();
  }

  openContactForm(): void {
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
        ...(hasCr && days != null ? { creditDays: days } : {}),
        ...(hasCr && this.payCreditAmount().trim()
          ? { approximateCreditAmount: this.payCreditAmount().trim() }
          : {}),
        commercialHealth: commercialHealthFromUnknown(this.payHealth()),
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
    this.contacts.set([...(c.contacts ?? [])].map((row) => ({ ...row })));
    const p = c.payment;
    this.payHasCredit.set(boolToYesNo(p?.hasCredit ?? false));
    this.payCreditDays.set(p?.creditDays != null ? String(p.creditDays) : '');
    this.payCreditAmount.set(p?.approximateCreditAmount ?? '');
    this.payHealth.set(p?.commercialHealth ?? 'not_evaluated');
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
