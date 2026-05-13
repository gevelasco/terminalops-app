import { Injectable, inject } from '@angular/core';
import { SessionStore } from './session.store';

/**
 * Placeholder auth API. TODO: integrate OIDC/password flow with secure token storage.
 * Do not log credentials; avoid storing raw tokens in localStorage (XSS surface).
 */
@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly session = inject(SessionStore);

  /** Stub login — replace with real credentials exchange */
  loginStub(): void {
    this.session.setAccessToken('dev-mock-token');
  }

  logout(): void {
    this.session.setAccessToken(null);
  }
}
