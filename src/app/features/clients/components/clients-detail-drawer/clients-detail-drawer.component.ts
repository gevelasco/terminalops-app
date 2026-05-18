import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { ManiobraRepository } from '@features/maniobra/data/maniobra.repository';
import {
  boolToYesNo,
  commercialHealthFromUnknown,
  normalizeContacts,
  parseOptionalInt,
  yesNoToBool,
} from '@features/clients/utils/client-payload';
import { ClientContactInlineFieldsComponent } from '../client-contact-inline-fields/client-contact-inline-fields.component';
import { ClientFiscalFieldsComponent } from '../client-fiscal-fields/client-fiscal-fields.component';
import { ClientIdentificationFieldsComponent } from '../client-identification-fields/client-identification-fields.component';
import { ClientPayFieldsComponent } from '../client-pay-fields/client-pay-fields.component';
import { buildClientBalanceSummary } from '@features/clients/utils/client-balance-summary';
import { buildClientManeuverVolumeSummary } from '@features/clients/utils/client-maneuver-volume-summary';
import { ClientRepository } from '@shared/data/client.repository';
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
import { ToBadgeComponent, type ToBadgeVariant } from '@shared/ui/to-badge/to-badge.component';
import { ToDrawerSkeletonComponent } from '@shared/ui/to-drawer-skeleton/to-drawer-skeleton.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';
import type { ClientPaymentDueBadgeVariant } from '@features/clients/utils/client-balance-summary';
import { ToSelectOption } from '@shared/ui/to-select/to-select.component';

type ClientDetailEditSection = 'ident' | 'fiscal' | 'contacts' | 'pay';
type ClientDrawerTab = 'details' | 'balance';

@Component({
  selector: 'app-clients-detail-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ClientContactInlineFieldsComponent,
    ClientFiscalFieldsComponent,
    ClientIdentificationFieldsComponent,
    ClientPayFieldsComponent,
    FormsModule,
    NgTemplateOutlet,
    ToBadgeComponent,
    ToButtonComponent,
    ToIconButtonComponent,
    ToDrawerSkeletonComponent,
  ],
  templateUrl: './clients-detail-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
    './clients-detail-drawer.component.scss',
  ],
})
export class ClientsDetailDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly repo = inject(ClientRepository);
  private readonly maniobrasRepo = inject(ManiobraRepository);
  private readonly toast = inject(ToastService);

  readonly client = input.required<Client>();

  private readonly tripsSignal = signal<readonly Trip[]>([]);
  readonly drawerLoading = signal(true);

  readonly dismiss = output<void>();
  readonly clientChange = output<Client>();

  readonly drawerTab = signal<ClientDrawerTab>('balance');
  readonly editingSection = signal<ClientDetailEditSection | null>(null);
  readonly saving = signal(false);

  readonly yesNoOptions: ToSelectOption[] = CLIENT_YES_NO_OPTIONS;
  readonly healthOptions: ToSelectOption[] = CLIENT_COMMERCIAL_HEALTH_OPTIONS;

  readonly editName = model('');
  readonly editRfc = model('');
  readonly editRelationshipStartedOn = model('');
  readonly editNotes = model('');

  readonly billLegal = model('');
  readonly billRegime = model('');
  readonly billZip = model('');
  readonly billCfdi = model('');
  readonly billEmail = model('');
  readonly billPhone = model('');

  readonly contacts = signal<ClientContactPerson[]>([]);

  readonly addingContact = signal(false);
  readonly newContactName = model('');
  readonly newContactRole = model('');
  readonly newContactPhone = model('');
  readonly newContactEmail = model('');

  readonly payHasCredit = model('no');
  readonly payCreditDays = model('');
  readonly payCreditAmount = model('');
  readonly payHealth = model('not_evaluated');

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
    this.doc.body.style.overflow = 'hidden';
    this.destroyRef.onDestroy(() => {
      this.doc.body.style.overflow = '';
    });

    effect(() => {
      const c = this.client();
      this.patchFormFromClient(c);
      this.drawerTab.set('balance');
      this.editingSection.set(null);
      this.cancelContactForm();
    });

    effect((onCleanup) => {
      this.client();
      this.drawerLoading.set(true);
      const sub = this.maniobrasRepo
        .list()
        .pipe(catchError(() => of([] as Trip[])))
        .subscribe((trips) => {
          this.tripsSignal.set(trips);
          this.drawerLoading.set(false);
        });
      onCleanup(() => sub.unsubscribe());
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key !== 'Escape') {
      return;
    }
    if (this.editingSection() !== null) {
      ev.preventDefault();
      this.cancelSectionEdit();
      return;
    }
    this.dismiss.emit();
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

  /** Total de filas de maniobra/viaje con este cliente en los datos actuales. */
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
    this.repo
      .update(updated)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (row) => {
          this.saving.set(false);
          this.toast.show('Cliente actualizado.', 'success');
          this.clientChange.emit(row);
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
