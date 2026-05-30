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
  buildClientDeliveryPayload,
  commercialHealthFromUnknown,
  normalizeContacts,
  parseOptionalInt,
  validateClientDelivery,
  yesNoToBool,
} from '@features/clients/utils/client-payload';
import { ClientsFeatureService } from '@features/clients/services/clients.service';
import {
  CLIENT_COMMERCIAL_HEALTH_OPTIONS,
  CLIENT_YES_NO_OPTIONS,
} from '@shared/catalogs/client-form-options';
import { TRIP_MANEUVER_PAYMENT_METHOD_OPTIONS } from '@shared/catalogs/trip-client-payment-options';
import type { Client, CreateClientPayload } from '@shared/models/client.models';
import { ClientContactInlineFieldsComponent } from '../client-contact-inline-fields/client-contact-inline-fields.component';
import { ClientDeliveryLocationFieldsComponent } from '../client-delivery-location-fields/client-delivery-location-fields.component';
import { ClientFiscalFieldsComponent } from '../client-fiscal-fields/client-fiscal-fields.component';
import { ClientIdentificationFieldsComponent } from '../client-identification-fields/client-identification-fields.component';
import { ClientPayFieldsComponent } from '../client-pay-fields/client-pay-fields.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToSelectOption } from '@shared/ui/to-select/to-select.component';

@Component({
  selector: 'app-clients-new-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToSideDrawerComponent,
    ClientContactInlineFieldsComponent,
    ClientDeliveryLocationFieldsComponent,
    ClientFiscalFieldsComponent,
    ClientIdentificationFieldsComponent,
    ClientPayFieldsComponent,
    FormsModule,
    ToButtonComponent,
    ToIconComponent,
  ],
  templateUrl: './clients-new-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    './clients-new-drawer.component.scss',
  ],
})
export class ClientsNewDrawerComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly clientsFeature = inject(ClientsFeatureService);
  private readonly toast = inject(ToastService);

  readonly dismiss = output<void>();
  readonly drawerLoading = signal(true);
  readonly saved = output<Client>();

  readonly yesNoOptions: ToSelectOption[] = CLIENT_YES_NO_OPTIONS;
  readonly healthOptions: ToSelectOption[] = CLIENT_COMMERCIAL_HEALTH_OPTIONS;
  readonly paymentMethodOptions: ToSelectOption[] = TRIP_MANEUVER_PAYMENT_METHOD_OPTIONS;

  readonly name = model('');
  readonly rfc = model('');
  readonly relationshipStartedOn = model('');
  readonly notes = model('');

  readonly billLegal = model('');
  readonly billRegime = model('');
  readonly billZip = model('');
  readonly billCfdi = model('');
  readonly billEmail = model('');
  readonly billPhone = model('');

  readonly showDeliveryForm = signal(false);
  readonly deliveryCp = model('');
  readonly deliveryCity = model('');
  readonly deliveryLocality = model('');
  readonly deliverySettlementConsId = model('');
  readonly deliveryLatitude = model<number | null>(null);
  readonly deliveryLongitude = model<number | null>(null);

  readonly showContactForm = signal(false);
  readonly contactName = model('');
  readonly contactRole = model('');
  readonly contactPhone = model('');
  readonly contactEmail = model('');

  readonly payHasCredit = model('no');
  readonly payCreditDays = model('');
  readonly payCreditAmount = model('');
  readonly payHealth = model('not_evaluated');
  readonly payDefaultPaymentMethod = model('');

  constructor() {
    afterNextRender(() => this.drawerLoading.set(false));
  }

  openContactForm(): void {
    this.showContactForm.set(true);
  }

  openDeliveryForm(): void {
    this.showDeliveryForm.set(true);
  }

  cancelDeliveryForm(): void {
    this.deliveryCp.set('');
    this.deliveryCity.set('');
    this.deliveryLocality.set('');
    this.deliverySettlementConsId.set('');
    this.deliveryLatitude.set(null);
    this.deliveryLongitude.set(null);
    this.showDeliveryForm.set(false);
  }

  cancelContactForm(): void {
    this.contactName.set('');
    this.contactRole.set('');
    this.contactPhone.set('');
    this.contactEmail.set('');
    this.showContactForm.set(false);
  }

  submit(): void {
    const nameText = this.name().trim();
    if (!nameText) {
      this.toast.show('Indica la razón social o nombre del cliente.', 'warning');
      return;
    }
    const rel = this.relationshipStartedOn().trim();

    const hasCr = yesNoToBool(this.payHasCredit());
    const days = parseOptionalInt(this.payCreditDays());
    if (hasCr && (days === undefined || days <= 0)) {
      this.toast.show(
        'Si el cliente tiene crédito, indica los días de plazo (mayor a 0).',
        'warning',
      );
      return;
    }

    const deliveryCp = this.deliveryCp().trim();
    const deliveryErr = deliveryCp
      ? validateClientDelivery({
          postalCode: deliveryCp,
          locality: this.deliveryLocality(),
          settlementConsId: this.deliverySettlementConsId(),
          latitude: this.deliveryLatitude(),
          longitude: this.deliveryLongitude(),
        })
      : null;
    if (deliveryErr) {
      this.toast.show(deliveryErr, 'warning');
      return;
    }

    const contactName = this.contactName().trim();
    const contactRole = this.contactRole().trim();
    const contactPhone = this.contactPhone().trim();
    const contactEmail = this.contactEmail().trim();

    const billing = {
      invoiceLegalName: this.billLegal().trim() || undefined,
      taxRegime: this.billRegime().trim() || undefined,
      fiscalZip: this.billZip().trim() || undefined,
      cfdiUse: this.billCfdi().trim() || undefined,
      billingEmail: this.billEmail().trim() || undefined,
      billingPhone: this.billPhone().trim() || undefined,
    };
    const hasBilling = Object.values(billing).some((v) => v != null && String(v).trim() !== '');

    const payload: CreateClientPayload = {
      name: nameText,
      ...(this.rfc().trim() ? { rfc: this.rfc().trim() } : {}),
      ...(rel ? { relationshipStartedOn: rel } : {}),
      notes: this.notes().trim() || undefined,
      ...(hasBilling ? { billing } : {}),
      ...(deliveryCp && !deliveryErr
        ? {
            delivery: buildClientDeliveryPayload({
              postalCode: deliveryCp,
              cityMunicipality: this.deliveryCity(),
              locality: this.deliveryLocality(),
              settlementConsId: this.deliverySettlementConsId(),
              latitude: this.deliveryLatitude(),
              longitude: this.deliveryLongitude(),
            }),
          }
        : {}),
      contacts: contactName
        ? normalizeContacts([
            {
              id: 'ct-new',
              name: contactName,
              ...(contactRole ? { role: contactRole } : {}),
              ...(contactPhone ? { phone: contactPhone } : {}),
              ...(contactEmail ? { email: contactEmail } : {}),
            },
          ])
        : [],
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

    this.clientsFeature
      .createClient(payload)
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
