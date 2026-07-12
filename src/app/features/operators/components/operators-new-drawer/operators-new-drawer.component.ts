import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { OperatorsFeatureService } from '@features/operators/services/operators.service';
import { mergeOperatorNested } from '@features/operators/utils/operator-payload-defaults';
import { filesToOperatorDocuments } from '@features/operators/utils/operator-attached-documents';
import { EXPENSE_PAYMENT_METHOD_OPTIONS } from '@shared/catalogs/expense-form-options';
import {
  OPERATOR_EMPLOYMENT_CONTRACT_OPTIONS,
  OPERATOR_INSURANCE_KIND_OPTIONS,
  OPERATOR_LICENSE_TYPE_OPTIONS,
  OPERATOR_PAYMENT_SCHEDULE_OPTIONS,
  OPERATOR_PREMIUM_PERIOD_OPTIONS,
  OPERATOR_RELATIONSHIP_OPTIONS,
} from '@shared/catalogs/operator-form-options';
import type {
  Operator,
  OperatorAttachedDocument,
  OperatorDocumentSlot,
  OperatorInsuranceKind,
  OperatorLicenseType,
  OperatorPaymentSchedule,
} from '@shared/models/logistics.models';
import { OperatorCoverageFieldsComponent } from '../operator-coverage-fields/operator-coverage-fields.component';
import { OperatorEmergencyContactFieldsComponent } from '../operator-emergency-contact-fields/operator-emergency-contact-fields.component';
import { OperatorIdentificationFieldsComponent } from '../operator-identification-fields/operator-identification-fields.component';
import { OperatorOperationFieldsComponent } from '../operator-operation-fields/operator-operation-fields.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}
@Component({
  selector: 'app-operators-new-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToSideDrawerComponent,
    FormsModule,
    
    OperatorCoverageFieldsComponent,
    OperatorEmergencyContactFieldsComponent,
    OperatorIdentificationFieldsComponent,
    OperatorOperationFieldsComponent,
    ToButtonComponent,
    ToIconComponent,
  ],
  templateUrl: './operators-new-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    './operators-new-drawer.component.scss',
  ],
})
export class OperatorsNewDrawerComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly operatorsFeature = inject(OperatorsFeatureService);
  private readonly toast = inject(ToastService);

  readonly dismiss = output<void>();
  readonly drawerLoading = signal(true);
  readonly saved = output<Operator>();

  readonly name = model('');
  readonly birthDate = model('');
  readonly curp = model('');
  readonly rfc = model('');
  readonly licenseNumber = model('');
  readonly licenseExpiresOn = model('');
  readonly licenseType = model<OperatorLicenseType>('unspecified');
  readonly licenseEndorsements = model('');
  readonly phone = model('');
  readonly phoneSecondary = model('');
  readonly address = model('');
  readonly photoDataUrl = model('');
  readonly companyHireDate = model(todayYmd());
  readonly employmentContractType = model('');
  readonly paymentSchedule = model<OperatorPaymentSchedule>('maneuver');
  readonly paymentMethod = model('');

  readonly ecName = model('');
  readonly ecRelationship = model('');
  readonly ecPhone = model('');
  readonly ecEmail = model('');
  readonly ecAuthMedical = model(false);

  readonly insuranceKind = model<OperatorInsuranceKind>('none');
  readonly pubNss = model('');
  readonly pubImssAlta = model('');
  readonly pubInfonavit = model(false);
  readonly pubInfonavitCredit = model('');
  readonly pubFonacot = model(false);
  readonly pubFonacotCredit = model('');
  readonly pubNotes = model('');

  readonly privCarrier = model('');
  readonly privPolicy = model('');
  readonly privValidFrom = model('');
  readonly privValidTo = model('');
  readonly privPremium = model('');
  readonly privPremiumPeriod = model('');
  readonly privDeductible = model('');
  readonly privPlan = model('');

  readonly documents = signal<OperatorAttachedDocument[]>([]);

  readonly operationDocuments = computed(() =>
    this.documents().filter((d) => d.slot === 'operation'),
  );
  readonly insuranceDocuments = computed(() =>
    this.documents().filter((d) => d.slot === 'insurance'),
  );

  readonly saving = signal(false);

  readonly licenseTypeOptions = OPERATOR_LICENSE_TYPE_OPTIONS;
  readonly insuranceKindOptions = OPERATOR_INSURANCE_KIND_OPTIONS;
  readonly relationshipOptions = OPERATOR_RELATIONSHIP_OPTIONS;
  readonly premiumPeriodOptions = OPERATOR_PREMIUM_PERIOD_OPTIONS;
  readonly employmentContractOptions = OPERATOR_EMPLOYMENT_CONTRACT_OPTIONS;
  readonly paymentScheduleOptions = OPERATOR_PAYMENT_SCHEDULE_OPTIONS;
  readonly paymentMethodOptions = EXPENSE_PAYMENT_METHOD_OPTIONS;

  constructor() {
    afterNextRender(() => this.drawerLoading.set(false));
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }

  onDocumentsSelected(ev: Event, slot: OperatorDocumentSlot): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    if (!list.length) {
      return;
    }
    this.documents.update((prev) => [
      ...prev,
      ...filesToOperatorDocuments(list, slot),
    ]);
    input.value = '';
  }

  removeDocument(id: string): void {
    this.documents.update((prev) => prev.filter((d) => d.id !== id));
  }

  submit(): void {
    const name = this.name().trim();
    const licenseNumber = this.licenseNumber().trim().toUpperCase();
    const licenseExpiresOn = this.licenseExpiresOn().trim();
    const phone = this.phone().trim();
    const birthDate = this.birthDate().trim();
    const curp = this.curp().trim().toUpperCase();
    const rfc = this.rfc().trim().toUpperCase();

    if (!name) {
      this.toast.show('Indica el nombre del operador.', 'warning');
      return;
    }
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      this.toast.show('La fecha de nacimiento debe ser AAAA-MM-DD.', 'warning');
      return;
    }
    const companyHireDate = this.companyHireDate().trim();
    if (companyHireDate && !/^\d{4}-\d{2}-\d{2}$/.test(companyHireDate)) {
      this.toast.show(
        'La fecha de ingreso a la empresa debe ser AAAA-MM-DD.',
        'warning',
      );
      return;
    }
    if (curp && curp.length !== 18) {
      this.toast.show('El CURP debe tener 18 caracteres.', 'warning');
      return;
    }
    if (rfc && rfc.length < 10) {
      this.toast.show('El RFC no parece válido.', 'warning');
      return;
    }
    if (!licenseNumber) {
      this.toast.show('Indica el número de licencia.', 'warning');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(licenseExpiresOn)) {
      this.toast.show('La vigencia de licencia debe ser AAAA-MM-DD.', 'warning');
      return;
    }

    const payload: Omit<Operator, 'id'> = mergeOperatorNested({
      name,
      birthDate,
      curp,
      rfc,
      licenseNumber,
      licenseExpiresOn,
      licenseType: this.licenseType(),
      licenseEndorsements: this.licenseEndorsements().trim(),
      phone,
      phoneSecondary: this.phoneSecondary().trim(),
      address: this.address().trim(),
      photoDataUrl: this.photoDataUrl().trim(),
      companyHireDate,
      employmentContractType: this.employmentContractType().trim(),
      paymentSchedule: this.paymentSchedule(),
      paymentMethod: this.paymentMethod().trim() || undefined,
      emergencyContact: {
        name: this.ecName().trim(),
        relationship: this.ecRelationship().trim(),
        phone: this.ecPhone().trim(),
        email: this.ecEmail().trim(),
        authorizedMedicalInfo: this.ecAuthMedical(),
      },
      insuranceKind: this.insuranceKind(),
      publicInsurance: {
        nss: this.pubNss().trim(),
        imssAltaDate: this.pubImssAlta().trim(),
        infonavit: this.pubInfonavit(),
        infonavitCreditNumber: this.pubInfonavitCredit().trim(),
        fonacot: this.pubFonacot(),
        fonacotCreditNumber: this.pubFonacotCredit().trim(),
        notes: this.pubNotes().trim(),
      },
      privateInsurance: {
        carrier: this.privCarrier().trim(),
        policyNumber: this.privPolicy().trim(),
        validFrom: this.privValidFrom().trim(),
        validTo: this.privValidTo().trim(),
        premiumAmount: this.privPremium().trim(),
        premiumPeriod: this.privPremiumPeriod() as Operator['privateInsurance']['premiumPeriod'],
        deductibleNotes: this.privDeductible().trim(),
        planSummary: this.privPlan().trim(),
      },
      documents: [...this.documents()],
    }) as Omit<Operator, 'id'>;

    this.saving.set(true);
    this.operatorsFeature
      .createOperator(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (op) => {
          this.saving.set(false);
          this.toast.show('Operador registrado.', 'success');
          this.saved.emit(op);
          this.dismiss.emit();
        },
        error: () => {
          this.toast.show('No se pudo guardar el operador.', 'error');
          this.saving.set(false);
        },
      });
  }
}
