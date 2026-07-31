import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CompanyUsersApiService,
  type CompanyAccount,
} from '@core/services/api/company-users';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import { initialsFromDisplayName } from '@core/services/state/user-profile';
import { buildAccountBillingHistory } from '@features/account/utils/account-billing-history.util';
import {
  companyLogoErrorMessage,
  readCompanyLogoDataUrl,
} from '@features/account/utils/company-logo';
import { planDisplayName } from '@shared/billing/subscription-plans';
import { canViewAccount } from '@shared/utils/access-control';
import { parseHttpApiErrorMessage } from '@shared/utils/http-api-error';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';

@Component({
  selector: 'app-account-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToPageHeaderComponent,
    ToSkeletonComponent,
    ToInputComponent,
    ToIconComponent,
    ToButtonComponent,
  ],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.scss',
})
export class AccountPageComponent {
  private readonly session = inject(SessionService);
  private readonly api = inject(CompanyUsersApiService);
  private readonly toast = inject(ToastService);

  /**
   * Preview local tras subir/quitar. Evita que un GET sin `logoDataUrl`
   * apague el logo que acabamos de guardar.
   */
  private readonly logoOverride = signal<string | null | undefined>(undefined);

  /** Evita `resource.reload()` tras PATCH/POST que ya devuelven la cuenta. */
  private readonly accountOverride = signal<CompanyAccount | null>(null);

  readonly account = resource({
    loader: async () => {
      this.accountOverride.set(null);
      const companyId = this.session.companyId();
      if (!companyId) {
        return null;
      }
      const data = await firstValueFrom(this.api.getAccount(companyId));
      if (data) {
        this.syncSessionFromAccount(data);
      }
      return data;
    },
  });

  readonly accountData = computed(
    () => this.accountOverride() ?? this.account.value() ?? null,
  );

  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly logoSaving = signal(false);
  readonly editName = signal('');
  readonly editTagline = signal('');

  readonly proInviteCode = signal('');
  readonly activatingPro = signal(false);

  readonly logoUrl = computed(() => {
    const override = this.logoOverride();
    if (override !== undefined) {
      return override?.trim() || null;
    }
    return (
      this.session.companyLogoDataUrl()?.trim() ||
      this.accountData()?.logoDataUrl?.trim() ||
      null
    );
  });

  readonly hasLogo = computed(() => !!this.logoUrl());

  readonly companyInitials = computed(() =>
    initialsFromDisplayName(this.accountData()?.name || this.session.companyName() || 'Empresa'),
  );

  readonly statusLabel = computed(() => {
    const s = this.accountData()?.subscriptionStatus;
    switch (s) {
      case 'active':
        return 'Activa';
      case 'suspended':
        return 'Suspendida';
      case 'expired':
        return 'Vencida';
      default:
        return s ?? '—';
    }
  });

  readonly statusVariant = computed(() => {
    const s = this.accountData()?.subscriptionStatus;
    switch (s) {
      case 'active':
        return 'success';
      case 'suspended':
        return 'warning';
      case 'expired':
        return 'danger';
      default:
        return 'neutral';
    }
  });

  readonly planLabel = computed(() =>
    planDisplayName(this.accountData()?.subscriptionPlan),
  );

  /** Solo el propietario (Cuenta) puede canjear códigos de upgrade. */
  readonly canActivatePro = computed(
    () => canViewAccount(this.session.role()) && !!this.accountData(),
  );

  readonly canSubmitProCode = computed(
    () =>
      this.canActivatePro() &&
      this.proInviteCode().trim().length > 0 &&
      !this.activatingPro(),
  );

  readonly formattedCreatedAt = computed(() =>
    this.formatDate(this.accountData()?.createdAt),
  );

  readonly formattedEndsAt = computed(() =>
    this.formatDate(this.accountData()?.subscriptionEndsAt),
  );

  readonly billingHistory = computed(() => {
    const data = this.accountData();
    if (!data) {
      return [];
    }
    return buildAccountBillingHistory(data);
  });

