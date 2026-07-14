import type { UserRole } from '@shared/models/auth.models';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';
import {
  APP_MODULE_CODES,
  STAFF_GRANTABLE_MODULE_CODES,
  STAFF_MODULE_OPTIONS,
  STAFF_RBAC_MODULE_CODES,
  type AppModuleCode,
  type ModuleAccessLevel,
  type StaffGrantableModuleCode,
  type StaffModuleGrant,
} from '@shared/models/app-modules.models';

const OPERATIONAL_MODULE_CODES: AppModuleCode[] = [
  APP_MODULE_CODES.DASHBOARD,
  ...STAFF_GRANTABLE_MODULE_CODES,
];

const ADMIN_MODULE_CODES: AppModuleCode[] = [
  ...OPERATIONAL_MODULE_CODES,
  APP_MODULE_CODES.USERS,
];

const OWNER_MODULE_CODES: AppModuleCode[] = [
  ...ADMIN_MODULE_CODES,
  APP_MODULE_CODES.ACCOUNT,
];

export function resolveStaffModuleGrants(
  grants: readonly StaffModuleGrant[] | undefined,
): StaffModuleGrant[] {
  if (!grants?.length) {
    return [];
  }
  const allowed = new Set<string>(STAFF_GRANTABLE_MODULE_CODES);
  const merged = new Map<StaffGrantableModuleCode, ModuleAccessLevel>();
  for (const grant of grants) {
    const module = grant.module?.trim();
    if (!module || !allowed.has(module)) {
      continue;
    }
    const code = module as StaffGrantableModuleCode;
    const level: ModuleAccessLevel =
      grant.level?.trim().toLowerCase() === 'read' ? 'read' : 'write';
    const prev = merged.get(code);
    if (!prev || (prev === 'read' && level === 'write')) {
      merged.set(code, level);
    }
  }
  return [...merged.entries()].map(([module, level]) => ({ module, level }));
}

export function moduleCodesFromGrants(
  grants: readonly StaffModuleGrant[] | undefined,
): StaffGrantableModuleCode[] {
  return resolveStaffModuleGrants(grants).map((grant) => grant.module);
}

export function resolveAllowedModules(
  role: string | null | undefined,
  grants?: readonly string[] | readonly StaffModuleGrant[],
): AppModuleCode[] {
  const normalizedRole = role?.trim().toLowerCase() ?? 'staff';
  if (normalizedRole === 'superadmin') {
    return [...OWNER_MODULE_CODES];
  }
  if (normalizedRole === 'admin') {
    return [...ADMIN_MODULE_CODES];
  }
  const moduleCodes =
    grants?.length && typeof grants[0] === 'object'
      ? moduleCodesFromGrants(grants as StaffModuleGrant[])
      : [...new Set((grants as string[] | undefined ?? []).filter((code) =>
          (STAFF_GRANTABLE_MODULE_CODES as readonly string[]).includes(code),
        ))] as StaffGrantableModuleCode[];
  return [APP_MODULE_CODES.DASHBOARD, ...moduleCodes];
}

function grantLevelForModule(
  grants: readonly StaffModuleGrant[] | undefined,
  module: AppModuleCode,
): ModuleAccessLevel | null {
  return resolveStaffModuleGrants(grants).find((grant) => grant.module === module)?.level ?? null;
}

export function canReadModule(
  role: string | null | undefined,
  grants: readonly StaffModuleGrant[] | undefined,
  module: AppModuleCode,
): boolean {
  const normalizedRole = role?.trim().toLowerCase() ?? 'staff';
  if (normalizedRole === 'superadmin' || normalizedRole === 'admin') {
    return resolveAllowedModules(role, grants).includes(module);
  }
  if (module === APP_MODULE_CODES.DASHBOARD) {
    return true;
  }
  const level = grantLevelForModule(grants, module);
  if (level === 'read' || level === 'write') {
    return true;
  }
  return false;
}

export function canWriteModule(
  role: string | null | undefined,
  grants: readonly StaffModuleGrant[] | undefined,
  module: AppModuleCode,
): boolean {
  const normalizedRole = role?.trim().toLowerCase() ?? 'staff';
  if (normalizedRole === 'superadmin' || normalizedRole === 'admin') {
    return resolveAllowedModules(role, grants).includes(module);
  }
  if (module === APP_MODULE_CODES.DASHBOARD) {
    return false;
  }
  const level = grantLevelForModule(grants, module);
  if (level === 'write') {
    return true;
  }
  return false;
}

export function canPostTripBitacora(
  role: string | null | undefined,
  grants: readonly StaffModuleGrant[] | undefined,
): boolean {
  return canReadModule(role, grants, APP_MODULE_CODES.TRIPS);
}

export function canMarkTripIncident(
  role: string | null | undefined,
  grants: readonly StaffModuleGrant[] | undefined,
): boolean {
  return canWriteModule(role, grants, APP_MODULE_CODES.TRIPS);
}

export function isOwnerRole(role: string | null | undefined): boolean {
  return role?.trim().toLowerCase() === 'superadmin';
}

export function isAdminRole(role: string | null | undefined): boolean {
  const normalized = role?.trim().toLowerCase();
  return normalized === 'admin' || normalized === 'superadmin';
}

export function roleDisplayLabel(role: string | null | undefined): string {
  const normalized = role?.trim().toLowerCase();
  if (normalized === 'superadmin') {
    return 'Propietario';
  }
  if (normalized === 'admin') {
    return 'Administrador';
  }
  if (normalized === 'staff') {
    return 'Staff';
  }
  return 'Usuario';
}

export function userRolePillClass(role: string | null | undefined): string {
  const base = 'to-table-pill to-table-pill--with-icon';
  const normalized = role?.trim().toLowerCase();
  if (normalized === 'superadmin') {
    return `${base} to-table-pill--user-owner`;
  }
  if (normalized === 'admin') {
    return `${base} to-table-pill--user-admin`;
  }
  if (normalized === 'staff') {
    return `${base} to-table-pill--user-staff`;
  }
  return `${base} to-table-pill--unknown`;
}

export function userStatusPillClass(status: string | null | undefined): string {
  const base = 'to-table-pill';
  return status === 'active'
    ? `${base} to-table-pill--user-active`
    : `${base} to-table-pill--user-inactive`;
}

export function userStatusPillLabel(status: string | null | undefined): string {
  return status === 'active' ? 'Activo' : 'Inactivo';
}

export function canAccessModule(
  allowedModules: readonly string[] | undefined,
  moduleCode: AppModuleCode,
): boolean {
  return (allowedModules ?? []).includes(moduleCode);
}

export function visibleNavItems(
  allowedModules: readonly string[] | undefined,
  placement: 'main' | 'bottom',
  items: readonly { path: string; label: string; module: AppModuleCode; placement: 'main' | 'bottom' }[],
) {
  return items.filter(
    (item) => item.placement === placement && canAccessModule(allowedModules, item.module),
  );
}

export function canManageUsers(role: UserRole | string | null | undefined): boolean {
  return isAdminRole(role);
}

export function canViewAccount(role: UserRole | string | null | undefined): boolean {
  return isOwnerRole(role);
}

export function isRbacModule(
  module: StaffGrantableModuleCode,
): module is (typeof STAFF_RBAC_MODULE_CODES)[number] {
  return (STAFF_RBAC_MODULE_CODES as readonly string[]).includes(module);
}

export function userRoleTableIcon(role: string | null | undefined): ToIconName {
  const normalized = role?.trim().toLowerCase();
  if (normalized === 'superadmin' || normalized === 'admin') {
    return 'groups';
  }
  return 'person';
}
