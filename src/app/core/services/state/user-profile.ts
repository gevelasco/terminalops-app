import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import type { UserProfile } from '@core/models/user-profile.models';
import { UsersService } from '@core/services/api/users';
import { SessionService } from '@core/services/state/session';
import { isNumericPublicId } from '@core/utils/api-date';
import { mapUserMeToProfile, profileToPatchBody } from '@core/utils/user-profile-api';
import type { ThemeScheme, UserRole } from '@shared/models/auth.models';

const ROLE_JOB_TITLES: Record<UserRole, string> = {
  superadmin: 'Propietario',
  admin: 'Administrador',
  staff: 'Staff',
};

export function profileStorageKey(username: string): string {
  return `terminalops.user-profile.${username.trim().toLowerCase()}`;
}

export function profileFromSession(session: SessionService): UserProfile | null {
  const username = session.username()?.trim().toLowerCase();
  if (!username) {
    return null;
  }
  const role = (session.role() ?? 'staff') as UserRole;
  const employeeRaw =
    session.employeeId()?.trim() ?? session.userId()?.trim() ?? '';
  return {
    username,
    displayName: session.name()?.trim() || username,
    jobTitle:
      session.jobTitle()?.trim() ||
      ROLE_JOB_TITLES[role] ||
      ROLE_JOB_TITLES.staff,
    email: session.email()?.trim() ?? '',
    phone: session.phone()?.trim() ?? '',
    photoDataUrl: session.photoDataUrl()?.trim() ?? '',
    memberSince: session.memberSince()?.trim() ?? '',
    department: session.department()?.trim() ?? 'Gerencia',
    employeeId: isNumericPublicId(employeeRaw) ? employeeRaw : '',
    workLocation:
      session.workLocation()?.trim() ?? session.companyName()?.trim() ?? '',
  };
}

export function defaultUserProfile(username: string, session?: SessionService): UserProfile {
  if (session) {
    const fromSession = profileFromSession(session);
    if (fromSession) {
      return fromSession;
    }
  }
  const u = username.trim().toLowerCase();
  const label = u ? u.charAt(0).toUpperCase() + u.slice(1) : 'Usuario';
  return {
    username: u || 'usuario',
    displayName: label,
    jobTitle: ROLE_JOB_TITLES.staff,
    email: '',
    phone: '',
    photoDataUrl: '',
    memberSince: '',
    department: 'Gerencia',
    employeeId: '',
    workLocation: '',
  };
}

export function initialsFromDisplayName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  const compact = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length >= 2) {
    return compact.slice(0, 2);
  }
  if (compact.length === 1) {
    return `${compact}·`;
  }
  return '??';
}

/** Perfil en memoria; fuente de verdad en sesión encriptada. */
@Injectable({ providedIn: 'root' })
export class UserProfileStore {
  private readonly usersApi = inject(UsersService);
  private readonly session = inject(SessionService);
  private readonly profileSig = signal<UserProfile | null>(null);

  readonly profile = this.profileSig.asReadonly();

  /** Lee perfil desde sesión (sin HTTP). */
  hydrateFromSession(): UserProfile | null {
    const profile = profileFromSession(this.session);
    if (profile) {
      this.profileSig.set(profile);
    }
    return profile;
  }

  load(username: string): UserProfile {
    const hydrated = this.hydrateFromSession();
    if (hydrated) {
      return hydrated;
    }
    const fallback = defaultUserProfile(username, this.session);
    this.profileSig.set(fallback);
    return fallback;
  }

  patchProfile(
    patch: Partial<UserProfile> & {
      theme?: ThemeScheme;
      controlAutomaticRecognition?: boolean;
    },
  ): Observable<UserProfile> {
    return this.usersApi.patchMe(profileToPatchBody(patch)).pipe(
      tap((row) => {
        if (patch.controlAutomaticRecognition !== undefined) {
          this.session.syncUserPreferenceSettings({
            controlAutomaticRecognition:
              row.controlAutomaticRecognition ?? patch.controlAutomaticRecognition,
            controlAutomaticRecognitionChangedAt:
              row.controlAutomaticRecognitionChangedAt,
          });
        }
      }),
      map((row) => mapUserMeToProfile(row)),
      tap((profile) => {
        this.session.syncUserProfile({
          name: profile.displayName,
          username: profile.username,
          email: profile.email,
          phone: profile.phone,
          jobTitle: profile.jobTitle,
          photoDataUrl: profile.photoDataUrl,
        });
        if (patch.theme) {
          this.session.updateTheme(patch.theme);
        }
        this.profileSig.set(profile);
      }),
    );
  }

  patchPassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.usersApi
      .patchPassword({ currentPassword, newPassword })
      .pipe(map(() => void 0));
  }

  clear(): void {
    this.profileSig.set(null);
  }
}
