import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ToastService } from '@core/notifications/toast.service';
import {
  boolToYesNo,
  commercialHealthFromUnknown,
  normalizeContacts,
  parseOptionalInt,
  yesNoToBool,
} from '@features/clients/utils/client-payload';
import { ClientRepository } from '@shared/data/client.repository';
import {
  CLIENT_COMMERCIAL_HEALTH_OPTIONS,
  CLIENT_YES_NO_OPTIONS,
} from '@shared/catalogs/client-form-options';
import type {
  Client,
  ClientContactPerson,
  CreateClientPayload,
} from '@shared/models/client.models';
import { ClientContactInlineFieldsComponent } from '../client-contact-inline-fields/client-contact-inline-fields.component';
import { ClientFiscalFieldsComponent } from '../client-fiscal-fields/client-fiscal-fields.component';
import { ClientIdentificationFieldsComponent } from '../client-identification-fields/client-identification-fields.component';
import { ClientPayFieldsComponent } from '../client-pay-fields/client-pay-fields.component';
import { ToDrawerSkeletonComponent } from '@shared/ui/to-drawer-skeleton/to-drawer-skeleton.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';
import { ToSelectOption } from '@shared/ui/to-select/to-select.component';

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

@Component({
  selector: 'app-clients-new-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ClientContactInlineFieldsComponent,
    ClientFiscalFieldsComponent,
    ClientIdentificationFieldsComponent,
    ClientPayFieldsComponent,
    FormsModule,
    NgTemplateOutlet,
    ToButtonComponent,
    ToIconButtonComponent,
    ToDrawerSkeletonComponent,
  ],
  templateUrl: './clients-new-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    './clients-new-drawer.component.scss',
  ],
})
export class ClientsNewDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly repo = inject(ClientRepository);
  private readonly toast = inject(ToastService);

  readonly dismiss = output<void>();
  readonly drawerLoading = signal(true);
  readonly saved = output<Client>();

  readonly yesNoOptions: ToSelectOption[] = CLIENT_YES_NO_OPTIONS;
  readonly healthOptions: ToSelectOption[] = CLIENT_COMMERCIAL_HEALTH_OPTIONS;

  readonly name = model('');
  readonly rfc = model('');
  readonly relationshipStartedOn = model(todayYmd());
  readonly notes = model('');

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

  constructor() {
    this.doc.body.style.overflow = 'hidden';
    this.destroyRef.onDestroy(() => {
      this.doc.body.style.overflow = '';
    });
    afterNextRender(() => this.drawerLoading.set(false));
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

  submit(): void {
    const nameText = this.name().trim();
    if (!nameText) {
      this.toast.show('Indica la razón social o nombre del cliente.', 'warning');
      return;
    }
    if (!this.rfc().trim()) {
      this.toast.show('Indica el RFC del cliente.', 'warning');
      return;
    }
    const rel = this.relationshipStartedOn().trim();
    if (!rel) {
      this.toast.show('Indica la fecha de inicio de la relación comercial.', 'warning');
      return;
    }

    const hasCr = yesNoToBool(this.payHasCredit());
    const days = parseOptionalInt(this.payCreditDays());
    if (hasCr && (days === undefined || days <= 0)) {
      this.toast.show(
        'Si el cliente tiene crédito, indica los días de plazo (mayor a 0).',
        'warning',
      );
      return;
    }

    const payload: CreateClientPayload = {
      name: nameText,
      rfc: this.rfc().trim(),
      relationshipStartedOn: rel,
      notes: this.notes().trim() || undefined,
      billing: {
        invoiceLegalName: this.billLegal().trim() || undefined,
        taxRegime: this.billRegime().trim() || undefined,
        fiscalZip: this.billZip().trim() || undefined,
        cfdiUse: this.billCfdi().trim() || undefined,
        billingEmail: this.billEmail().trim() || undefined,
        billingPhone: this.billPhone().trim() || undefined,
      },
      contacts: normalizeContacts(this.contacts()),
      payment: {
        hasCredit: hasCr,
        ...(hasCr && days != null ? { creditDays: days } : {}),
        ...(hasCr && this.payCreditAmount().trim()
          ? { approximateCreditAmount: this.payCreditAmount().trim() }
          : {}),
        commercialHealth: commercialHealthFromUnknown(this.payHealth()),
      },
    };

    this.repo
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (row) => {
          this.toast.show('Cliente registrado.', 'success');
          this.saved.emit(row);
          this.dismiss.emit();
        },
        error: () => this.toast.show('No se pudo guardar el cliente.', 'error'),
      });
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }
}
