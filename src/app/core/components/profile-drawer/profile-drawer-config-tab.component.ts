import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService } from '@core/notifications/toast.service';
import {
  CompaniesService,
  type PatchCompanyOperationalSettings,
} from '@core/services/api/companies';
import { SessionService } from '@core/services/state/session';
import { formatOperationalSettingChangedAt } from '@core/services/state/user-preferences';
import { syncCompanySettingsFromProfile } from '@core/components/profile-drawer/profile-drawer-company-settings.util';
import {
  companyMaintenancePolicyModeFromSession,
  MAINTENANCE_DATE_PERIOD_OPTIONS,
  type CompanyMaintenancePolicyMode,
  type MaintenanceDatePeriod,
} from '@shared/models/company-operational-settings.models';
import { TRIP_AUTO_EXPENSE_PAYMENT_METHOD_OPTIONS } from '@shared/catalogs/expense-form-options';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent } from '@shared/ui/to-select/to-select.component';
import {
  ToSegmentControlComponent,
  type ToSegmentTab,
} from '@shared/ui/to-segment-control/to-segment-control.component';

type DisableConfirmKind =
  | 'maintenance'
  | 'intelligent'
  | 'diesel'
  | 'prefill';

@Component({
  selector: 'app-profile-drawer-config-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToButtonComponent,
    ToIconComponent,
    ToInputComponent,
    ToSelectComponent,
    ToSegmentControlComponent,
  ],
  templateUrl: './profile-drawer-config-tab.component.html',
  styleUrls: [
    '../../../features/fleet/components/fleet-drawer.shared.scss',
    '../../../features/fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    './profile-drawer-config-tab.component.scss',
    './profile-drawer.component.scss',
  ],
})
export class ProfileDrawerConfigTabComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  private readonly companies = inject(CompaniesService);

  readonly maintDatePeriodOptions = [...MAINTENANCE_DATE_PERIOD_OPTIONS];
  readonly autoExpensePaymentMethodOptions = TRIP_AUTO_EXPENSE_PAYMENT_METHOD_OPTIONS;
  readonly maintenancePolicyTabs: readonly ToSegmentTab<CompanyMaintenancePolicyMode>[] =
    [
      { id: 'none', label: 'Manual' },
      { id: 'km', label: 'Por km' },
      { id: 'date', label: 'Por fechas' },
    ];
  readonly saving = signal(false);

  readonly draftMaintenanceMode = model<CompanyMaintenancePolicyMode>('none');
  readonly draftKmInterval = model('');
  readonly draftDatePeriod = model<MaintenanceDatePeriod>('semiannual');
  readonly draftIntelligentEnabled = model(false);
  readonly draftMaintenanceProvisionPercent = model('5');
  readonly draftFuelPaymentMethod = model('cash');
  readonly draftTollsPaymentMethod = model('cash');
  readonly draftPerDiemPaymentMethod = model('cash');
  readonly draftControlPaymentMethod = model('cash');
  readonly draftDieselControlEnabled = model(true);
  readonly draftTripAssistPrefillEnabled = model(false);

  readonly pendingDisableKind = signal<DisableConfirmKind | null>(null);
  private pendingMaintenanceMode = signal<CompanyMaintenancePolicyMode | null>(null);
  private readonly disableConfirmDialog = viewChild<ElementRef<HTMLDialogElement>>(
    'disableConfirmDialog',
  );

  constructor() {
    this.loadDraftFromSession();
  }

  maintenanceStatusLabel(): string {
    const mode = companyMaintenancePolicyModeFromSession({
      maintenanceKmControlEnabled: this.session.maintenanceKmControlEnabled(),
      maintenanceKmIntervalDefault: this.session.maintenanceKmIntervalDefault(),
      maintenanceDateControlEnabled: this.session.maintenanceDateControlEnabled(),
      maintenanceDatePeriodDefault: this.session.maintenanceDatePeriodDefault(),
    });
    if (mode === 'km') {
      return this.controlStatusLabel(
        true,
        this.session.maintenanceKmControlChangedAt(),
      );
    }
    if (mode === 'date') {
      return this.controlStatusLabel(
        true,
        this.session.maintenanceDateControlChangedAt(),
      );
    }
    return 'Control manual por unidad';
  }

  intelligentStatusLabel(): string {
    return this.controlStatusLabel(
      this.session.operationalAnalysisEnabled(),
      this.session.operationalAnalysisChangedAt(),
    );
  }

  dieselControlStatusLabel(): string {
    return this.controlStatusLabel(
      this.session.dieselControlEnabled(),
      this.session.dieselControlChangedAt(),
    );
  }

  prefillStatusLabel(): string {
    return this.controlStatusLabel(
      this.session.tripAssistPrefillEnabled(),
      this.session.tripAssistPrefillChangedAt(),
    );
  }

  onMaintenancePolicySelect(mode: CompanyMaintenancePolicyMode): void {
    if (mode === this.draftMaintenanceMode()) {
      return;
    }
    if (
      mode === 'none' &&
      (this.draftMaintenanceMode() === 'km' || this.draftMaintenanceMode() === 'date')
    ) {
      this.pendingMaintenanceMode.set('none');
      this.pendingDisableKind.set('maintenance');
      queueMicrotask(() => this.disableConfirmDialog()?.nativeElement.showModal());
      return;
    }
    this.draftMaintenanceMode.set(mode);
  }

  toggleDraftIntelligent(): void {
    const next = !this.draftIntelligentEnabled();
    if (!next && this.draftIntelligentEnabled()) {
      this.pendingDisableKind.set('intelligent');
      queueMicrotask(() => this.disableConfirmDialog()?.nativeElement.showModal());
      return;
    }
    this.draftIntelligentEnabled.set(next);
  }

  toggleDraftDieselControl(): void {
    const next = !this.draftDieselControlEnabled();
    if (!next && this.draftDieselControlEnabled()) {
      this.pendingDisableKind.set('diesel');
      queueMicrotask(() => this.disableConfirmDialog()?.nativeElement.showModal());
      return;
    }
    this.draftDieselControlEnabled.set(next);
  }

  toggleDraftTripAssistPrefill(): void {
    const next = !this.draftTripAssistPrefillEnabled();
    if (!next && this.draftTripAssistPrefillEnabled()) {
      this.pendingDisableKind.set('prefill');
      queueMicrotask(() => this.disableConfirmDialog()?.nativeElement.showModal());
      return;
    }
    this.draftTripAssistPrefillEnabled.set(next);
  }

  closeDisableConfirm(): void {
    this.pendingDisableKind.set(null);
    this.pendingMaintenanceMode.set(null);
    this.disableConfirmDialog()?.nativeElement.close();
  }

  confirmDisableControl(): void {
    const kind = this.pendingDisableKind();
    if (kind === 'maintenance') {
      const mode = this.pendingMaintenanceMode();
      if (mode) {
        this.draftMaintenanceMode.set(mode);
      }
    } else if (kind === 'intelligent') {
      this.draftIntelligentEnabled.set(false);
    } else if (kind === 'diesel') {
      this.draftDieselControlEnabled.set(false);
    } else if (kind === 'prefill') {
      this.draftTripAssistPrefillEnabled.set(false);
    }
    this.closeDisableConfirm();
  }

  onDraftDatePeriodChange(value: string): void {
    const period = value as MaintenanceDatePeriod;
    if (MAINTENANCE_DATE_PERIOD_OPTIONS.some((o) => o.value === period)) {
      this.draftDatePeriod.set(period);
    }
  }

  saveCompanyConfiguration(): void {
    const companyId = this.session.companyId();
    if (!companyId) {
      return;
    }

    const patch = this.buildConfigPatch();
    if (!patch) {
      this.toast.show('No hay cambios en la configuración.', 'warning');
      return;
    }

    if (this.draftMaintenanceMode() === 'km') {
      const kmRaw = this.draftKmInterval().trim().replace(/,/g, '');
      const kmN = kmRaw === '' ? undefined : Number(kmRaw);
      if (kmN === undefined || !Number.isFinite(kmN) || kmN <= 0) {
        this.toast.show(
          'Indica los kilómetros estándar entre servicios para el control por km.',
          'warning',
        );
        return;
      }
    }

    if (this.draftIntelligentEnabled()) {
      const percentRaw = this.draftMaintenanceProvisionPercent().trim().replace(/,/g, '');
      const percentN = percentRaw === '' ? undefined : Number(percentRaw);
      if (
        percentN === undefined ||
        !Number.isFinite(percentN) ||
        percentN < 0 ||
        percentN > 100
      ) {
        this.toast.show(
          'Indica un porcentaje de provisión de mantenimiento entre 0 y 100.',
          'warning',
        );
        return;
      }
      if (!this.isValidAutoExpensePaymentMethod(this.draftControlPaymentMethod())) {
        this.toast.show('Selecciona el método de pago de control operativo.', 'warning');
        return;
      }
    }

    if (!this.isValidAutoExpensePaymentMethod(this.draftFuelPaymentMethod())) {
      this.toast.show('Selecciona el método de pago del diésel.', 'warning');
      return;
    }
    if (!this.isValidAutoExpensePaymentMethod(this.draftTollsPaymentMethod())) {
      this.toast.show('Selecciona el método de pago de casetas.', 'warning');
      return;
    }
    if (!this.isValidAutoExpensePaymentMethod(this.draftPerDiemPaymentMethod())) {
      this.toast.show('Selecciona el método de pago de viáticos.', 'warning');
      return;
    }

    this.saving.set(true);
    this.companies
      .updateOperationalSettings(companyId, patch)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (company) => {
          syncCompanySettingsFromProfile(this.session, company);
          this.loadDraftFromSession();
          this.saving.set(false);
          this.toast.show('Configuración guardada.', 'success');
        },
        error: () => {
          this.saving.set(false);
          this.loadDraftFromSession();
          this.toast.show('No se pudo guardar la configuración.', 'error');
        },
      });
  }

  private buildConfigPatch(): PatchCompanyOperationalSettings | null {
    const patch: PatchCompanyOperationalSettings = {};

    if (this.draftTripAssistPrefillEnabled() !== this.session.tripAssistPrefillEnabled()) {
      patch.tripAssistPrefillEnabled = this.draftTripAssistPrefillEnabled();
    }
    if (this.draftIntelligentEnabled() !== this.session.operationalAnalysisEnabled()) {
      patch.operationalAnalysisEnabled = this.draftIntelligentEnabled();
    }
    if (this.draftDieselControlEnabled() !== this.session.dieselControlEnabled()) {
      patch.dieselControlEnabled = this.draftDieselControlEnabled();
    }

    const savedPercent = this.session.tripAutoMaintenanceProvisionPercent();
    const percentRaw = this.draftMaintenanceProvisionPercent().trim().replace(/,/g, '');
    const percentN = percentRaw === '' ? undefined : Number(percentRaw);
    const draftPercentRounded =
      percentN != null && Number.isFinite(percentN) ? Math.round(percentN * 100) / 100 : undefined;
    if (
      draftPercentRounded != null &&
      draftPercentRounded !== savedPercent
    ) {
      patch.tripAutoMaintenanceProvisionPercent = draftPercentRounded;
    }

    const savedFuelPayment = this.session.tripAutoFuelPaymentMethod();
    if (this.draftFuelPaymentMethod() !== savedFuelPayment) {
      patch.tripAutoFuelPaymentMethod = this.draftFuelPaymentMethod();
    }
    const savedTollsPayment = this.session.tripAutoTollsPaymentMethod();
    if (this.draftTollsPaymentMethod() !== savedTollsPayment) {
      patch.tripAutoTollsPaymentMethod = this.draftTollsPaymentMethod();
    }
    const savedPerDiemPayment = this.session.tripAutoPerDiemPaymentMethod();
    if (this.draftPerDiemPaymentMethod() !== savedPerDiemPayment) {
      patch.tripAutoPerDiemPaymentMethod = this.draftPerDiemPaymentMethod();
    }
    const savedControlPayment = this.session.tripAutoControlPaymentMethod();
    if (this.draftControlPaymentMethod() !== savedControlPayment) {
      patch.tripAutoControlPaymentMethod = this.draftControlPaymentMethod();
    }

    const mode = this.draftMaintenanceMode();
    const savedMode = companyMaintenancePolicyModeFromSession({
      maintenanceKmControlEnabled: this.session.maintenanceKmControlEnabled(),
      maintenanceKmIntervalDefault: this.session.maintenanceKmIntervalDefault(),
      maintenanceDateControlEnabled: this.session.maintenanceDateControlEnabled(),
      maintenanceDatePeriodDefault: this.session.maintenanceDatePeriodDefault(),
    });

    const kmEnabled = mode === 'km';
    const dateEnabled = mode === 'date';

    if (kmEnabled !== this.session.maintenanceKmControlEnabled()) {
      patch.maintenanceKmControlEnabled = kmEnabled;
    }
    if (dateEnabled !== this.session.maintenanceDateControlEnabled()) {
      patch.maintenanceDateControlEnabled = dateEnabled;
    }

    const kmRaw = this.draftKmInterval().trim().replace(/,/g, '');
    const kmN = kmRaw === '' ? undefined : Number(kmRaw);
    const savedKm = this.session.maintenanceKmIntervalDefault();
    const savedKmRounded =
      savedKm != null && Number.isFinite(savedKm) && savedKm > 0
        ? Math.round(savedKm)
        : undefined;
    const draftKmRounded =
      kmN != null && Number.isFinite(kmN) && kmN > 0 ? Math.round(kmN) : undefined;

    if (kmEnabled) {
      if (draftKmRounded !== savedKmRounded || savedMode !== 'km') {
        patch.maintenanceKmIntervalDefault = draftKmRounded;
      }
    } else if (patch.maintenanceKmControlEnabled === false || savedMode === 'km') {
      patch.maintenanceKmIntervalDefault = undefined;
    }

    const savedPeriod = this.session.maintenanceDatePeriodDefault() ?? 'semiannual';
    if (dateEnabled && this.draftDatePeriod() !== savedPeriod) {
      patch.maintenanceDatePeriodDefault = this.draftDatePeriod();
    }

    if (
      !dateEnabled &&
      (patch.maintenanceDateControlEnabled === false || savedMode === 'date')
    ) {
      patch.maintenanceDatePeriodDefault = undefined;
    }

    return Object.keys(patch).length > 0 ? patch : null;
  }

  private loadDraftFromSession(): void {
    const mode = companyMaintenancePolicyModeFromSession({
      maintenanceKmControlEnabled: this.session.maintenanceKmControlEnabled(),
      maintenanceKmIntervalDefault: this.session.maintenanceKmIntervalDefault(),
      maintenanceDateControlEnabled: this.session.maintenanceDateControlEnabled(),
      maintenanceDatePeriodDefault: this.session.maintenanceDatePeriodDefault(),
    });
    this.draftMaintenanceMode.set(mode);
    const km = this.session.maintenanceKmIntervalDefault();
    this.draftKmInterval.set(
      km != null && Number.isFinite(km) && km > 0 ? String(Math.round(km)) : '',
    );
    this.draftDatePeriod.set(
      this.session.maintenanceDatePeriodDefault() ?? 'semiannual',
    );
    this.draftIntelligentEnabled.set(this.session.operationalAnalysisEnabled());
    this.draftDieselControlEnabled.set(this.session.dieselControlEnabled());
    this.draftTripAssistPrefillEnabled.set(this.session.tripAssistPrefillEnabled());
    const percent = this.session.tripAutoMaintenanceProvisionPercent();
    this.draftMaintenanceProvisionPercent.set(
      Number.isFinite(percent) ? String(percent) : '5',
    );
    this.draftFuelPaymentMethod.set(this.session.tripAutoFuelPaymentMethod());
    this.draftTollsPaymentMethod.set(this.session.tripAutoTollsPaymentMethod());
    this.draftPerDiemPaymentMethod.set(this.session.tripAutoPerDiemPaymentMethod());
    this.draftControlPaymentMethod.set(this.session.tripAutoControlPaymentMethod());
  }

  private isValidAutoExpensePaymentMethod(value: string): boolean {
    return TRIP_AUTO_EXPENSE_PAYMENT_METHOD_OPTIONS.some(
      (option) => option.value === value.trim(),
    );
  }

  private controlStatusLabel(enabled: boolean, changedAt: string | null | undefined): string {
    const at = formatOperationalSettingChangedAt(changedAt ?? '');
    if (at === '—') {
      return enabled ? 'Activado' : 'Desactivado';
    }
    return enabled ? `Activado el ${at}` : `Desactivado el ${at}`;
  }
}
