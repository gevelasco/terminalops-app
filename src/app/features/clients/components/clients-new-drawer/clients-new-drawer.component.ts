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
import { catchError, forkJoin, of, switchMap, throwError } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { ClientsService as ClientsApiService } from '@core/services/api/clients';
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
  isSameClientDeliveryLocation,
} from '@features/clients/utils/client-deliveries';
import { clientDeliveryRouteStatusLabel } from '@features/clients/utils/client-delivery-route-link';
import { ClientsFeatureService } from '@features/clients/services/clients.service';
import { COMMERCIAL_HANDSHAKE_ICON_SRC } from '@shared/constants/commercial-handshake-icon';
import { CLIENT_YES_NO_OPTIONS } from '@shared/catalogs/client-form-options';
import { TRIP_MANEUVER_PAYMENT_METHOD_OPTIONS } from '@shared/catalogs/trip-client-payment-options';
import type {
  Client,
  ClientDelivery,
  CreateClientPayload,
} from '@shared/models/client.models';
import { beginInFlight } from '@shared/utils/in-flight-guard';
import { ClientContactInlineFieldsComponent } from '../client-contact-inline-fields/client-contact-inline-fields.component';
import { ClientDeliveryLocationFieldsComponent } from '../client-delivery-location-fields/client-delivery-location-fields.component';
import { ClientFiscalFieldsComponent } from '../client-fiscal-fields/client-fiscal-fields.component';
import { ClientIdentificationFieldsComponent } from '../client-identification-fields/client-identification-fields.component';
import { ClientPayFieldsComponent } from '../client-pay-fields/client-pay-fields.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';
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
    ToIconButtonComponent,
  ],
  templateUrl: './clients-new-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    './clients-new-drawer.component.scss',
  ],
})
export class ClientsNewDrawerComponent {
  protected readonly commercialHandshakeIconSrc = COMMERCIAL_HANDSHAKE_ICON_SRC;

  private readonly destroyRef = inject(DestroyRef);
  private readonly clientsFeature = inject(ClientsFeatureService);
  private readonly clientsApi = inject(ClientsApiService);
  private readonly toast = inject(ToastService);

  readonly dismiss = output<void>();
  readonly drawerLoading = signal(true);
  readonly saved = output<Client>();
  readonly saving = signal(false);

  readonly yesNoOptions: ToSelectOption[] = CLIENT_YES_NO_OPTIONS;
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
  readonly filesFiscal = signal<File[]>([]);

  readonly showDeliveryForm = signal(false);
  readonly deliveries = signal<ClientDelivery[]>([]);
  readonly deliveryCp = model('');
  readonly deliveryCity = model('');
  readonly deliveryLocality = model('');
  readonly deliverySettlementConsId = model('');
  readonly deliveryLatitude = model<number | null>(null);
  readonly deliveryLongitude = model<number | null>(null);
  readonly deliveryDestinationRateId = model<string | null>(null);
  readonly deliveryIsUnpricedRoute = model(false);

  readonly showContactForm = signal(false);
  readonly contactName = model('');
  readonly contactRole = model('');
  readonly contactPhone = model('');
  readonly contactEmail = model('');

  readonly payHasCredit = model('no');
  readonly payCreditDays = model('');
  readonly payCreditAmount = model('');
  readonly payDefaultPaymentMethod = model('');

  constructor() {
    afterNextRender(() => this.drawerLoading.set(false));
  }

  openContactForm(): void {
    this.showContactForm.set(true);
  }

  openDeliveryForm(): void {
    this.resetDeliveryFormFields();
    this.showDeliveryForm.set(true);
  }

  cancelDeliveryForm(): void {
    this.resetDeliveryFormFields();
    this.showDeliveryForm.set(false);
  }

