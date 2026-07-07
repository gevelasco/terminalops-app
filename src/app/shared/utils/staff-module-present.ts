import {
  APP_MODULE_CODES,
  APP_NAV_ITEMS,
  STAFF_MODULE_OPTIONS,
  type AppModuleCode,
  type StaffGrantableModuleCode,
} from '@shared/models/app-modules.models';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';

export const STAFF_MODULE_ICON_BY_CODE: Record<StaffGrantableModuleCode, ToIconName> = {
  [APP_MODULE_CODES.TRIPS]: 'route',
  [APP_MODULE_CODES.FLEET]: 'truck',
  [APP_MODULE_CODES.OPERATORS]: 'groups',
  [APP_MODULE_CODES.CLIENTS]: 'enterprise',
  [APP_MODULE_CODES.EXPENSES]: 'settlement',
  [APP_MODULE_CODES.REPORTS]: 'chartBar',
};

const MODULE_ICON_BY_CODE: Partial<Record<AppModuleCode, ToIconName>> = {
  [APP_MODULE_CODES.DASHBOARD]: 'grid',
  [APP_MODULE_CODES.USUARIOS]: 'person',
  [APP_MODULE_CODES.CUENTA]: 'document',
  ...STAFF_MODULE_ICON_BY_CODE,
};

export interface ModulePermissionChip {
  code: string;
  label: string;
  icon: ToIconName;
}

export function staffModuleIcon(code: StaffGrantableModuleCode): ToIconName {
  return STAFF_MODULE_ICON_BY_CODE[code];
}

export interface UserTableModuleIcon {
  label: string;
  icon: ToIconName;
  active: boolean;
}

/** Iconos de módulos para la tabla de usuarios: todos visibles, activos si hay acceso. */
export function userTableModuleIcons(
  allowedModules: readonly string[] | undefined,
  role: string,
): UserTableModuleIcon[] {
  const granted = new Set(allowedModules ?? []);
  const allStaffLit = role === 'admin' || role === 'superadmin';
  return STAFF_MODULE_OPTIONS.map((option) => ({
    label: option.label,
    icon: staffModuleIcon(option.code),
    active: allStaffLit || granted.has(option.code),
  }));
}

export function modulePermissionChips(
  allowedModules: readonly string[] | undefined,
): ModulePermissionChip[] {
  const navByModule = new Map(
    APP_NAV_ITEMS.map((item) => [item.module, item.label] as const),
  );
  const staffLabelByCode = new Map(
    STAFF_MODULE_OPTIONS.map((option) => [option.code, option.label] as const),
  );

  return (allowedModules ?? [])
    .filter((code) => code !== APP_MODULE_CODES.DASHBOARD)
    .map((code) => {
      const moduleCode = code as AppModuleCode;
      return {
        code,
        label:
          navByModule.get(moduleCode) ??
          staffLabelByCode.get(code as StaffGrantableModuleCode) ??
          code,
        icon: MODULE_ICON_BY_CODE[moduleCode] ?? 'list',
      };
    });
}
