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
  type CompanyUserRow,
} from '@core/services/api/company-users';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import { PlanEntitlementService } from '@shared/billing/plan-entitlement.service';
import { UsersDetailDrawerComponent } from '@features/users/components/users-detail-drawer/users-detail-drawer.component';
import { UsersNewDrawerComponent } from '@features/users/components/users-new-drawer/users-new-drawer.component';
import { UsersOverviewComponent } from '@features/users/components/users-overview/users-overview.component';
import { ToModuleSkeletonComponent } from '@shared/ui/to-module-skeleton/to-module-skeleton.component';

@Component({
  selector: 'app-users-settings-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToModuleSkeletonComponent,
    UsersOverviewComponent,
    UsersNewDrawerComponent,
    UsersDetailDrawerComponent,
  ],
  templateUrl: './users-settings-tab.component.html',
  styleUrl: './users-settings-tab.component.scss',
})
export class UsersSettingsTabComponent {
  private readonly session = inject(SessionService);
  private readonly api = inject(CompanyUsersApiService);
  private readonly planEntitlements = inject(PlanEntitlementService);
  private readonly toast = inject(ToastService);

  readonly newUserOpen = signal(false);
  readonly selectedUserId = signal<number | null>(null);

  readonly users = resource({
    request: () => this.session.companyId() ?? undefined,
    loader: async ({ request: companyId }) => {
      if (companyId == null || companyId === '') {
        return [] as CompanyUserRow[];
      }
      return firstValueFrom(this.api.listUsers(companyId));
    },
  });

  readonly loading = computed(() => this.users.isLoading());
  readonly loadError = computed(() => this.users.error());

  readonly selectedUser = computed(() => {
    const id = this.selectedUserId();
    if (id == null) {
      return null;
    }
    return (this.users.value() ?? []).find((row) => row.id === id) ?? null;
  });

  readonly userRows = computed(() => this.users.value() ?? []);

  openNewUser(): void {
    const rows = this.users.value() ?? [];
    const staffCount = rows.filter((u) => u.role === 'staff').length;
    if (!this.planEntitlements.canAddStaff(staffCount)) {
      this.toast.show(this.planEntitlements.staffLimitMessage(), 'warning');
      return;
    }
    this.newUserOpen.set(true);
  }

  reloadUsers(): void {
    this.users.reload();
  }

  onUserCardSelect(id: number): void {
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }
    this.selectedUserId.set(id);
  }

  onDetailDismiss(): void {
    this.selectedUserId.set(null);
  }

  onUserSaved(updated: CompanyUserRow): void {
    this.reloadUsers();
    this.selectedUserId.set(updated.id);
  }

  onUserCreated(): void {
    this.reloadUsers();
  }
}