  commitDelivery(): boolean {
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
      return false;
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
      return false;
    }
    const duplicate = this.deliveries().some((row) =>
      isSameClientDeliveryLocation(row, delivery),
    );
    if (duplicate) {
      this.toast.show('Esa ubicación de entrega ya está registrada.', 'warning');
      return false;
    }
    const id = `dlv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.deliveries.update((list) => [...list, { ...delivery, id }]);
    this.cancelDeliveryForm();
    return true;
  }

  removeDelivery(id: string): void {
    this.deliveries.update((list) => list.filter((row) => row.id !== id));
  }

  deliveryRouteLinkLabel(delivery: ClientDelivery): string {
    return clientDeliveryRouteStatusLabel(delivery);
  }

  private resetDeliveryFormFields(): void {
    this.deliveryCp.set('');
    this.deliveryCity.set('');
    this.deliveryLocality.set('');
    this.deliverySettlementConsId.set('');
    this.deliveryLatitude.set(null);
    this.deliveryLongitude.set(null);
    this.deliveryDestinationRateId.set(null);
    this.deliveryIsUnpricedRoute.set(false);
  }

  cancelContactForm(): void {
    this.contactName.set('');
    this.contactRole.set('');
    this.contactPhone.set('');
    this.contactEmail.set('');
    this.showContactForm.set(false);
  }

  onDocumentsSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    if (!list.length) {
      return;
    }
    this.filesFiscal.update((prev) => [...prev, ...list]);
    input.value = '';
  }

  removeDocument(index: number): void {
    this.filesFiscal.update((prev) => prev.filter((_, i) => i !== index));
  }

  submit(): void {
    if (this.saving()) {
      return;
    }
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
    if (this.showDeliveryForm() && deliveryCp) {
      if (!this.commitDelivery()) {
        return;
      }
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

    const pendingUploads = this.filesFiscal();
    const deliveryList = normalizeDeliveries(this.deliveries());

    const payload: CreateClientPayload = {
      name: nameText,
      ...(this.rfc().trim() ? { rfc: this.rfc().trim() } : {}),
      ...(rel ? { relationshipStartedOn: rel } : {}),
      notes: this.notes().trim() || undefined,
      ...(hasBilling ? { billing } : {}),
      deliveries: deliveryList,
      ...(deliveryList[0] ? { delivery: deliveryList[0] } : {}),
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
        defaultPaymentMethod: this.payDefaultPaymentMethod().trim() || undefined,
      },
    };

    if (!beginInFlight(this.saving)) {
      return;
    }
    this.clientsFeature
      .createClient(payload)
      .pipe(
        switchMap((created) => {
          if (pendingUploads.length === 0) {
            return of(created);
          }
          return forkJoin(
            pendingUploads.map((file) =>
              this.clientsApi.uploadClientDocument(created.id, 'fiscal', file),
            ),
          ).pipe(
            switchMap(() => of(created)),
            catchError(() =>
              throwError(() => ({
                phase: 'documents' as const,
                clientId: created.id,
              })),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (row) => {
          if (pendingUploads.length > 0) {
            this.clientsFeature.refreshClientById(row.id);
          }
          this.saving.set(false);
          this.toast.show(
            pendingUploads.length > 0
              ? 'Cliente y documentos registrados.'
              : 'Cliente registrado.',
            'success',
          );
          this.saved.emit(row);
          this.dismiss.emit();
        },
        error: (err: unknown) => {
          const docsFailed =
            typeof err === 'object' &&
            err !== null &&
            'phase' in err &&
            (err as { phase?: string }).phase === 'documents';
          if (docsFailed) {
            this.toast.show(
              'El cliente se creó, pero no se pudieron subir los documentos. Ábrelo y súbelos de nuevo.',
              'error',
            );
            this.clientsFeature.refreshClientById(
              String((err as { clientId?: string }).clientId ?? ''),
            );
            this.saving.set(false);
            this.dismiss.emit();
            return;
          }
          this.saving.set(false);
          this.toast.show('No se pudo guardar el cliente.', 'error');
        },
      });
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }
}
