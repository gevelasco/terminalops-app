import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

const LS_KEY = 'terminalops.session';

export interface TerminalOpsSessionV1 {
  v: 1;
  username: string;
  /** Día local `YYYY-MM-DD` en que la sesión es válida; al cambiar de día calendario, expira. */
  dayKey: string;
}

export function localCalendarDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Sesión demo en `localStorage` (sin contraseña). Expira al terminar el día calendario local.
 * En producción sustituir por cookies httpOnly / tokens con backend.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly accessToken = signal<string | null>(null);
  private readonly usernameSig = signal<string | null>(null);

  readonly token = this.accessToken.asReadonly();
  readonly username = this.usernameSig.asReadonly();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.restoreFromLocalStorage();
    }
  }

  /** Relee `localStorage` y aplica caducidad por día (útil en guard y tras medianoche). */
  syncSessionWithStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.restoreFromLocalStorage();
  }

  private restoreFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) {
        this.accessToken.set(null);
        this.usernameSig.set(null);
        return;
      }
      const p = JSON.parse(raw) as Partial<TerminalOpsSessionV1>;
      if (
        p?.v !== 1 ||
        typeof p.username !== 'string' ||
        typeof p.dayKey !== 'string'
      ) {
        localStorage.removeItem(LS_KEY);
        this.accessToken.set(null);
        this.usernameSig.set(null);
        return;
      }
      if (p.dayKey !== localCalendarDayKey()) {
        localStorage.removeItem(LS_KEY);
        this.accessToken.set(null);
        this.usernameSig.set(null);
        return;
      }
      this.accessToken.set('local');
      this.usernameSig.set(p.username);
    } catch {
      localStorage.removeItem(LS_KEY);
      this.accessToken.set(null);
      this.usernameSig.set(null);
    }
  }

  setLocalSession(username: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.accessToken.set('local');
      this.usernameSig.set(username);
      return;
    }
    const dayKey = localCalendarDayKey();
    const body: TerminalOpsSessionV1 = { v: 1, username, dayKey };
    localStorage.setItem(LS_KEY, JSON.stringify(body));
    this.accessToken.set('local');
    this.usernameSig.set(username);
  }

  clearSession(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(LS_KEY);
    }
    this.accessToken.set(null);
    this.usernameSig.set(null);
  }
}