  startEdit(): void {
    const data = this.accountData();
    if (!data) return;
    this.editName.set(data.name);
    this.editTagline.set(data.tagline ?? '');
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.proInviteCode.set('');
    this.editing.set(false);
  }

  async activateProPlan(): Promise<void> {
    const companyId = this.session.companyId();
    const code = this.proInviteCode().trim();
    if (!companyId || !code || !this.canActivatePro()) {
      return;
    }

    this.activatingPro.set(true);
    try {
      const updated = await firstValueFrom(
        this.api.activateProPlan(companyId, code),
      );
      this.applyAccountUpdate(updated);
      this.proInviteCode.set('');
      this.editing.set(false);
      const planName = planDisplayName(updated.subscriptionPlan);
      this.toast.show(`Plan ${planName} activado correctamente.`, 'success');
    } catch (err: unknown) {
      const apiMessage = parseHttpApiErrorMessage(err);
      const status = (err as { status?: number } | null)?.status;
      if (status === 403 || status === 409) {
        this.toast.show(
          apiMessage ?? 'No se pudo canjear ese código de invitación.',
          'warning',
        );
      } else {
        this.toast.show(
          apiMessage ?? 'No se pudo canjear el código. Intenta de nuevo.',
          'error',
        );
      }
    } finally {
      this.activatingPro.set(false);
    }
  }

  async saveEdit(): Promise<void> {
    const companyId = this.session.companyId();
    if (!companyId) return;

    const name = this.editName().trim();
    if (!name) {
      this.toast.show('El nombre de la empresa es obligatorio.', 'warning');
      return;
    }

    const tagline = this.editTagline().trim();
    this.saving.set(true);
    try {
      const updated = await firstValueFrom(
        this.api.updateAccount(companyId, { name, tagline }),
      );
      this.applyAccountUpdate(updated);
      this.editing.set(false);
      this.toast.show('Datos actualizados.', 'success');
    } catch {
      this.toast.show('No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  onLogoSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.logoSaving.set(true);
    void readCompanyLogoDataUrl(file)
      .then((url) => this.saveLogo(url))
      .catch((err: unknown) => {
        this.logoSaving.set(false);
        const code = err instanceof Error ? err.message : 'read-failed';
        this.toast.show(companyLogoErrorMessage(code), 'warning');
      });
  }

  removeLogo(): void {
    void this.saveLogo('');
  }

  private async saveLogo(logoDataUrl: string): Promise<void> {
    const companyId = this.session.companyId();
    if (!companyId) {
      this.logoSaving.set(false);
      return;
    }
    this.logoSaving.set(true);
    try {
      const updated = await firstValueFrom(
        this.api.updateAccount(companyId, { logoDataUrl }),
      );
      this.applyAccountUpdate(updated);
      // Si el API no echoa el logo en el PATCH, conservamos el data URL local.
      const nextLogo =
        logoDataUrl === ''
          ? ''
          : updated.logoDataUrl?.trim() || logoDataUrl;
      this.logoOverride.set(nextLogo || null);
      this.session.setCompanyLogo(nextLogo);
      this.toast.show(
        nextLogo ? 'Logo actualizado.' : 'Logo eliminado.',
        'success',
      );
    } catch {
      this.toast.show('No se pudo guardar el logo. Intenta de nuevo.', 'error');
    } finally {
      this.logoSaving.set(false);
    }
  }

  private applyAccountUpdate(data: CompanyAccount): void {
    const current = this.accountData();
    this.accountOverride.set({
      ...current,
      ...data,
      // PATCH/POST de cuenta pueden omitir logo; no borrar el local.
      logoDataUrl: data.logoDataUrl ?? current?.logoDataUrl ?? null,
      billingHistory: data.billingHistory ?? current?.billingHistory ?? null,
    });
    this.syncSessionFromAccount(data);
  }

  private syncSessionFromAccount(data: CompanyAccount): void {
    this.session.setCompanyBranding(data.name, data.tagline ?? '');
    this.session.setSubscriptionPlan(data.subscriptionPlan);
    if (data.logoDataUrl) {
      this.session.setCompanyLogo(data.logoDataUrl);
      this.logoOverride.set(undefined);
    }
  }

  private formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  }
}
