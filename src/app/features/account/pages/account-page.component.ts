import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CompanyUsersApiService } from '@core/services/api/company-users';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';

@Component({
  selector: 'app-account-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToPageHeaderComponent, ToSkeletonComponent, ToInputComponent],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.scss',
})
export class AccountPageComponent {
  private readonly session = inject(SessionService);
  private readonly api = inject(CompanyUsersApiService);
  private readonly toast = inject(ToastService);

  readonly account = resource({
    loader: async () => {
      const companyId = this.session.companyId();
      if (!companyId) {
        return null;
      }
      const data = await firstValueFrom(this.api.getAccount(companyId));
      if (data) {
        this.session.setCompanyBranding(
          data.name,
          data.tagline ?? '',
        );
      }
      return data;
    },
  });

  readonly accountData = computed(() => this.account.value());

  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly editName = signal('');
  readonly editTagline = signal('');

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

  readonly planLabel = computed(() => {
    const p = this.accountData()?.subscriptionPlan;
    switch (p) {
      case 'trial':
        return 'Trial';
      case 'starter':
        return 'Starter';
      case 'professional':
        return 'Professional';
      case 'enterprise':
        return 'Enterprise';
      default:
        return p ?? '—';
    }
  });

  readonly formattedCreatedAt = computed(() =>
    this.formatDate(this.accountData()?.createdAt),
  );

  readonly formattedEndsAt = computed(() =>
    this.formatDate(this.accountData()?.subscriptionEndsAt),
  );

  startEdit(): void {
    const data = this.accountData();
    if (!data) return;
    this.editName.set(data.name);
    this.editTagline.set(data.tagline ?? '');
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
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
      await firstValueFrom(
        this.api.updateAccount(companyId, { name, tagline }),
      );
      this.session.setCompanyBranding(name, tagline);
      this.account.reload();
      this.editing.set(false);
      this.toast.show('Datos actualizados.', 'success');
    } catch {
      this.toast.show('No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      this.saving.set(false);
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
