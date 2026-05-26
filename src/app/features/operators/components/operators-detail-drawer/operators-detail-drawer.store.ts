import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService } from '@core/notifications/toast.service';
import { buildOperatorOperationSummary } from '@features/operators/utils/operator-operation-summary';
import { mergeOperatorNested } from '@features/operators/utils/operator-payload-defaults';
import { companyTenureLabelEs } from '@features/operators/utils/operator-company-tenure';
import { filesToOperatorDocuments } from '@features/operators/utils/operator-attached-documents';
import {
  operatorHasPhoto,
  operatorPhotoInitials,
} from '@features/operators/utils/operator-photo';
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
import { operatorOperationalStatusMod } from '@shared/utils/operator-operational-pill';
import type { ClientPaymentDueBadgeVariant } from '@features/clients/utils/client-balance-summary';
import type {
  Expense,
  Operator,
  OperatorAttachedDocument,
  OperatorDocumentSlot,
  OperatorInsuranceKind,
  OperatorLicenseType,
  OperatorOperationalStatus,
  Trip,
  Unit,
} from '@shared/models/logistics.models';
import { type ToBadgeVariant } from '@shared/ui/to-badge/to-badge.component';
import { type ToSegmentTab } from '@shared/ui/to-segment-control/to-segment-control.component';
import { OperatorsService } from '@services/api/operators';

export type OperatorEditSection = 'ident' | 'operation' | 'contact' | 'coverage';
export type OperatorDrawerTab = 'details' | 'operation';

export interface OperatorsDetailDrawerHostInputs {
  operator: Operator;
}

export interface OperatorsDetailDrawerHostCallbacks {
  dismiss: () => void;
  operatorChange: (operator: Operator) => void;
}

@Injectable()
export class OperatorsDetailDrawerStore {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly operatorsApi = inject(OperatorsService);
  private readonly toast = inject(ToastService);

  private hostCallbacks: OperatorsDetailDrawerHostCallbacks | null = null;

  private readonly operatorSource = signal<Operator | null>(null);
  private readonly tripsSignal = signal<readonly Trip[]>([]);
  private readonly expensesSignal = signal<readonly Expense[]>([]);
  private readonly unitsSignal = signal<readonly Unit[]>([]);

  readonly operator = computed(() => this.operatorSource()!);

  readonly drawerLoading = signal(false);
  readonly drawerTab = signal<OperatorDrawerTab>('operation');
  readonly drawerSegmentTabs: readonly ToSegmentTab<OperatorDrawerTab>[] = [
    {
      id: 'details',
      label: 'Detalles',
      icon: 'document',
      htmlId: 'operators-detail-tab-details',
    },
    {
      id: 'operation',
      label: 'Operación',
      icon: 'updates',
      htmlId: 'operators-detail-tab-operation',
    },
  ];
  readonly editingSection = signal<OperatorEditSection | null>(null);
  readonly saving = signal(false);

  readonly editName = signal('');
  readonly editBirthDate = signal('');
  readonly editCurp = signal('');
  readonly editRfc = signal('');
  readonly editLicenseNumber = signal('');
  readonly editLicenseExpiresOn = signal('');
  readonly editLicenseType = signal<OperatorLicenseType>('unspecified');
  readonly editLicenseEndorsements = signal('');
  readonly editPhone = signal('');
  readonly editPhoneSecondary = signal('');
  readonly editAddress = signal('');
  readonly editPhotoDataUrl = signal('');
  readonly editCompanyHireDate = signal('');
  readonly editEmploymentContractType = signal('');
  readonly editStatus = signal<OperatorOperationalStatus>('available');

  readonly editEcName = signal('');
  readonly editEcRelationship = signal('');
  readonly editEcPhone = signal('');
  readonly editEcEmail = signal('');
  readonly editEcAuthMedical = signal(false);

  readonly editInsuranceKind = signal<OperatorInsuranceKind>('none');
  readonly editPubNss = signal('');
  readonly editPubImssAlta = signal('');
  readonly editPubInfonavit = signal(false);
  readonly editPubInfonavitCredit = signal('');
  readonly editPubFonacot = signal(false);
  readonly editPubFonacotCredit = signal('');
  readonly editPubNotes = signal('');

  readonly editPrivCarrier = signal('');
  readonly editPrivPolicy = signal('');
  readonly editPrivValidFrom = signal('');
  readonly editPrivValidTo = signal('');
  readonly editPrivPremium = signal('');
  readonly editPrivPremiumPeriod = signal('');
  readonly editPrivDeductible = signal('');
  readonly editPrivPlan = signal('');

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

  readonly operationSummary = computed(() =>
    buildOperatorOperationSummary(
      this.operator().id,
      this.tripsSignal(),
      this.expensesSignal(),
      this.unitsSignal(),
    ),
  );

  private readonly mxMoney0 = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  });

  bindHost(
    inputs: OperatorsDetailDrawerHostInputs,
    callbacks: OperatorsDetailDrawerHostCallbacks,
  ): void {
    const priorId = this.operatorSource()?.id;
    this.hostCallbacks = callbacks;
    this.operatorSource.set(inputs.operator);
    this.patchFormFromOperator(inputs.operator);
    if (priorId !== inputs.operator.id) {
      this.drawerTab.set('operation');
      this.editingSection.set(null);
    }
  }

  markReady(): void {
    this.drawerLoading.set(false);
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

  operatorStatusMod(): string {
    return operatorOperationalStatusMod(this.operator().status);
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

  operatorPhotoVisible(): boolean {
    return operatorHasPhoto(this.operator().photoDataUrl);
  }

  operatorPhotoInitialsLabel(): string {
    return operatorPhotoInitials(this.operator().name);
  }

  operationMoney(value: number): string {
    return this.mxMoney0.format(value);
  }

  payDueBadgeVariant(v: ClientPaymentDueBadgeVariant): ToBadgeVariant {
    return v;
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

  selectDrawerTab(tab: OperatorDrawerTab): void {
    if (this.drawerTab() === tab) {
      return;
    }
    this.cancelSectionEdit();
    this.drawerTab.set(tab);
  }

  startEditSection(section: OperatorEditSection): void {
    this.patchFormFromOperator(this.operator());
    this.drawerTab.set(section === 'operation' ? 'operation' : 'details');
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

  downloadOperatorDocument(_d: OperatorAttachedDocument): void {
    this.toast.show('La descarga de documentos estará disponible con la API de archivos.', 'info');
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
      photoDataUrl: this.editPhotoDataUrl().trim(),
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
      status: this.editStatus(),
      companyHireDate,
      employmentContractType: this.editEmploymentContractType().trim(),
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
    this.operatorsApi
      .patchOperatorById(updated)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (op) => {
          this.saving.set(false);
          this.toast.show('Cambios guardados.', 'success');
          this.hostCallbacks?.operatorChange(op);
          this.operatorSource.set(op);
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
    this.editPhotoDataUrl.set(o.photoDataUrl ?? '');
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
