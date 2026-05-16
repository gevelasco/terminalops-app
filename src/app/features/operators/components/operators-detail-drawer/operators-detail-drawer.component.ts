import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
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
import { ToastService } from '@core/notifications/toast.service';
import { OperatorRepository } from '@features/operators/data/operator.repository';
import { downloadMockFleetDocument } from '@features/fleet/utils/fleet-mock-document-download';
import { mergeOperatorNested } from '@features/operators/utils/operator-payload-defaults';
import { companyTenureLabelEs } from '@features/operators/utils/operator-company-tenure';
import { filesToOperatorDocuments } from '@features/operators/utils/operator-attached-documents';
import {
  OPERATOR_EMPLOYMENT_CONTRACT_OPTIONS,
  OPERATOR_INSURANCE_KIND_OPTIONS,
  OPERATOR_LICENSE_TYPE_OPTIONS,
  OPERATOR_OPERATIONAL_STATUS_OPTIONS,
  OPERATOR_PREMIUM_PERIOD_OPTIONS,
  OPERATOR_RELATIONSHIP_OPTIONS,
  operatorEmploymentContractLabel,
  operatorInsuranceKindLabel,
  operatorLicenseTypeLabel,
  operatorOperationalStatusLabel,
  operatorRelationshipLabel,
} from '@shared/catalogs/operator-form-options';
import type {
  Operator,
  OperatorAttachedDocument,
  OperatorDocumentSlot,
  OperatorInsuranceKind,
  OperatorLicenseType,
  OperatorOperationalStatus,
} from '@shared/models/logistics.models';
import { OperatorCoverageFieldsComponent } from '../operator-coverage-fields/operator-coverage-fields.component';
import { OperatorEmergencyContactFieldsComponent } from '../operator-emergency-contact-fields/operator-emergency-contact-fields.component';
import { OperatorIdentificationFieldsComponent } from '../operator-identification-fields/operator-identification-fields.component';
import { OperatorOperationFieldsComponent } from '../operator-operation-fields/operator-operation-fields.component';
import { ToDrawerSkeletonComponent } from '@shared/ui/to-drawer-skeleton/to-drawer-skeleton.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';

type OperatorEditSection = 'ident' | 'operation' | 'contact' | 'coverage';

