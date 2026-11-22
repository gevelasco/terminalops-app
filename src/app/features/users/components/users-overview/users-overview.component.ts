import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import type { CompanyUserRow } from '@core/services/api/company-users';
import { isAdminRole, userRoleTableIcon } from '@shared/utils/access-control';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';
import {
  buildUsersOverviewCard,
  sortUsersForOverview,
  type UsersOverviewCardView,
} from '@features/users/utils/users-overview-card.util';

@Component({
  selector: 'app-users-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToIconComponent],
  templateUrl: './users-overview.component.html',
  styleUrl: './users-overview.component.scss',
})
export class UsersOverviewComponent {
  readonly users = input.required<readonly CompanyUserRow[]>();

  readonly cardSelect = output<number>();

  private readonly sortedUsers = computed(() => sortUsersForOverview(this.users()));

  readonly administratorCards = computed(() =>
    this.sortedUsers()
      .filter((row) => isAdminRole(row.role))
      .map(buildUsersOverviewCard),
  );

  readonly staffCards = computed(() =>
    this.sortedUsers()
      .filter((row) => row.role === 'staff')
      .map(buildUsersOverviewCard),
  );

  readonly hasAny = computed(
    () => this.administratorCards().length > 0 || this.staffCards().length > 0,
  );

  readonly sections = computed(() => {
    const blocks: { id: string; title: string; cards: UsersOverviewCardView[] }[] = [];
    const admins = this.administratorCards();
    if (admins.length > 0) {
      blocks.push({ id: 'admins', title: 'Administradores', cards: admins });
    }
    const staff = this.staffCards();
    if (staff.length > 0) {
      blocks.push({ id: 'staff', title: 'Staff', cards: staff });
    }
    return blocks;
  });

  onCardClick(id: number): void {
    this.cardSelect.emit(id);
  }

  onCardKeydown(event: KeyboardEvent, id: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.cardSelect.emit(id);
    }
  }

  moduleAccessIconName(icon: ToIconName | string): ToIconName {
    return icon as ToIconName;
  }

  roleIcon(role: string): ToIconName {
    return userRoleTableIcon(role);
  }
}