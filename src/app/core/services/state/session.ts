import { Injectable, computed, signal } from '@angular/core';
import { jwtDecode } from 'jwt-decode';
import type {
  AuthUser,
  LoginResponse,
  SessionData,
  ThemeScheme,
} from '@shared/models/auth.models';
import type { CompanyOperationalSettings } from '@shared/models/company-operational-settings.models';
import type { MaintenanceDatePeriod } from '@shared/models/company-operational-settings.models';
import { normalizeApiIsoDate } from '@core/utils/api-date';
import {
  resolveAllowedModules,
  canReadModule as canReadModuleAccess,
  canWriteModule as canWriteModuleAccess,
  resolveStaffModuleGrants,
} from '@shared/utils/access-control';
import { APP_MODULE_CODES, type AppModuleCode } from '@shared/models/app-modules.models';

const SESSION_STORAGE_KEY = '_to_s';
const SESSION_OBFUSCATE_KEY = 't3rm1n4l0ps_s3ss10n';

function obfuscate(str: string, key: string): string {
  const keyLen = key.length;
  const chars = str.split('').map((c, i) => {
    const code = c.charCodeAt(0) ^ key.charCodeAt(i % keyLen);
    return String.fromCharCode(code & 0xff);
  });
  return btoa(chars.join(''));
}

function deobfuscate(obfuscated: string, key: string): string {
  try {
    const decoded = atob(obfuscated);
    const keyLen = key.length;
    const chars = decoded.split('').map((c, i) => {
      const code = c.charCodeAt(0) ^ key.charCodeAt(i % keyLen);
      return String.fromCharCode(code & 0xff);
    });
    return chars.join('');
  } catch {
    return '';
  }
}

function loadEncryptedSession(): SessionData | null {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    const legacy = sessionStorage.getItem('terminalops.session');
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy) as SessionData;
        if (parsed?.token) {
          saveEncryptedSession(parsed);
          sessionStorage.removeItem('terminalops.session');
          return parsed;
        }
      } catch {
        sessionStorage.removeItem('terminalops.session');
      }
    }
    return null;
  }
  const json = deobfuscate(raw, SESSION_OBFUSCATE_KEY);
  if (!json) {
    return null;
  }
  try {
    const data = JSON.parse(json) as SessionData;
    return data?.token ? data : null;
  } catch {
    return null;
  }
}

