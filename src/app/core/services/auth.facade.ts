import { Injectable, inject } from '@angular/core';
import { UserProfileStore } from './user-profile.store';
import { SessionStore } from './session.store';

/** Credenciales demo (solo entorno local / MVP). No usar en producción. */
const DEMO_USER = 'gvelasco';
const DEMO_PASSWORDS: readonly string[] = ['Admin123'];

/** Quita espacios raros y unifica @ (p. ej. teclado / Unicode). */
function normalizeCredential(raw: string): string {
  return raw
    .trim()
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/\uFF20/g, '@');
}

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly session = inject(SessionStore);
  private readonly profiles = inject(UserProfileStore);

  /**
   * Valida usuario y contraseña; si coinciden, persiste sesión del día en `localStorage`.
   * @returns `true` si el acceso fue correcto.
   */
  login(username: string, password: string): boolean {
    const u = normalizeCredential(username).toLowerCase();
    const p = normalizeCredential(password);
    if (u === DEMO_USER && DEMO_PASSWORDS.includes(p)) {
      this.session.setLocalSession(DEMO_USER);
      return true;
    }
    return false;
  }

  logout(): void {
    this.session.clearSession();
    this.profiles.clear();
  }
}
