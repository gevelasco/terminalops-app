import { Injectable, inject } from '@angular/core';
import { jwtDecode } from 'jwt-decode';
import { map, Observable, tap } from 'rxjs';
import type { AuthUser, LoginResponse, SignUpRequest } from '@shared/models/auth.models';
import { normalizeApiIsoDate } from '@core/utils/api-date';
import { resolveAllowedModules } from '@shared/utils/access-control';
import { AuthService } from './api/auth';
import { LogoutService } from './logout.service';
import { SessionService } from './state/session';
import { ThemeService } from './state/theme';
import { UserProfileStore } from './state/user-profile';

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly auth = inject(AuthService);
  private readonly logoutService = inject(LogoutService);
  private readonly session = inject(SessionService);
  private readonly profiles = inject(UserProfileStore);
  private readonly theme = inject(ThemeService);

  login(email: string, password: string): Observable<void> {
    return this.auth.login({ email, password }).pipe(
      tap((response) => this.applyAuthResponse(response)),
      map(() => void 0),
    );
  }

  signUp(payload: SignUpRequest): Observable<void> {
    return this.auth.signUp(payload).pipe(
      tap((response) => this.applyAuthResponse(response)),
      map(() => void 0),
    );
  }

  logout(): void {
    this.logoutService.clearClientState();
  }

  isLoggedIn(): boolean {
    return this.session.isLoggedIn();
  }

  /** Hidrata sesión encriptada + perfil en memoria; sin requests extra. */
  applyAuthResponse(response: LoginResponse): void {
    const user = response.user;
    let payload: Partial<AuthUser> = {};
    try {
      payload = jwtDecode<AuthUser>(response.access_token);
    } catch {
      /* ignore */
    }

    const theme = user.theme === 'dark' ? 'dark' : 'light';
    const merged: AuthUser = {
      ...payload,
      ...user,
      theme,
      name: user.name ?? payload.name ?? '',
      email: user.email ?? payload.email ?? '',
      companyName: user.companyName ?? payload.companyName,
      phone: user.phone ?? payload.phone ?? '',
      jobTitle: user.jobTitle ?? payload.jobTitle,
      photoDataUrl: user.photoDataUrl ?? payload.photoDataUrl ?? '',
      memberSince:
        normalizeApiIsoDate(user.memberSince) ??
        normalizeApiIsoDate(payload.memberSince) ??
        user.memberSince,
      operationalAnalysisChangedAt:
        normalizeApiIsoDate(user.operationalAnalysisChangedAt) ??
        normalizeApiIsoDate(payload.operationalAnalysisChangedAt) ??
        user.operationalAnalysisChangedAt,
      tripAssistPrefillEnabled:
        user.tripAssistPrefillEnabled ??
        user.controlAutomaticRecognition ??
        payload.tripAssistPrefillEnabled ??
        payload.controlAutomaticRecognition ??
        false,
      tripAssistPrefillChangedAt:
        normalizeApiIsoDate(user.tripAssistPrefillChangedAt) ??
        normalizeApiIsoDate(user.controlAutomaticRecognitionChangedAt) ??
        normalizeApiIsoDate(payload.tripAssistPrefillChangedAt) ??
        normalizeApiIsoDate(payload.controlAutomaticRecognitionChangedAt) ??
        user.tripAssistPrefillChangedAt,
      tripAutoMaintenanceProvisionPercent: (() => {
        const raw =
          user.tripAutoMaintenanceProvisionPercent ??
          payload.tripAutoMaintenanceProvisionPercent;
        if (raw == null || !Number.isFinite(Number(raw))) {
          return 5;
        }
        const n = Number(raw);
        return n >= 0 && n <= 100 ? n : 5;
      })(),
      tripAutoFuelPaymentMethod:
        user.tripAutoFuelPaymentMethod ??
        payload.tripAutoFuelPaymentMethod ??
        'cash',
      tripAutoTollsPaymentMethod:
        user.tripAutoTollsPaymentMethod ??
        payload.tripAutoTollsPaymentMethod ??
        'cash',
      tripAutoPerDiemPaymentMethod:
        user.tripAutoPerDiemPaymentMethod ??
        payload.tripAutoPerDiemPaymentMethod ??
        'cash',
      tripAutoControlPaymentMethod:
        user.tripAutoControlPaymentMethod ??
        payload.tripAutoControlPaymentMethod ??
        'cash',
      allowedModules:
        user.allowedModules ??
        payload.allowedModules ??
        resolveAllowedModules(user.role ?? payload.role),
      maintenanceKmControlEnabled:
        user.maintenanceKmControlEnabled ?? payload.maintenanceKmControlEnabled ?? false,
      maintenanceKmIntervalDefault:
        user.maintenanceKmIntervalDefault ?? payload.maintenanceKmIntervalDefault,
      maintenanceDateControlEnabled:
        user.maintenanceDateControlEnabled ?? payload.maintenanceDateControlEnabled ?? false,
      maintenanceDatePeriodDefault:
        user.maintenanceDatePeriodDefault ?? payload.maintenanceDatePeriodDefault,
      maintenanceKmControlChangedAt:
        normalizeApiIsoDate(user.maintenanceKmControlChangedAt) ??
        normalizeApiIsoDate(payload.maintenanceKmControlChangedAt) ??
        user.maintenanceKmControlChangedAt,
      maintenanceDateControlChangedAt:
        normalizeApiIsoDate(user.maintenanceDateControlChangedAt) ??
        normalizeApiIsoDate(payload.maintenanceDateControlChangedAt) ??
        user.maintenanceDateControlChangedAt,
      operationalCenterPostalCode:
        user.operationalCenterPostalCode ?? payload.operationalCenterPostalCode,
      operationalCenterCityMunicipality:
        user.operationalCenterCityMunicipality ??
        payload.operationalCenterCityMunicipality,
      operationalCenterLocality:
        user.operationalCenterLocality ?? payload.operationalCenterLocality,
      operationalCenterSettlementConsId:
        user.operationalCenterSettlementConsId ??
        payload.operationalCenterSettlementConsId,
      operationalCenterLatitude:
        user.operationalCenterLatitude ?? payload.operationalCenterLatitude,
      operationalCenterLongitude:
        user.operationalCenterLongitude ?? payload.operationalCenterLongitude,
    };

    this.session.setSession(response.access_token, response.refresh_token, merged);
    this.profiles.hydrateFromSession();
    this.theme.setPreset(theme);
  }
}
