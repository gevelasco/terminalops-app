import { Injectable, signal } from '@angular/core';

/**
 * Signal-based session stub. OWASP: never persist passwords or long-lived secrets
 * in localStorage/sessionStorage without encryption and threat modeling; prefer
 * httpOnly cookies for refresh/access tokens where applicable.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly accessToken = signal<string | null>(null);

  readonly token = this.accessToken.asReadonly();

  setAccessToken(token: string | null): void {
    this.accessToken.set(token);
  }
}
