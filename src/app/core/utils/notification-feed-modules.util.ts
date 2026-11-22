import type { AppModuleCode } from '@shared/models/app-modules.models';
import {
  NOTIFICATION_FEED_MODULE_CODES,
  NOTIFICATION_FEED_MODULE_OPTIONS,
} from '@shared/models/app-modules.models';

export function resolveEffectiveNotificationFeedModules(
  stored: string[] | null | undefined,
  allowedModules: readonly string[],
): Set<AppModuleCode> {
  const allowed = new Set(
    allowedModules.map((m) => m.trim()).filter(Boolean) as AppModuleCode[],
  );
  const notifiable = new Set<AppModuleCode>(
    NOTIFICATION_FEED_MODULE_CODES.filter((code) => allowed.has(code)),
  );
  if (stored == null) {
    return notifiable;
  }
  const enabled = new Set<AppModuleCode>();
  for (const code of stored) {
    const m = code.trim() as AppModuleCode;
    if (m && notifiable.has(m)) {
      enabled.add(m);
    }
  }
  return enabled;
}

export function notificationModuleOptionsForUser(
  allowedModules: readonly string[],
): { code: AppModuleCode; label: string }[] {
  const allowed = new Set(allowedModules);
  return NOTIFICATION_FEED_MODULE_OPTIONS.filter((opt) => allowed.has(opt.code));
}

export function enabledModulesToPatch(enabled: Set<AppModuleCode>): string[] {
  return [...enabled];
}