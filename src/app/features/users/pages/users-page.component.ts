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
import { SessionService } from '@core/services/state/session';
import { userTableModuleIcons } from '@shared/utils/staff-module-present';
import { UsersDetailDrawerComponent } from '@features/users/components/users-detail-drawer/users-detail-drawer.component';
import { UsersNewDrawerComponent } from '@features/users/components/users-new-drawer/users-new-drawer.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

@Component({
  selector: 'app-users-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToPageHeaderComponent,
    ToSkeletonComponent,
    ToTableComponent,
    ToButtonComponent,
    UsersNewDrawerComponent,
    UsersDetailDrawerComponent,
  ],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.scss',
})
export class UsersPageComponent {
  private readonly session = inject(SessionService);
  private readonly api = inject(CompanyUsersApiService);

  readonly newUserOpen = signal(false);
  readonly selectedUserId = signal<number | null>(null);

  readonly users = resource({
    loader: async () => {
      const companyId = this.session.companyId();
      if (!companyId) {
        return [] as CompanyUserRow[];
      }
      return firstValueFrom(this.api.listUsers(companyId));
    },
  });

  readonly loading = computed(() => this.users.isLoading());

  readonly selectedUser = computed(() => {
    const id = this.selectedUserId();
    if (id == null) {
      return null;
    }
    return (this.users.value() ?? []).find((row) => row.id === id) ?? null;
  });

  readonly columns: ToTableColumn[] = [
    { key: 'displayName', label: 'Nombre' },
    { key: 'username', label: 'Usuario' },
    { key: 'role', label: 'Rol', cell: 'user-role-pill' },
    { key: 'status', label: 'Estado', cell: 'user-status-pill' },
    { key: 'moduleAccessIcons', label: 'Módulos', cell: 'module-access-icons' },
  ];

  readonly tableRows = computed(() =>
    (this.users.value() ?? []).map((row) => ({
      ...row,
      moduleAccessIcons: userTableModuleIcons(row.allowedModules, row.role),
    })),
  );

  reloadUsers(): void {
    this.users.reload();
  }

  onRowClick(row: Record<string, unknown>): void {
    const id = Number(row['id']);
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
