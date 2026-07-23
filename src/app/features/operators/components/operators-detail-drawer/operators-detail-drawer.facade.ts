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
import { SessionService } from '@core/services/state/session';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { OperationalFleetSyncService } from '@core/services/state/operational-fleet-sync.service';
import { OperatorsService as OperatorsApiService } from '@services/api/operators';
import {
  mapApiOperatorOperationSummary,
  EMPTY_OPERATOR_OPERATION_SUMMARY,
  type OperatorOperationSummary,
} from '@features/operators/utils/operator-operation-summary';
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
  OPERATOR_MANUAL_STATUS_OPTIONS,
  OPERATOR_PAYMENT_SCHEDULE_OPTIONS,
  OPERATOR_PREMIUM_PERIOD_OPTIONS,
  OPERATOR_RELATIONSHIP_OPTIONS,
  operatorEmploymentContractLabel,
  operatorInsuranceKindLabel,
  operatorLicenseTypeLabel,
  operatorOperationalStatusLabel,
  operatorPaymentScheduleLabel,
  operatorRelationshipLabel,
} from '@shared/catalogs/operator-form-options';
import { FLEET_RESOURCE_VISIBILITY_OPTIONS } from '@shared/catalogs/fleet-form-options';
import { EXPENSE_PAYMENT_METHOD_OPTIONS } from '@shared/catalogs/expense-form-options';
import { expensePaymentMethodLabel } from '@features/expenses/utils/expense-row-labels';
import { fleetResourceActiveLabel } from '@shared/utils/fleet-resource-active';
import { operatorOperationalStatusMod } from '@shared/utils/operator-operational-pill';
import type { ClientPaymentDueBadgeVariant } from '@features/clients/utils/client-balance-summary';
import type {
  Operator,
  OperatorAttachedDocument,
  OperatorDocumentSlot,
  OperatorInsuranceKind,
  OperatorLicenseType,
  OperatorOperationalStatus,
  OperatorPaymentSchedule,
} from '@shared/models/logistics.models';
import { type ToBadgeVariant } from '@shared/ui/to-badge/to-badge.component';
import { type ToSegmentTab } from '@shared/ui/to-segment-control/to-segment-control.component';
import type { ToSelectOption } from '@shared/ui/to-select/to-select.component';
import { OperatorsFeatureService } from '@features/operators/services/operators.service';
import { deriveOperatorOperationalStatus } from '@features/trips/utils/trip-derived-operational-status';
import { catchError, concat, finalize, of, type Observable } from 'rxjs';

export type OperatorEditSection = 'ident' | 'operation' | 'contact' | 'coverage';
export type OperatorDrawerTab = 'details' | 'operation';

@Injectable()
export class OperatorsDetailDrawerFacade {
  private readonly destroyRef = inject(DestroyRef);
  private readonly operatorsFeature = inject(OperatorsFeatureService);
  private readonly operatorsApi = inject(OperatorsApiService);
  private readonly toast = inject(ToastService);
  private readonly operationalSync = inject(OperationalFleetSyncService);
  private readonly session = inject(SessionService);

  private dismissCallback: (() => void) | null = null;
  private readonly operationSummarySignal = signal<OperatorOperationSummary | null>(
    null,
  );
  private operationSummaryCacheKey: string | null = null;

