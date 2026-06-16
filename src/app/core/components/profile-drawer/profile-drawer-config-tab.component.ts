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
import { UsersService } from '@core/services/api/users';
import { SessionService } from '@core/services/state/session';
import { formatOperationalSettingChangedAt } from '@core/services/state/user-preferences';
import { syncCompanySettingsFromProfile } from '@core/components/profile-drawer/profile-drawer-company-settings.util';
import {
  MAINTENANCE_DATE_PERIOD_OPTIONS,
  type MaintenanceDatePeriod,
} from '@shared/models/company-operational-settings.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent } from '@shared/ui/to-select/to-select.component';
import { forkJoin, of } from 'rxjs';

type DisableConfirmKind = 'km' | 'date' | 'intelligent' | 'diesel' | 'recognition';

@Component({
  selector: 'app-profile-drawer-config-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToButtonComponent, ToIconComponent, ToInputComponent, ToSelectComponent],
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
  private readonly usersApi = inject(UsersService);

  readonly maintDatePeriodOptions = [...MAINTENANCE_DATE_PERIOD_OPTIONS];
  readonly saving = signal(false);

  readonly draftKmEnabled = model(false);
  readonly draftKmInterval = model('');
  readonly draftDateEnabled = model(false);
  readonly draftDatePeriod = model<MaintenanceDatePeriod>('semiannual');
  readonly draftIntelligentEnabled = model(false);
  readonly draftDieselControlEnabled = model(true);
  readonly draftControlAutomaticRecognition = model(false);

  readonly pendingDisableKind = signal<DisableConfirmKind | null>(null);
  private readonly disableConfirmDialog = viewChild<ElementRef<HTMLDialogElement>>(
    'disableConfirmDialog',
  );

  constructor() {
    this.loadDraftFromSession();
  }

  kmStatusLabel(): string {
    return this.controlStatusLabel(
      this.session.maintenanceKmControlEnabled(),
      this.session.maintenanceKmControlChangedAt(),
    );
  }

  dateStatusLabel(): string {
    return this.controlStatusLabel(
      this.session.maintenanceDateControlEnabled(),
      this.session.maintenanceDateControlChangedAt(),
    );
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

  suggestionsControlStatusLabel(): string {
    return this.controlStatusLabel(
      this.session.controlAutomaticRecognition(),
      this.session.controlAutomaticRecognitionChangedAt(),
    );
  }

  toggleDraftKm(): void {
    const next = !this.draftKmEnabled();
    if (!next && this.draftKmEnabled()) {
      this.pendingDisableKind.set('km');
      queueMicrotask(() => this.disableConfirmDialog()?.nativeElement.showModal());
      return;
    }
    this.draftKmEnabled.set(next);
  }

  toggleDraftDate(): void {
    const next = !this.draftDateEnabled();
    if (!next && this.draftDateEnabled()) {
      this.pendingDisableKind.set('date');
      queueMicrotask(() => this.disableConfirmDialog()?.nativeElement.showModal());
      return;
    }
    this.draftDateEnabled.set(next);
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

  toggleDraftControlAutomaticRecognition(): void {
    const next = !this.draftControlAutomaticRecognition();
    if (!next && this.draftControlAutomaticRecognition()) {
      this.pendingDisableKind.set('recognition');
      queueMicrotask(() => this.disableConfirmDialog()?.nativeElement.showModal());
      return;
    }
    this.draftControlAutomaticRecognition.set(next);
  }

  closeDisableConfirm(): void {
    this.pendingDisableKind.set(null);
    this.disableConfirmDialog()?.nativeElement.close();
  }

  confirmDisableControl(): void {
    const kind = this.pendingDisableKind();
    if (kind === 'km') {
      this.draftKmEnabled.set(false);
      this.draftKmInterval.set('');
    } else if (kind === 'date') {
      this.draftDateEnabled.set(false);
    } else if (kind === 'intelligent') {
      this.draftIntelligentEnabled.set(false);
    } else if (kind === 'diesel') {
      this.draftDieselControlEnabled.set(false);
    } else if (kind === 'recognition') {
      this.draftControlAutomaticRecognition.set(false);
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
    const userPatch = this.buildUserPreferencePatch();
    if (!patch && !userPatch) {
      this.toast.show('No hay cambios en la configuración.', 'warning');
      return;
    }

    const kmRaw = this.draftKmInterval().trim().replace(/,/g, '');
    const kmN = kmRaw === '' ? undefined : Number(kmRaw);
    if (
      this.draftKmEnabled() &&
      (kmN === undefined || !Number.isFinite(kmN) || kmN <= 0)
    ) {
      this.toast.show(
        'Activa el control por km e indica los kilómetros estándar entre servicios.',
        'warning',
      );
      return;
    }

    this.saving.set(true);
    const company$ = patch
      ? this.companies.updateOperationalSettings(companyId, patch)
      : of(null);
    const user$ = userPatch ? this.usersApi.patchMe(userPatch) : of(null);

    forkJoin({ company: company$, user: user$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ company, user }) => {
          if (company) {
            syncCompanySettingsFromProfile(this.session, company);
          }
          if (user) {
            this.session.syncUserPreferenceSettings({
              controlAutomaticRecognition: user.controlAutomaticRecognition ?? false,
              controlAutomaticRecognitionChangedAt:
                user.controlAutomaticRecognitionChangedAt,
            });
          }
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

  private buildUserPreferencePatch(): { controlAutomaticRecognition: boolean } | null {
    if (
      this.draftControlAutomaticRecognition() !==
      this.session.controlAutomaticRecognition()
    ) {
      return {
        controlAutomaticRecognition: this.draftControlAutomaticRecognition(),
      };
    }
    return null;
  }

  private buildConfigPatch(): PatchCompanyOperationalSettings | null {
    const patch: PatchCompanyOperationalSettings = {};

    if (this.draftIntelligentEnabled() !== this.session.operationalAnalysisEnabled()) {
      patch.operationalAnalysisEnabled = this.draftIntelligentEnabled();
    }
    if (this.draftDieselControlEnabled() !== this.session.dieselControlEnabled()) {
      patch.dieselControlEnabled = this.draftDieselControlEnabled();
    }
    if (this.draftKmEnabled() !== this.session.maintenanceKmControlEnabled()) {
      patch.maintenanceKmControlEnabled = this.draftKmEnabled();
    }
    if (this.draftDateEnabled() !== this.session.maintenanceDateControlEnabled()) {
      patch.maintenanceDateControlEnabled = this.draftDateEnabled();
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

    if (this.draftKmEnabled()) {
      if (draftKmRounded !== savedKmRounded) {
        patch.maintenanceKmIntervalDefault = draftKmRounded;
      }
    } else if (patch.maintenanceKmControlEnabled === false) {
      patch.maintenanceKmIntervalDefault = undefined;
    }

    const savedPeriod = this.session.maintenanceDatePeriodDefault() ?? 'semiannual';
    if (this.draftDateEnabled() && this.draftDatePeriod() !== savedPeriod) {
      patch.maintenanceDatePeriodDefault = this.draftDatePeriod();
    }

    return Object.keys(patch).length > 0 ? patch : null;
  }

  private loadDraftFromSession(): void {
    this.draftKmEnabled.set(this.session.maintenanceKmControlEnabled());
    const km = this.session.maintenanceKmIntervalDefault();
    this.draftKmInterval.set(
      km != null && Number.isFinite(km) && km > 0 ? String(Math.round(km)) : '',
    );
    this.draftDateEnabled.set(this.session.maintenanceDateControlEnabled());
    this.draftDatePeriod.set(
      this.session.maintenanceDatePeriodDefault() ?? 'semiannual',
    );
    this.draftIntelligentEnabled.set(this.session.operationalAnalysisEnabled());
    this.draftDieselControlEnabled.set(this.session.dieselControlEnabled());
    this.draftControlAutomaticRecognition.set(this.session.controlAutomaticRecognition());
  }

  private controlStatusLabel(enabled: boolean, changedAt: string | null | undefined): string {
    const at = formatOperationalSettingChangedAt(changedAt ?? '');
    if (at === '—') {
      return enabled ? 'Activado' : 'Desactivado';
    }
    return enabled ? `Activado el ${at}` : `Desactivado el ${at}`;
  }
}