function saveEncryptedSession(data: SessionData): void {
  sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    obfuscate(JSON.stringify(data), SESSION_OBFUSCATE_KEY),
  );
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly data = signal<SessionData | null>(loadEncryptedSession());

  readonly token = computed(() => this.data()?.token ?? null);
  readonly refreshToken = computed(() => this.data()?.refreshToken ?? null);
  readonly role = computed(() => this.data()?.role ?? null);
  readonly allowedModules = computed(() => this.data()?.allowedModules ?? []);
  readonly moduleGrants = computed(() =>
    resolveStaffModuleGrants(this.data()?.moduleGrants ?? []),
  );
  readonly companyId = computed(() => this.data()?.companyId ?? null);
  readonly companyName = computed(() => this.data()?.companyName ?? null);
  readonly companyTagline = computed(() => this.data()?.companyTagline ?? null);
  readonly theme = computed(() => this.data()?.theme ?? 'light');
  readonly userId = computed(() => this.data()?.id ?? null);
  readonly username = computed(() => this.data()?.username ?? null);
  readonly name = computed(() => this.data()?.name ?? null);
  readonly email = computed(() => this.data()?.email ?? null);
  readonly phone = computed(() => this.data()?.phone ?? null);
  readonly jobTitle = computed(() => this.data()?.jobTitle ?? null);
  readonly photoDataUrl = computed(() => this.data()?.photoDataUrl ?? null);
  readonly memberSince = computed(() => this.data()?.memberSince ?? null);
  readonly department = computed(() => this.data()?.department ?? null);
  readonly workLocation = computed(() => this.data()?.workLocation ?? null);
  readonly employeeId = computed(() => this.data()?.employeeId ?? null);
  readonly operationalAnalysisEnabled = computed(
    () => this.data()?.operationalAnalysisEnabled ?? true,
  );
  readonly operationalAnalysisChangedAt = computed(
    () => this.data()?.operationalAnalysisChangedAt ?? null,
  );
  readonly tripAssistPrefillEnabled = computed(
    () =>
      this.data()?.tripAssistPrefillEnabled ??
      this.data()?.controlAutomaticRecognition ??
      false,
  );
  readonly tripAssistPrefillChangedAt = computed(
    () =>
      this.data()?.tripAssistPrefillChangedAt ??
      this.data()?.controlAutomaticRecognitionChangedAt ??
      null,
  );
  readonly tripAutoMaintenanceProvisionPercent = computed(() => {
    const raw = this.data()?.tripAutoMaintenanceProvisionPercent;
    if (raw == null || !Number.isFinite(raw)) {
      return 5;
    }
    return raw >= 0 && raw <= 100 ? raw : 5;
  });
  readonly tripAutoFuelPaymentMethod = computed(
    () => this.data()?.tripAutoFuelPaymentMethod ?? 'cash',
  );
  readonly tripAutoTollsPaymentMethod = computed(
    () => this.data()?.tripAutoTollsPaymentMethod ?? 'cash',
  );
  readonly tripAutoPerDiemPaymentMethod = computed(
    () => this.data()?.tripAutoPerDiemPaymentMethod ?? 'cash',
  );
  readonly tripAutoControlPaymentMethod = computed(
    () => this.data()?.tripAutoControlPaymentMethod ?? 'cash',
  );
  readonly dieselControlEnabled = computed(
    () => this.data()?.dieselControlEnabled ?? true,
  );
  readonly dieselControlChangedAt = computed(
    () => this.data()?.dieselControlChangedAt ?? null,
  );
  readonly controlAutomaticRecognition = computed(
    () => this.tripAssistPrefillEnabled(),
  );
  readonly controlAutomaticRecognitionChangedAt = computed(
    () => this.tripAssistPrefillChangedAt(),
  );
  readonly maintenanceKmControlEnabled = computed(
    () => this.data()?.maintenanceKmControlEnabled ?? false,
  );
  readonly maintenanceKmIntervalDefault = computed(
    () => this.data()?.maintenanceKmIntervalDefault ?? null,
  );
  readonly maintenanceDateControlEnabled = computed(
    () => this.data()?.maintenanceDateControlEnabled ?? false,
  );
  readonly maintenanceDatePeriodDefault = computed(
    () => this.data()?.maintenanceDatePeriodDefault ?? null,
  );
  readonly maintenanceKmControlChangedAt = computed(
    () => this.data()?.maintenanceKmControlChangedAt ?? null,
  );
  readonly maintenanceDateControlChangedAt = computed(
    () => this.data()?.maintenanceDateControlChangedAt ?? null,
  );
  readonly operationalCenterId = computed(
    () => this.data()?.operationalCenterId ?? null,
  );
  readonly operationalCenterName = computed(
    () => this.data()?.operationalCenterName ?? null,
  );
  readonly operationalCenterPostalCode = computed(
    () => this.data()?.operationalCenterPostalCode ?? null,
  );
  readonly operationalCenterCityMunicipality = computed(
    () => this.data()?.operationalCenterCityMunicipality ?? null,
  );
  readonly operationalCenterLocality = computed(
    () => this.data()?.operationalCenterLocality ?? null,
  );
  readonly operationalCenterSettlementConsId = computed(
    () => this.data()?.operationalCenterSettlementConsId ?? null,
  );
  readonly operationalCenterLatitude = computed(
    () => this.data()?.operationalCenterLatitude ?? null,
  );
  readonly operationalCenterLongitude = computed(
    () => this.data()?.operationalCenterLongitude ?? null,
  );

  canReadModule(module: AppModuleCode): boolean {
    return canReadModuleAccess(this.role(), this.moduleGrants(), module);
  }

  canWriteModule(module: AppModuleCode): boolean {
    return canWriteModuleAccess(this.role(), this.moduleGrants(), module);
  }

  canPostTripBitacora(): boolean {
    return this.canReadModule(APP_MODULE_CODES.TRIPS);
  }

  canMarkTripIncident(): boolean {
    return this.canWriteModule(APP_MODULE_CODES.TRIPS);
  }

  isLoggedIn(): boolean {
    const d = this.data();
    return !!d?.token && !!d.companyId;
  }

  setSession(
    token: string,
    refreshToken: string,
    user: AuthUser,
  ): void {
    const session = this.buildSessionData(token, refreshToken, user);
    this.data.set(session);
    saveEncryptedSession(session);
  }

  setSessionFromLoginResponse(response: LoginResponse): void {
    this.setSession(response.access_token, response.refresh_token, response.user);
  }

  updateTokens(accessToken: string, refreshToken: string, user?: AuthUser): void {
    const current = this.data();
    if (!current) {
      return;
    }
    const next: SessionData = user
      ? this.buildSessionData(accessToken, refreshToken, user)
      : { ...current, token: accessToken, refreshToken };
    this.data.set(next);
    saveEncryptedSession(next);
  }

  setCompanyName(companyName: string): void {
    const current = this.data();
    if (!current) {
      return;
    }
    const next = { ...current, companyName };
    this.data.set(next);
    saveEncryptedSession(next);
  }

  setCompanyBranding(companyName: string, companyTagline: string): void {
    const current = this.data();
    if (!current) {
      return;
    }
    const next = { ...current, companyName, companyTagline };
    this.data.set(next);
    saveEncryptedSession(next);
  }

  syncCompanyOperationalSettings(
    patch: Partial<
      Pick<
        CompanyOperationalSettings,
        | 'operationalAnalysisEnabled'
        | 'tripAssistPrefillEnabled'
        | 'tripAutoMaintenanceProvisionPercent'
        | 'tripAutoFuelPaymentMethod'
        | 'tripAutoTollsPaymentMethod'
        | 'tripAutoPerDiemPaymentMethod'
        | 'tripAutoControlPaymentMethod'
        | 'dieselControlEnabled'
        | 'maintenanceKmControlEnabled'
        | 'maintenanceKmIntervalDefault'
        | 'maintenanceDateControlEnabled'
        | 'maintenanceDatePeriodDefault'
        | 'maintenanceKmControlChangedAt'
        | 'maintenanceDateControlChangedAt'
        | 'operationalCenterName'
        | 'operationalCenterPostalCode'
        | 'operationalCenterCityMunicipality'
        | 'operationalCenterLocality'
        | 'operationalCenterSettlementConsId'
        | 'operationalCenterLatitude'
        | 'operationalCenterLongitude'
      >
    > & {
      companyName?: string;
      operationalAnalysisChangedAt?: string | null;
      tripAssistPrefillChangedAt?: string | null;
      dieselControlChangedAt?: string | null;
      maintenanceKmIntervalDefault?: number | null;
      maintenanceDatePeriodDefault?: MaintenanceDatePeriod | null;
      maintenanceKmControlChangedAt?: string | null;
      maintenanceDateControlChangedAt?: string | null;
      operationalCenterId?: string | null;
      operationalCenterName?: string | null;
      operationalCenterPostalCode?: string | null;
      operationalCenterCityMunicipality?: string | null;
      operationalCenterLocality?: string | null;
      operationalCenterSettlementConsId?: string | null;
      operationalCenterLatitude?: number | null;
      operationalCenterLongitude?: number | null;
    },
  ): void {
    const current = this.data();
    if (!current) {
      return;
    }
    const next: SessionData = { ...current };
    if (patch.companyName?.trim()) {
      next.companyName = patch.companyName.trim();
    }
    if (patch.operationalAnalysisEnabled !== undefined) {
      next.operationalAnalysisEnabled = patch.operationalAnalysisEnabled;
    }
    if (patch.tripAssistPrefillEnabled !== undefined) {
      next.tripAssistPrefillEnabled = patch.tripAssistPrefillEnabled;
      next.controlAutomaticRecognition = patch.tripAssistPrefillEnabled;
    }
    if (patch.tripAutoMaintenanceProvisionPercent !== undefined) {
      next.tripAutoMaintenanceProvisionPercent = patch.tripAutoMaintenanceProvisionPercent;
    }
    if (patch.tripAutoFuelPaymentMethod !== undefined) {
      next.tripAutoFuelPaymentMethod = patch.tripAutoFuelPaymentMethod;
    }
    if (patch.tripAutoTollsPaymentMethod !== undefined) {
      next.tripAutoTollsPaymentMethod = patch.tripAutoTollsPaymentMethod;
    }
    if (patch.tripAutoPerDiemPaymentMethod !== undefined) {
      next.tripAutoPerDiemPaymentMethod = patch.tripAutoPerDiemPaymentMethod;
    }
    if (patch.tripAutoControlPaymentMethod !== undefined) {
      next.tripAutoControlPaymentMethod = patch.tripAutoControlPaymentMethod;
    }
    const prefillChangedAt = normalizeApiIsoDate(patch.tripAssistPrefillChangedAt);
    if (prefillChangedAt) {
      next.tripAssistPrefillChangedAt = prefillChangedAt;
      next.controlAutomaticRecognitionChangedAt = prefillChangedAt;
    } else if (patch.tripAssistPrefillChangedAt === null) {
      next.tripAssistPrefillChangedAt = undefined;
      next.controlAutomaticRecognitionChangedAt = undefined;
    }
    if (patch.dieselControlEnabled !== undefined) {
      next.dieselControlEnabled = patch.dieselControlEnabled;
    }
    const dieselChangedAt = normalizeApiIsoDate(patch.dieselControlChangedAt);
    if (dieselChangedAt) {
      next.dieselControlChangedAt = dieselChangedAt;
    } else if (patch.dieselControlChangedAt === null) {
      next.dieselControlChangedAt = undefined;
    }
    const changedAt = normalizeApiIsoDate(patch.operationalAnalysisChangedAt);
    if (changedAt) {
      next.operationalAnalysisChangedAt = changedAt;
    }
    if (patch.maintenanceKmControlEnabled !== undefined) {
      next.maintenanceKmControlEnabled = patch.maintenanceKmControlEnabled;
    }
    if (patch.maintenanceKmIntervalDefault !== undefined) {
      next.maintenanceKmIntervalDefault =
        patch.maintenanceKmIntervalDefault === null
          ? undefined
          : patch.maintenanceKmIntervalDefault;
    }
    if (patch.maintenanceDateControlEnabled !== undefined) {
      next.maintenanceDateControlEnabled = patch.maintenanceDateControlEnabled;
    }
    if (patch.maintenanceDatePeriodDefault !== undefined) {
      next.maintenanceDatePeriodDefault =
        patch.maintenanceDatePeriodDefault === null
          ? undefined
          : patch.maintenanceDatePeriodDefault;
    }
    const kmChangedAt = normalizeApiIsoDate(patch.maintenanceKmControlChangedAt);
    if (kmChangedAt) {
      next.maintenanceKmControlChangedAt = kmChangedAt;
    } else if (patch.maintenanceKmControlChangedAt === null) {
      next.maintenanceKmControlChangedAt = undefined;
    }
    const dateChangedAt = normalizeApiIsoDate(patch.maintenanceDateControlChangedAt);
    if (dateChangedAt) {
      next.maintenanceDateControlChangedAt = dateChangedAt;
    } else if (patch.maintenanceDateControlChangedAt === null) {
      next.maintenanceDateControlChangedAt = undefined;
    }
    if (patch.operationalCenterId !== undefined) {
      next.operationalCenterId =
        patch.operationalCenterId === null
          ? undefined
          : patch.operationalCenterId;
    }
    if (patch.operationalCenterName !== undefined) {
      next.operationalCenterName =
        patch.operationalCenterName === null
          ? undefined
          : patch.operationalCenterName;
    }
    if (patch.operationalCenterPostalCode !== undefined) {
      next.operationalCenterPostalCode =
        patch.operationalCenterPostalCode === null
          ? undefined
          : patch.operationalCenterPostalCode;
    }
    if (patch.operationalCenterCityMunicipality !== undefined) {
      next.operationalCenterCityMunicipality =
        patch.operationalCenterCityMunicipality === null
          ? undefined
          : patch.operationalCenterCityMunicipality;
    }
    if (patch.operationalCenterLocality !== undefined) {
      next.operationalCenterLocality =
        patch.operationalCenterLocality === null
          ? undefined
          : patch.operationalCenterLocality;
    }
    if (patch.operationalCenterSettlementConsId !== undefined) {
      next.operationalCenterSettlementConsId =
        patch.operationalCenterSettlementConsId === null
          ? undefined
          : patch.operationalCenterSettlementConsId;
    }
    if (patch.operationalCenterLatitude !== undefined) {
      next.operationalCenterLatitude =
        patch.operationalCenterLatitude === null
          ? undefined
          : patch.operationalCenterLatitude;
    }
    if (patch.operationalCenterLongitude !== undefined) {
      next.operationalCenterLongitude =
        patch.operationalCenterLongitude === null
          ? undefined
          : patch.operationalCenterLongitude;
    }
    this.data.set(next);
    saveEncryptedSession(next);
  }

  /** @deprecated Use syncCompanyOperationalSettings */
  syncCompanyProfile(patch: {
    companyName?: string;
    operationalAnalysisEnabled?: boolean;
    operationalAnalysisChangedAt?: string | null;
  }): void {
    this.syncCompanyOperationalSettings(patch);
  }

  syncUserProfile(patch: {
    name?: string;
    username?: string;
    email?: string;
    phone?: string;
    jobTitle?: string;
    photoDataUrl?: string;
  }): void {
    const current = this.data();
    if (!current) {
      return;
    }
    const next: SessionData = { ...current };
    if (patch.name?.trim()) {
      next.name = patch.name.trim();
    }
    if (patch.username?.trim()) {
      next.username = patch.username.trim().toLowerCase();
    }
    if (patch.email !== undefined) {
      next.email = patch.email.trim();
    }
    if (patch.phone !== undefined) {
      next.phone = patch.phone.trim();
    }
    if (patch.jobTitle !== undefined) {
      next.jobTitle = patch.jobTitle.trim();
    }
    if (patch.photoDataUrl !== undefined) {
      next.photoDataUrl = patch.photoDataUrl.trim();
    }
    this.data.set(next);
    saveEncryptedSession(next);
  }

  syncUserPreferenceSettings(patch: {
    controlAutomaticRecognition?: boolean;
    controlAutomaticRecognitionChangedAt?: string | null;
  }): void {
    const current = this.data();
    if (!current) {
      return;
    }
    const next: SessionData = { ...current };
    if (patch.controlAutomaticRecognition !== undefined) {
      next.controlAutomaticRecognition = patch.controlAutomaticRecognition;
    }
    const changedAt = normalizeApiIsoDate(patch.controlAutomaticRecognitionChangedAt);
    if (changedAt) {
      next.controlAutomaticRecognitionChangedAt = changedAt;
    } else if (patch.controlAutomaticRecognitionChangedAt === null) {
      next.controlAutomaticRecognitionChangedAt = undefined;
    }
    this.data.set(next);
    saveEncryptedSession(next);
  }

  updateOperationalAnalysisEnabled(enabled: boolean, changedAt?: string): void {
    const current = this.data();
    if (!current) {
      return;
    }
    const next = {
      ...current,
      operationalAnalysisEnabled: enabled,
      operationalAnalysisChangedAt:
        changedAt ?? new Date().toISOString(),
    };
    this.data.set(next);
    saveEncryptedSession(next);
  }

  updateTheme(theme: ThemeScheme): void {
    const current = this.data();
    if (!current) {
      return;
    }
    const next = { ...current, theme };
    this.data.set(next);
    saveEncryptedSession(next);
  }

  clearSession(): void {
    this.data.set(null);
  }

  private buildSessionData(
    token: string,
    refreshToken: string,
    user: AuthUser,
  ): SessionData {
    const payload = this.decodeToken(token);
    return {
      token,
      refreshToken,
      role: user.role ?? payload?.role ?? 'staff',
      allowedModules:
        user.allowedModules ??
        payload?.allowedModules ??
        resolveAllowedModules(
          user.role ?? payload?.role,
          user.moduleGrants ?? payload?.moduleGrants,
        ),
      moduleGrants: resolveStaffModuleGrants(
        user.moduleGrants ?? payload?.moduleGrants ?? [],
      ),
      companyId: String(user.companyId ?? payload?.companyId ?? ''),
      companyName: user.companyName ?? payload?.companyName,
      theme: user.theme === 'dark' ? 'dark' : 'light',
      id: String(user.id ?? payload?.id ?? ''),
      username: user.username ?? payload?.username ?? '',
      name: user.name ?? payload?.name,
      email: user.email ?? payload?.email,
      phone: user.phone ?? payload?.phone,
      jobTitle: user.jobTitle ?? payload?.jobTitle,
      photoDataUrl: user.photoDataUrl ?? payload?.photoDataUrl ?? '',
      memberSince:
        normalizeApiIsoDate(user.memberSince) ??
        normalizeApiIsoDate(payload?.memberSince) ??
        undefined,
      department: user.department ?? payload?.department,
      workLocation: user.workLocation ?? payload?.workLocation,
      employeeId: user.employeeId ?? payload?.employeeId,
      operationalAnalysisEnabled:
        user.operationalAnalysisEnabled ?? payload?.operationalAnalysisEnabled ?? true,
      operationalAnalysisChangedAt:
        normalizeApiIsoDate(user.operationalAnalysisChangedAt) ??
        normalizeApiIsoDate(payload?.operationalAnalysisChangedAt) ??
        undefined,
      tripAssistPrefillEnabled:
        user.tripAssistPrefillEnabled ??
        user.controlAutomaticRecognition ??
        payload?.tripAssistPrefillEnabled ??
        payload?.controlAutomaticRecognition ??
        false,
      tripAssistPrefillChangedAt:
        normalizeApiIsoDate(user.tripAssistPrefillChangedAt) ??
        normalizeApiIsoDate(user.controlAutomaticRecognitionChangedAt) ??
        normalizeApiIsoDate(payload?.tripAssistPrefillChangedAt) ??
        normalizeApiIsoDate(payload?.controlAutomaticRecognitionChangedAt) ??
        undefined,
      tripAutoMaintenanceProvisionPercent: (() => {
        const raw =
          user.tripAutoMaintenanceProvisionPercent ??
          payload?.tripAutoMaintenanceProvisionPercent;
        if (raw == null || !Number.isFinite(Number(raw))) {
          return 5;
        }
        const n = Number(raw);
        return n >= 0 && n <= 100 ? n : 5;
      })(),
      tripAutoFuelPaymentMethod:
        user.tripAutoFuelPaymentMethod ??
        payload?.tripAutoFuelPaymentMethod ??
        'cash',
      tripAutoTollsPaymentMethod:
        user.tripAutoTollsPaymentMethod ??
        payload?.tripAutoTollsPaymentMethod ??
        'cash',
      tripAutoPerDiemPaymentMethod:
        user.tripAutoPerDiemPaymentMethod ??
        payload?.tripAutoPerDiemPaymentMethod ??
        'cash',
      tripAutoControlPaymentMethod:
        user.tripAutoControlPaymentMethod ??
        payload?.tripAutoControlPaymentMethod ??
        'cash',
      dieselControlEnabled:
        user.dieselControlEnabled ?? payload?.dieselControlEnabled ?? true,
      dieselControlChangedAt:
        normalizeApiIsoDate(user.dieselControlChangedAt) ??
        normalizeApiIsoDate(payload?.dieselControlChangedAt) ??
        undefined,
      controlAutomaticRecognition:
        user.tripAssistPrefillEnabled ??
        user.controlAutomaticRecognition ??
        payload?.tripAssistPrefillEnabled ??
        payload?.controlAutomaticRecognition ??
        false,
      controlAutomaticRecognitionChangedAt:
        normalizeApiIsoDate(user.tripAssistPrefillChangedAt) ??
        normalizeApiIsoDate(user.controlAutomaticRecognitionChangedAt) ??
        normalizeApiIsoDate(payload?.tripAssistPrefillChangedAt) ??
        normalizeApiIsoDate(payload?.controlAutomaticRecognitionChangedAt) ??
        undefined,
      maintenanceKmControlEnabled:
        user.maintenanceKmControlEnabled ??
        payload?.maintenanceKmControlEnabled ??
        false,
      maintenanceKmIntervalDefault:
        user.maintenanceKmIntervalDefault ??
        payload?.maintenanceKmIntervalDefault,
      maintenanceDateControlEnabled:
        user.maintenanceDateControlEnabled ??
        payload?.maintenanceDateControlEnabled ??
        false,
      maintenanceDatePeriodDefault:
        user.maintenanceDatePeriodDefault ?? payload?.maintenanceDatePeriodDefault,
      maintenanceKmControlChangedAt:
        normalizeApiIsoDate(user.maintenanceKmControlChangedAt) ??
        normalizeApiIsoDate(payload?.maintenanceKmControlChangedAt) ??
        undefined,
      maintenanceDateControlChangedAt:
        normalizeApiIsoDate(user.maintenanceDateControlChangedAt) ??
        normalizeApiIsoDate(payload?.maintenanceDateControlChangedAt) ??
        undefined,
      operationalCenterId:
        user.operationalCenterId ?? payload?.operationalCenterId,
      operationalCenterName:
        user.operationalCenterName ?? payload?.operationalCenterName,
      operationalCenterPostalCode:
        user.operationalCenterPostalCode ?? payload?.operationalCenterPostalCode,
      operationalCenterCityMunicipality:
        user.operationalCenterCityMunicipality ??
        payload?.operationalCenterCityMunicipality,
      operationalCenterLocality:
        user.operationalCenterLocality ?? payload?.operationalCenterLocality,
      operationalCenterSettlementConsId:
        user.operationalCenterSettlementConsId ??
        payload?.operationalCenterSettlementConsId,
      operationalCenterLatitude:
        user.operationalCenterLatitude ?? payload?.operationalCenterLatitude,
      operationalCenterLongitude:
        user.operationalCenterLongitude ?? payload?.operationalCenterLongitude,
    };
  }

  private decodeToken(token: string): Partial<AuthUser> | null {
    try {
      return jwtDecode<AuthUser>(token);
    } catch {
      return null;
    }
  }
}