@Component({
  selector: 'app-operators-detail-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    OperatorCoverageFieldsComponent,
    OperatorEmergencyContactFieldsComponent,
    OperatorIdentificationFieldsComponent,
    OperatorOperationFieldsComponent,
    ToButtonComponent,
    ToIconButtonComponent,
    ToDrawerSkeletonComponent,
  ],
  templateUrl: './operators-detail-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
    'operators-detail-drawer.component.scss',
  ],
})
export class OperatorsDetailDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly repo = inject(OperatorRepository);
  private readonly toast = inject(ToastService);

  readonly operator = input.required<Operator>();
  /** Maniobras con estado `completed` asignadas a este operador (última carga en página). */
  readonly completedManeuverCount = input(0);

  readonly dismiss = output<void>();
  readonly operatorChange = output<Operator>();

  readonly drawerLoading = signal(true);
  readonly editingSection = signal<OperatorEditSection | null>(null);
  readonly saving = signal(false);

  readonly editName = model('');
  readonly editBirthDate = model('');
  readonly editCurp = model('');
  readonly editRfc = model('');
  readonly editLicenseNumber = model('');
  readonly editLicenseExpiresOn = model('');
  readonly editLicenseType = model<OperatorLicenseType>('unspecified');
  readonly editLicenseEndorsements = model('');
  readonly editPhone = model('');
  readonly editPhoneSecondary = model('');
  readonly editAddress = model('');
  readonly editCompanyHireDate = model('');
  readonly editEmploymentContractType = model('');
  readonly editStatus = model<OperatorOperationalStatus>('available');

  readonly editEcName = model('');
  readonly editEcRelationship = model('');
  readonly editEcPhone = model('');
  readonly editEcEmail = model('');
  readonly editEcAuthMedical = model(false);

  readonly editInsuranceKind = model<OperatorInsuranceKind>('none');
  readonly editPubNss = model('');
  readonly editPubImssAlta = model('');
  readonly editPubInfonavit = model(false);
  readonly editPubInfonavitCredit = model('');
  readonly editPubFonacot = model(false);
  readonly editPubFonacotCredit = model('');
  readonly editPubNotes = model('');

  readonly editPrivCarrier = model('');
  readonly editPrivPolicy = model('');
  readonly editPrivValidFrom = model('');
  readonly editPrivValidTo = model('');
  readonly editPrivPremium = model('');
  readonly editPrivPremiumPeriod = model('');
  readonly editPrivDeductible = model('');
  readonly editPrivPlan = model('');

  readonly editDocuments = signal<OperatorAttachedDocument[]>([]);

  readonly operationDocuments = computed(() =>
    this.operator().documents.filter((d) => d.slot === 'operation'),
  );
  readonly insuranceDocuments = computed(() =>
    this.operator().documents.filter((d) => d.slot === 'insurance'),
  );

  readonly editOperationDocuments = computed(() =>
    this.editDocuments().filter((d) => d.slot === 'operation'),
  );
  readonly editInsuranceDocuments = computed(() =>
    this.editDocuments().filter((d) => d.slot === 'insurance'),
  );

  readonly statusOptions = OPERATOR_OPERATIONAL_STATUS_OPTIONS;
  readonly licenseTypeOptions = OPERATOR_LICENSE_TYPE_OPTIONS;
  readonly insuranceKindOptions = OPERATOR_INSURANCE_KIND_OPTIONS;
  readonly relationshipOptions = OPERATOR_RELATIONSHIP_OPTIONS;
  readonly premiumPeriodOptions = OPERATOR_PREMIUM_PERIOD_OPTIONS;
  readonly employmentContractOptions = OPERATOR_EMPLOYMENT_CONTRACT_OPTIONS;

  constructor() {
    this.doc.body.style.overflow = 'hidden';
    this.destroyRef.onDestroy(() => {
      this.doc.body.style.overflow = '';
    });

    afterNextRender(() => this.drawerLoading.set(false));

    effect(() => {
      this.patchFormFromOperator(this.operator());
      this.editingSection.set(null);
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

  /** Modificador de color para la franja bajo el nombre (misma convención que Flota). */
  operatorStatusMod(): string {
    switch (this.operator().status) {
      case 'available':
        return 'fleet-unit-detail__status--available';
      case 'in_use':
        return 'fleet-unit-detail__status--inuse';
      case 'scheduled':
        return 'fleet-unit-detail__status--scheduled';
      case 'maintenance':
        return 'fleet-unit-detail__status--maintenance';
      case 'on_route':
        return 'fleet-unit-detail__status--route';
      case 'incapacitated':
        return 'fleet-unit-detail__status--operator-incapacitated';
      case 'leave':
        return 'fleet-unit-detail__status--operator-leave';
      case 'inactive':
        return 'fleet-unit-detail__status--operator-inactive';
      default:
        return 'fleet-unit-detail__status--unknown';
    }
  }

  operationalStatusLabel(): string {
    return operatorOperationalStatusLabel(this.operator().status);
  }

  insuranceKindLabel(): string {
    return operatorInsuranceKindLabel(this.operator().insuranceKind);
  }

  licenseTypeLabel(): string {
    return operatorLicenseTypeLabel(this.operator().licenseType);
  }

  relationshipLabel(code: string): string {
    return operatorRelationshipLabel(code);
  }

  employmentContractLabel(code: string): string {
    return operatorEmploymentContractLabel(code);
  }

  companyHireDateLabel(): string {
    return this.displayIsoDate(this.operator().companyHireDate);
  }

  companyTenureLabel(): string {
    return companyTenureLabelEs(this.operator().companyHireDate);
  }

  premiumPeriodLabel(): string {
    const code = this.operator().privateInsurance.premiumPeriod;
    if (!code) {
      return '—';
    }
    return (
      this.premiumPeriodOptions.find((o) => o.value === code)?.label ?? '—'
    );
  }

  licenseExpiresLabel(): string {
    return this.displayIsoDate(this.operator().licenseExpiresOn);
  }

  birthDateLabel(): string {
    return this.displayIsoDate(this.operator().birthDate);
  }

  displayIsoDate(iso: string): string {
    const t = iso.trim();
    if (!t) {
      return '—';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      return iso;
    }
    const d = new Date(t + 'T12:00:00');
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(d);
  }

  startEditSection(section: OperatorEditSection): void {
    this.patchFormFromOperator(this.operator());
    this.editingSection.set(section);
  }

  cancelSectionEdit(): void {
    this.patchFormFromOperator(this.operator());
    this.editingSection.set(null);
  }

  onEditDocumentsSelected(ev: Event, slot: OperatorDocumentSlot): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    if (!list.length) {
      return;
    }
    this.editDocuments.update((prev) => [
      ...prev,
      ...filesToOperatorDocuments(list, slot),
    ]);
    input.value = '';
  }

  removeEditDocument(id: string): void {
    this.editDocuments.update((prev) => prev.filter((d) => d.id !== id));
  }

  /** Demo local (misma lógica que adjuntos en Flota); en producción sustituir por URL firmada. */
  downloadOperatorDocument(d: OperatorAttachedDocument): void {
    downloadMockFleetDocument(this.doc, d.fileName);
  }

  saveIdentification(): void {
    const name = this.editName().trim();
    const birthDate = this.editBirthDate().trim();
    const curp = this.editCurp().trim().toUpperCase();
    const rfc = this.editRfc().trim().toUpperCase();
    const licenseNumber = this.editLicenseNumber().trim();
    const licenseExpiresOn = this.editLicenseExpiresOn().trim();
    const phone = this.editPhone().trim();

    if (!name) {
      this.toast.show('Indica el nombre del operador.', 'warning');
      return;
    }
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      this.toast.show('La fecha de nacimiento debe ser AAAA-MM-DD.', 'warning');
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
    if (!phone) {
      this.toast.show('Indica un teléfono de contacto.', 'warning');
      return;
    }

    const updated = mergeOperatorNested({
      ...this.operator(),
      name,
      birthDate,
      curp,
      rfc,
      licenseNumber,
      licenseExpiresOn,
      licenseType: this.editLicenseType(),
      licenseEndorsements: this.editLicenseEndorsements().trim(),
      phone,
      phoneSecondary: this.editPhoneSecondary().trim(),
      address: this.editAddress().trim(),
    }) as Operator;
    this.persistOperator(updated);
  }

  saveOperation(): void {
    const companyHireDate = this.editCompanyHireDate().trim();
    if (companyHireDate && !/^\d{4}-\d{2}-\d{2}$/.test(companyHireDate)) {
      this.toast.show(
        'La fecha de ingreso a la empresa debe ser AAAA-MM-DD.',
        'warning',
      );
      return;
    }

    const updated = mergeOperatorNested({
      ...this.operator(),
      companyHireDate,
      employmentContractType: this.editEmploymentContractType().trim(),
      status: this.editStatus(),
      documents: [...this.editDocuments()],
    }) as Operator;
    this.persistOperator(updated);
  }

  saveContact(): void {
    const updated = mergeOperatorNested({
      ...this.operator(),
      emergencyContact: {
        name: this.editEcName().trim(),
        relationship: this.editEcRelationship().trim(),
        phone: this.editEcPhone().trim(),
        email: this.editEcEmail().trim(),
        authorizedMedicalInfo: this.editEcAuthMedical(),
      },
    }) as Operator;
    this.persistOperator(updated);
  }

  saveCoverage(): void {
    const updated = mergeOperatorNested({
      ...this.operator(),
      insuranceKind: this.editInsuranceKind(),
      publicInsurance: {
        nss: this.editPubNss().trim(),
        imssAltaDate: this.editPubImssAlta().trim(),
        infonavit: this.editPubInfonavit(),
        infonavitCreditNumber: this.editPubInfonavitCredit().trim(),
        fonacot: this.editPubFonacot(),
        fonacotCreditNumber: this.editPubFonacotCredit().trim(),
        notes: this.editPubNotes().trim(),
      },
      privateInsurance: {
        carrier: this.editPrivCarrier().trim(),
        policyNumber: this.editPrivPolicy().trim(),
        validFrom: this.editPrivValidFrom().trim(),
        validTo: this.editPrivValidTo().trim(),
        premiumAmount: this.editPrivPremium().trim(),
        premiumPeriod: this.editPrivPremiumPeriod() as Operator['privateInsurance']['premiumPeriod'],
        deductibleNotes: this.editPrivDeductible().trim(),
        planSummary: this.editPrivPlan().trim(),
      },
      documents: [...this.editDocuments()],
    }) as Operator;
    this.persistOperator(updated);
  }

  private persistOperator(updated: Operator): void {
    this.saving.set(true);
    this.repo
      .update(updated)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (op) => {
          this.saving.set(false);
          this.toast.show('Cambios guardados.', 'success');
          this.operatorChange.emit(op);
          this.editingSection.set(null);
        },
        error: () => {
          this.toast.show('No se pudo guardar.', 'error');
          this.saving.set(false);
        },
      });
  }

  private patchFormFromOperator(o: Operator): void {
    this.editName.set(o.name);
    this.editBirthDate.set(o.birthDate);
    this.editCurp.set(o.curp);
    this.editRfc.set(o.rfc);
    this.editLicenseNumber.set(o.licenseNumber);
    this.editLicenseExpiresOn.set(o.licenseExpiresOn);
    this.editLicenseType.set(o.licenseType);
    this.editLicenseEndorsements.set(o.licenseEndorsements);
    this.editPhone.set(o.phone);
    this.editPhoneSecondary.set(o.phoneSecondary);
    this.editAddress.set(o.address);
    this.editCompanyHireDate.set(o.companyHireDate);
    this.editEmploymentContractType.set(o.employmentContractType);
    this.editStatus.set(o.status);
    this.editEcName.set(o.emergencyContact.name);
    this.editEcRelationship.set(o.emergencyContact.relationship);
    this.editEcPhone.set(o.emergencyContact.phone);
    this.editEcEmail.set(o.emergencyContact.email);
    this.editEcAuthMedical.set(o.emergencyContact.authorizedMedicalInfo);
    this.editInsuranceKind.set(o.insuranceKind);
    this.editPubNss.set(o.publicInsurance.nss);
    this.editPubImssAlta.set(o.publicInsurance.imssAltaDate);
    this.editPubInfonavit.set(o.publicInsurance.infonavit);
    this.editPubInfonavitCredit.set(o.publicInsurance.infonavitCreditNumber);
    this.editPubFonacot.set(o.publicInsurance.fonacot);
    this.editPubFonacotCredit.set(o.publicInsurance.fonacotCreditNumber);
    this.editPubNotes.set(o.publicInsurance.notes);
    this.editPrivCarrier.set(o.privateInsurance.carrier);
    this.editPrivPolicy.set(o.privateInsurance.policyNumber);
    this.editPrivValidFrom.set(o.privateInsurance.validFrom);
    this.editPrivValidTo.set(o.privateInsurance.validTo);
    this.editPrivPremium.set(o.privateInsurance.premiumAmount);
    this.editPrivPremiumPeriod.set(o.privateInsurance.premiumPeriod);
    this.editPrivDeductible.set(o.privateInsurance.deductibleNotes);
    this.editPrivPlan.set(o.privateInsurance.planSummary);
    this.editDocuments.set([...(o.documents ?? [])]);
  }
}
