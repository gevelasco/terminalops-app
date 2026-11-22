import { initialsFromDisplayName } from '@core/services/state/user-profile';
import type { CompanyUserRow } from '@core/services/api/company-users';
import {
  roleDisplayLabel,
  userRolePillClass,
  userStatusPillClass,
  userStatusPillLabel,
} from '@shared/utils/access-control';
import type { UserTableModuleIcon } from '@shared/utils/staff-module-present';
import { userStaffModuleDisplayIcons } from '@shared/utils/staff-module-permissions';

export interface UsersOverviewCardView {
  id: number;
  role: CompanyUserRow['role'];
  name: string;
  subtitle: string;
  username: string;
  photoUrl?: string;
  photoInitials: string;
  rolePillClass: string;
  roleLabel: string;
  statusPillClass: string;
  statusLabel: string;
  moduleIcons: UserTableModuleIcon[];
  accessSummary: string;
}

function usersAccessSummary(row: CompanyUserRow, icons: UserTableModuleIcon[]): string {
  if (row.role === 'admin' || row.role === 'superadmin') {
    return 'Acceso a todos los módulos operativos';
  }
  const active = icons.filter((i) => i.active).length;
  if (active === 0) {
    return 'Sin módulos asignados';
  }
  if (active === 1) {
    return '1 módulo con acceso';
  }
  return `${active} módulos con acceso`;
}

export function buildUsersOverviewCard(row: CompanyUserRow): UsersOverviewCardView {
  const name = row.displayName?.trim() || row.username;
  const job = row.jobTitle?.trim() ?? '';
  const moduleIcons = userStaffModuleDisplayIcons(
    row.moduleGrants,
    row.moduleCodes,
    row.role,
  );
  return {
    id: row.id,
    role: row.role,
    name,
    subtitle: job || roleDisplayLabel(row.role),
    username: row.username,
    photoUrl: row.photoDataUrl?.trim() || undefined,
    photoInitials: initialsFromDisplayName(name),
    rolePillClass: userRolePillClass(row.role),
    roleLabel: roleDisplayLabel(row.role),
    statusPillClass: userStatusPillClass(row.status),
    statusLabel: userStatusPillLabel(row.status),
    moduleIcons,
    accessSummary: usersAccessSummary(row, moduleIcons),
  };
}

export function sortUsersForOverview(rows: readonly CompanyUserRow[]): CompanyUserRow[] {
  const roleRank = (role: CompanyUserRow['role']): number => {
    if (role === 'superadmin') {
      return 0;
    }
    if (role === 'admin') {
      return 1;
    }
    return 2;
  };
  return [...rows].sort((a, b) => {
    const byRole = roleRank(a.role) - roleRank(b.role);
    if (byRole !== 0) {
      return byRole;
    }
    return a.displayName.localeCompare(b.displayName, 'es', { sensitivity: 'base' });
  });
}