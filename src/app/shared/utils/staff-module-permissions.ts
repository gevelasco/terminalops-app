import {
  APP_MODULE_CODES,
  STAFF_GRANTABLE_MODULE_CODES,
  STAFF_MODULE_OPTIONS,
  type ModuleAccessLevel,
  type StaffGrantableModuleCode,
  type StaffModuleGrant,
} from '@shared/models/app-modules.models';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';
import { staffModuleIcon } from '@shared/utils/staff-module-present';

export interface StaffModulePermissionDraft {
  read: boolean;
  write: boolean;
}

export type StaffModulePermissionDraftMap = Record<
  StaffGrantableModuleCode,
  StaffModulePermissionDraft
>;

export function emptyStaffModulePermissionDraftMap(): StaffModulePermissionDraftMap {
  return STAFF_GRANTABLE_MODULE_CODES.reduce((acc, code) => {
    acc[code] = { read: false, write: false };
    return acc;
  }, {} as StaffModulePermissionDraftMap);
}

export function staffModuleGrantsFromDraft(
  draft: StaffModulePermissionDraftMap,
): StaffModuleGrant[] {
  const grants: StaffModuleGrant[] = [];
  for (const code of STAFF_GRANTABLE_MODULE_CODES) {
    const state = draft[code];
    if (!state?.read && !state?.write) {
      continue;
    }
    if (state.write) {
      grants.push({ module: code, level: 'write' });
      continue;
    }
    if (state.read) {
      grants.push({ module: code, level: 'read' });
    }
  }
  return grants;
}

export function staffModulePermissionDraftFromGrants(
  grants: readonly StaffModuleGrant[] | undefined,
  legacyModuleCodes: readonly StaffGrantableModuleCode[] | undefined,
): StaffModulePermissionDraftMap {
  const draft = emptyStaffModulePermissionDraftMap();
  const rows = grants?.length
    ? grants
    : (legacyModuleCodes ?? []).map((module) => ({
        module,
        level: 'write' as ModuleAccessLevel,
      }));

  for (const grant of rows) {
    const code = grant.module;
    if (!(code in draft)) {
      continue;
    }
    if (grant.level === 'write') {
      draft[code] = { read: true, write: true };
    } else {
      draft[code] = { read: true, write: false };
    }
  }
  return draft;
}

export function moduleCodesFromStaffModuleGrants(
  grants: readonly StaffModuleGrant[] | undefined,
): StaffGrantableModuleCode[] {
  return (grants ?? []).map((grant) => grant.module);
}

export function moduleAccessLevelLabel(level: ModuleAccessLevel): string {
  return level === 'read' ? 'Lectura' : 'Escritura';
}

export interface StaffModulePermissionSummaryRow {
  label: string;
  icon: ToIconName;
  active: boolean;
  summary: string;
}

export function staffModulePermissionSummary(
  grants: readonly StaffModuleGrant[] | undefined,
  legacyModuleCodes: readonly StaffGrantableModuleCode[] | undefined,
  role: string,
): StaffModulePermissionSummaryRow[] {
  const allAccess = role === 'admin' || role === 'superadmin';
  const draft = staffModulePermissionDraftFromGrants(grants, legacyModuleCodes);
  return STAFF_GRANTABLE_MODULE_CODES.map((code) => {
    const option = STAFF_MODULE_OPTIONS.find((row) => row.code === code);
    const state = draft[code];
    const active = allAccess || state.read || state.write;
    let summary = 'Sin acceso';
    if (allAccess) {
      summary = 'Lectura y escritura';
    } else if (state.write) {
      summary = 'Lectura y escritura';
    } else if (state.read) {
      summary = 'Solo lectura';
    }
    return {
      label: option?.label ?? code,
      icon: staffModuleIcon(code),
      active,
      summary,
    };
  });
}
