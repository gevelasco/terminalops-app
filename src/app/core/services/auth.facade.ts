import { Injectable, inject } from '@angular/core';
import { SessionStore } from './session.store';

/** Credenciales demo (solo entorno local / MVP). No usar en producción. */
const DEMO_USER = 'gvelasco';
/** Variantes: `med` (letra e) y `m3d` (dígito 3), confusión frecuente al escribir. */
const DEMO_PASSWORDS: readonly string[] = ['@ndr0med@', '@ndr0m3d@'];

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
  }
}