  readonly operator = computed(() => this.operatorsFeature.selectedOperator()!);

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
  readonly paymentConfirming = signal(false);
  readonly canWriteOperators = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.OPERATORS),
  );

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
  readonly editPaymentSchedule = signal<OperatorPaymentSchedule>('maneuver');
  readonly editPaymentMethod = signal('');
  readonly editVisibility = signal<'active' | 'inactive'>('active');
  readonly editOperationalStatus = signal('available');

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

  readonly visibilityOptions = FLEET_RESOURCE_VISIBILITY_OPTIONS;

  resourceVisibilityLabel(): string {
    return fleetResourceActiveLabel(this.operator().isActive);
  }
  readonly licenseTypeOptions = OPERATOR_LICENSE_TYPE_OPTIONS;
  readonly insuranceKindOptions = OPERATOR_INSURANCE_KIND_OPTIONS;
  readonly relationshipOptions = OPERATOR_RELATIONSHIP_OPTIONS;
  readonly premiumPeriodOptions = OPERATOR_PREMIUM_PERIOD_OPTIONS;
  readonly employmentContractOptions = OPERATOR_EMPLOYMENT_CONTRACT_OPTIONS;
  readonly paymentScheduleOptions = OPERATOR_PAYMENT_SCHEDULE_OPTIONS;
  readonly paymentMethodOptions = EXPENSE_PAYMENT_METHOD_OPTIONS;

  readonly operationSummary = computed(
    () => this.operationSummarySignal() ?? EMPTY_OPERATOR_OPERATION_SUMMARY,
  );

  readonly derivedOperationalStatus = computed((): OperatorOperationalStatus => {
    const operator = this.operator();
    return deriveOperatorOperationalStatus(operator, this.operationalSync.trips());
  });

  /** En curso lo pone el sistema; no se edita a mano. */
  readonly operationalStatusEditLocked = computed(
    () => this.derivedOperationalStatus() === 'in_use',
  );

  readonly manualOperationalStatusOptions = computed((): ToSelectOption[] => {
    if (this.operationalStatusEditLocked()) {
      return [
        { value: 'in_use', label: 'En curso' },
        ...OPERATOR_MANUAL_STATUS_OPTIONS,
      ];
    }
    return [...OPERATOR_MANUAL_STATUS_OPTIONS];
  });

  private readonly now = new Date();
  readonly periodFromMonth = signal(this.now.getMonth() + 1);
  readonly periodFromYear = signal(this.now.getFullYear());
  readonly periodToMonth = signal(this.now.getMonth() + 1);
  readonly periodToYear = signal(this.now.getFullYear());

  readonly currentMonthYear = computed(() => ({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  }));

  readonly periodFrom = computed(() => {
    const m = String(this.periodFromMonth()).padStart(2, '0');
    return `${this.periodFromYear()}-${m}-01`;
  });
  readonly periodTo = computed(() => {
    const m = this.periodToMonth();
    const y = this.periodToYear();
    const lastDay = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  readonly periodLabel = computed(() => {
    const fm = this.periodFromMonth();
    const fy = this.periodFromYear();
    const tm = this.periodToMonth();
    const ty = this.periodToYear();
    const fmt = new Intl.DateTimeFormat('es-MX', { month: 'long' });
    const fromLabel = fmt.format(new Date(fy, fm - 1, 1, 12));
    if (fm === tm && fy === ty) {
      return `${fromLabel.charAt(0).toUpperCase() + fromLabel.slice(1)} ${fy}`;
    }
    const toLabel = fmt.format(new Date(ty, tm - 1, 1, 12));
    return `${fromLabel.charAt(0).toUpperCase() + fromLabel.slice(1)} ${fy} – ${toLabel.charAt(0).toUpperCase() + toLabel.slice(1)} ${ty}`;
  });

  private readonly mxMoney0 = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  });

  private priorOperatorId: string | undefined;

  onPeriodFromChange(value: { month: number; year: number }): void {
    this.periodFromMonth.set(value.month);
    this.periodFromYear.set(value.year);
    if (
      value.year > this.periodToYear() ||
      (value.year === this.periodToYear() && value.month > this.periodToMonth())
    ) {
      this.periodToMonth.set(value.month);
      this.periodToYear.set(value.year);
    }
    this.invalidateOperationSummary();
  }

  onPeriodToChange(value: { month: number; year: number }): void {
    this.periodToMonth.set(value.month);
    this.periodToYear.set(value.year);
    if (
      value.year < this.periodFromYear() ||
      (value.year === this.periodFromYear() && value.month < this.periodFromMonth())
    ) {
      this.periodFromMonth.set(value.month);
      this.periodFromYear.set(value.year);
    }
    this.invalidateOperationSummary();
  }

  private invalidateOperationSummary(): void {
    this.operationSummarySignal.set(null);
    this.operationSummaryCacheKey = null;
  }

  constructor() {
    effect(() => {
      const o = this.operatorsFeature.selectedOperator();
      if (!o) {
        return;
      }
      const idChanged = this.priorOperatorId !== o.id;
      this.priorOperatorId = o.id;
      if (idChanged) {
        this.drawerTab.set('operation');
        this.editingSection.set(null);
        this.operationSummarySignal.set(null);
        this.operationSummaryCacheKey = null;
        this.periodFromMonth.set(this.now.getMonth() + 1);
        this.periodFromYear.set(this.now.getFullYear());
        this.periodToMonth.set(this.now.getMonth() + 1);
        this.periodToYear.set(this.now.getFullYear());
      }
      if (idChanged || this.editingSection() === null) {
        this.patchFormFromOperator(o);
      }
    });

    effect((onCleanup) => {
      const o = this.operatorsFeature.selectedOperator();
      const tab = this.drawerTab();
      const from = this.periodFrom();
      const to = this.periodTo();
      if (!o) {
        this.operationSummarySignal.set(null);
        this.operationSummaryCacheKey = null;
        this.drawerLoading.set(false);
        return;
      }
      if (tab !== 'operation') {
        this.drawerLoading.set(false);
        return;
      }
      const cacheKey = `${o.id}:${from}:${to}`;
      if (
        this.operationSummaryCacheKey === cacheKey &&
        this.operationSummarySignal() != null
      ) {
        this.drawerLoading.set(false);
        return;
      }
      this.drawerLoading.set(true);
      const sub = this.operatorsApi
        .getOperatorOperationSummary(o.id, from, to)
        .pipe(catchError(() => of(EMPTY_OPERATOR_OPERATION_SUMMARY)))
        .subscribe((summary) => {
          this.operationSummaryCacheKey = cacheKey;
          this.operationSummarySignal.set(summary);
          this.syncOperatorListPaymentSummary(o.id, summary);
          this.drawerLoading.set(false);
        });
      onCleanup(() => sub.unsubscribe());
    });

    let operatorsPaymentsEpoch = this.operationalSync.operatorsMutationEpoch();
    effect(() => {
      const epoch = this.operationalSync.operatorsMutationEpoch();
      if (epoch === operatorsPaymentsEpoch) {
        return;
      }
      operatorsPaymentsEpoch = epoch;
      this.operationSummarySignal.set(null);
      this.operationSummaryCacheKey = null;
    });
  }

  bindDismiss(callback: () => void): void {
    this.dismissCallback = callback;
  }

  markReady(): void {
    if (this.operatorsFeature.selectedOperator()) {
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

  operatorStatusMod(): string {
    return operatorOperationalStatusMod(this.derivedOperationalStatus());
  }

  operationalStatusLabel(): string {
    return operatorOperationalStatusLabel(this.derivedOperationalStatus());
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

  paymentScheduleLabel(): string {
    return operatorPaymentScheduleLabel(this.operator().paymentSchedule);
  }

  paymentMethodLabel(): string {
    return expensePaymentMethodLabel(this.operator().paymentMethod);
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
    if (tab !== 'operation') {
      this.drawerLoading.set(false);
    }
  }

  startEditSection(section: OperatorEditSection): void {
    if (!this.canWriteOperators()) {
      return;
    }
    this.patchFormFromOperator(this.operator());
    this.drawerTab.set(section === 'operation' ? 'operation' : 'details');
    this.editingSection.set(section);
  }

  cancelSectionEdit(): void {
    this.patchFormFromOperator(this.operator());
    this.editingSection.set(null);
  }

  showOperatorEdit(section: OperatorEditSection): boolean {
    return this.canWriteOperators() && this.editingSection() !== section;
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
    const licenseNumber = this.editLicenseNumber().trim().toUpperCase();
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

    const statusLocked = this.operationalStatusEditLocked();
    const nextStatus = this.editOperationalStatus().trim();
    let isActive = this.editVisibility() === 'active';
    if (!statusLocked && nextStatus === 'inactive') {
      isActive = false;
      this.editVisibility.set('inactive');
    } else if (
      !statusLocked &&
      nextStatus !== '' &&
      nextStatus !== 'inactive' &&
      nextStatus !== 'in_use'
    ) {
      isActive = true;
      this.editVisibility.set('active');
    }

    const previous = this.operator();
    const updated = mergeOperatorNested({
      ...previous,
      isActive,
      companyHireDate,
      employmentContractType: this.editEmploymentContractType().trim(),
      paymentSchedule: this.editPaymentSchedule(),
      paymentMethod: this.editPaymentMethod().trim() || undefined,
      documents: [...this.editDocuments()],
    }) as Operator;

    this.saving.set(true);
    this.operatorsFeature
      .updateOperator(updated)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (statusLocked || !nextStatus || nextStatus === 'in_use') {
            this.saving.set(false);
            this.toast.show('Cambios guardados.', 'success');
            this.editingSection.set(null);
            return;
          }
          this.applyManualOperationalStatus(previous, nextStatus);
        },
        error: () => {
          this.toast.show('No se pudo guardar.', 'error');
          this.saving.set(false);
        },
      });
  }

  /**
   * Vacaciones / incapacidad / disponible vía endpoints RRHH
   * (el PATCH del operador no acepta `status`).
   */
  private applyManualOperationalStatus(
    previous: Operator,
    nextStatus: string,
  ): void {
    const operatorId = previous.id;
    const persisted = (previous.status ?? '').trim().toLowerCase();
    const steps: Observable<Operator | null>[] = [];

    const pushEndHold = (errorMessage: string): void => {
      steps.push(
        this.operatorsApi.endOperatorHrHold(operatorId).pipe(
          catchError(() => {
            this.toast.show(errorMessage, 'error');
            return of(null);
          }),
        ),
      );
    };

    const pushStartHold = (hold: 'leave' | 'incapacitated'): void => {
      steps.push(
        (hold === 'leave'
          ? this.operatorsApi.startOperatorLeave(operatorId)
          : this.operatorsApi.startOperatorIncapacitated(operatorId)
        ).pipe(
          catchError(() => {
            this.toast.show(
              hold === 'leave'
                ? 'No se pudo registrar vacaciones.'
                : 'No se pudo registrar incapacidad.',
              'error',
            );
            return of(null);
          }),
        ),
      );
    };

    if (nextStatus === 'available' || nextStatus === 'inactive') {
      if (persisted === 'leave' || persisted === 'incapacitated') {
        pushEndHold(
          nextStatus === 'available'
            ? 'No se pudo reincorporar al operador.'
            : 'No se pudo actualizar el estado.',
        );
      }
    } else if (nextStatus === 'leave' || nextStatus === 'incapacitated') {
      if (persisted === nextStatus) {
        // sin cambio de hold
      } else if (persisted === 'leave' || persisted === 'incapacitated') {
        pushEndHold('No se pudo actualizar el estado.');
        pushStartHold(nextStatus);
      } else {
        pushStartHold(nextStatus);
      }
    }

    if (steps.length === 0) {
      this.saving.set(false);
      this.toast.show('Cambios guardados.', 'success');
      this.editingSection.set(null);
      return;
    }

    concat(...steps)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          if (updated) {
            this.operatorsFeature.replaceOperator(updated);
          }
        },
        complete: () => {
          this.toast.show('Cambios guardados.', 'success');
          this.editingSection.set(null);
        },
      });
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
    this.operatorsFeature
      .updateOperator(updated)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.show('Cambios guardados.', 'success');
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
    this.editPaymentSchedule.set(o.paymentSchedule ?? 'maneuver');
    this.editPaymentMethod.set(o.paymentMethod ?? '');
    this.editVisibility.set(o.isActive === false ? 'inactive' : 'active');
    this.editOperationalStatus.set(this.editStatusFromOperator(o));
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

  confirmOperatorPayment(tripId: string): void {
    const normalizedTripId = tripId.trim();
    if (!normalizedTripId || this.paymentConfirming() || this.saving()) {
      return;
    }
    const operatorId = this.operator().id;
    this.paymentConfirming.set(true);
    this.operatorsApi
      .confirmOperatorTripPayment(operatorId, normalizedTripId)
      .pipe(
        catchError(() => {
          this.toast.show('No se pudo confirmar el pago al operador.', 'error');
          return of(null);
        }),
        finalize(() => this.paymentConfirming.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((summary) => {
        if (!summary) {
          return;
        }
        this.operationSummarySignal.set(summary);
        this.operationSummaryCacheKey = `${operatorId}:${this.periodFrom()}:${this.periodTo()}`;
        this.syncOperatorListPaymentSummary(operatorId, summary);
        this.toast.show('Pago registrado en la tabla de gastos.', 'success');
      });
  }

  revertOperatorPayment(tripId: string): void {
    const normalizedTripId = tripId.trim();
    if (!normalizedTripId || this.paymentConfirming() || this.saving()) {
      return;
    }
    const operatorId = this.operator().id;
    this.paymentConfirming.set(true);
    this.operatorsApi
      .revertOperatorTripPayment(operatorId, normalizedTripId)
      .pipe(
        catchError(() => {
          this.toast.show('No se pudo revertir el pago al operador.', 'error');
          return of(null);
        }),
        finalize(() => this.paymentConfirming.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((summary) => {
        if (!summary) {
          return;
        }
        this.operationSummarySignal.set(summary);
        this.operationSummaryCacheKey = `${operatorId}:${this.periodFrom()}:${this.periodTo()}`;
        this.syncOperatorListPaymentSummary(operatorId, summary);
        this.toast.show('Pago revertido correctamente.', 'success');
      });
  }

  private syncOperatorListPaymentSummary(
    operatorId: string,
    summary: OperatorOperationSummary,
  ): void {
    this.operatorsFeature.applyOperatorPaymentSummary(operatorId, summary);
  }

  operatorPaymentPaidLabel(paidAtYmd: string | null): string {
    if (!paidAtYmd?.trim()) {
      return '—';
    }
    return this.displayIsoDate(paidAtYmd);
  }

  private editStatusFromOperator(o: Operator): string {
    const derived = deriveOperatorOperationalStatus(
      o,
      this.operationalSync.trips(),
    );
    if (derived === 'in_use') {
      return 'in_use';
    }
    if (derived === 'inactive' || o.isActive === false) {
      return 'inactive';
    }
    if (derived === 'leave' || derived === 'incapacitated') {
      return derived;
    }
    return 'available';
  }
}
