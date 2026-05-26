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
import {
  boolToYesNo,
  commercialHealthFromUnknown,
  normalizeContacts,
  parseOptionalInt,
  yesNoToBool,
} from '@features/clients/utils/client-payload';
import { buildClientBalanceSummary } from '@features/clients/utils/client-balance-summary';
import { buildClientManeuverVolumeSummary } from '@features/clients/utils/client-maneuver-volume-summary';
import { ClientsService } from '@services/api/clients';
import {
  CLIENT_COMMERCIAL_HEALTH_OPTIONS,
  CLIENT_YES_NO_OPTIONS,
  clientCommercialHealthLabel,
} from '@shared/catalogs/client-form-options';
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

export type ClientDetailEditSection = 'ident' | 'fiscal' | 'contacts' | 'pay';
export type ClientDrawerTab = 'details' | 'balance';

export interface ClientsDetailDrawerHostInputs {
  client: Client;
}

export interface ClientsDetailDrawerHostCallbacks {
  dismiss: () => void;
  clientChange: (client: Client) => void;
}

@Injectable()
export class ClientsDetailDrawerStore {
  private readonly destroyRef = inject(DestroyRef);
  private readonly clientsApi = inject(ClientsService);
  private readonly toast = inject(ToastService);

  private hostCallbacks: ClientsDetailDrawerHostCallbacks | null = null;

  private readonly clientSource = signal<Client | null>(null);
  private readonly tripsSignal = signal<readonly Trip[]>([]);

  readonly client = computed(() => this.clientSource()!);

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
      const c = this.clientSource();
      if (!c) {
        return;
      }
      this.tripsSignal.set([]);
      this.drawerLoading.set(false);
    });
  }

  bindHost(
    inputs: ClientsDetailDrawerHostInputs,
    callbacks: ClientsDetailDrawerHostCallbacks,
  ): void {
    const priorId = this.clientSource()?.id;
    this.hostCallbacks = callbacks;
    this.clientSource.set(inputs.client);
    this.patchFormFromClient(inputs.client);
    if (priorId !== inputs.client.id) {
      this.drawerTab.set('balance');
      this.editingSection.set(null);
      this.cancelContactForm();
    }
  }

  markReady(): void {
    // drawerLoading se resuelve tras list() en constructor effect
  }

  requestDismiss(): void {
    this.hostCallbacks?.dismiss();
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
    if (!this.editRfc().trim()) {
      this.toast.show('Indica el RFC del cliente.', 'warning');
      return;
    }
    const rel = this.editRelationshipStartedOn().trim();
    if (!rel) {
      this.toast.show('Indica la fecha de inicio de la relación comercial.', 'warning');
      return;
    }

    const base = this.client();
    const updated: Client = {
      ...base,
      name: nameText,
      rfc: this.editRfc().trim(),
      relationshipStartedOn: rel,
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
      },
    };
    this.persistClient(updated);
  }

  private persistClient(updated: Client): void {
    this.saving.set(true);
    this.clientsApi
      .patchClientById(updated)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (row) => {
          this.saving.set(false);
          this.toast.show('Cliente actualizado.', 'success');
          this.hostCallbacks?.clientChange(row);
          this.clientSource.set(row);
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
    this.contacts.set([...(c.contacts ?? [])].map((row) => ({ ...row })));
    const p = c.payment;
    this.payHasCredit.set(boolToYesNo(p?.hasCredit ?? false));
    this.payCreditDays.set(p?.creditDays != null ? String(p.creditDays) : '');
    this.payCreditAmount.set(p?.approximateCreditAmount ?? '');
    this.payHealth.set(p?.commercialHealth ?? 'not_evaluated');
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
