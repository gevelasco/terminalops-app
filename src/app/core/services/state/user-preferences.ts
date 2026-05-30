import { computed, inject, Injectable } from '@angular/core';
import {
  defaultUserPreferences,
  type UserPreferences,
} from '@core/models/user-preferences.models';
import { SessionService } from '@core/services/state/session';

export function formatPreferenceChangedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d);
}

/** Etiqueta de toggles operativos: «29 de mayo de 2026 a las 9:43 a.m.» */
export function formatOperationalSettingChangedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  const date = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(d);
  const time = new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
  return `${date} a las ${time}`;
}

/** Preferencias de empresa en sesión (configuración operativa compartida). */
@Injectable({ providedIn: 'root' })
export class UserPreferencesStore {
  private readonly session = inject(SessionService);

  readonly preferences = computed((): UserPreferences => ({
    operationalAnalysisEnabled: this.session.operationalAnalysisEnabled(),
    operationalAnalysisChangedAt:
      this.session.operationalAnalysisChangedAt() ??
      defaultUserPreferences().operationalAnalysisChangedAt,
  }));

  readonly operationalAnalysisEnabled = computed(
    () => this.session.operationalAnalysisEnabled(),
  );

  ensureLoaded(): void {
    /* La configuración operativa vive en la sesión / API de empresa. */
  }

  load(_username: string): UserPreferences {
    return this.preferences();
  }

  clear(): void {
    /* Sin estado local; la sesión se limpia en logout. */
  }
}
