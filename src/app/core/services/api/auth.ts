import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  SignUpRequest,
} from '@shared/models/auth.models';
import { SessionService } from '../state/session';
import { UserProfileStore } from '../state/user-profile';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly profiles = inject(UserProfileStore);
  private readonly httpPlain = new HttpClient(inject(HttpBackend));

  private refreshInFlight$?: Observable<void>;

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, {
      email: credentials.email,
      password: credentials.password,
    });
  }

  signUp(payload: SignUpRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/sign-up`, payload);
  }

  refreshAccessToken(): Observable<void> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }
    const refreshToken = this.session.refreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }
    const body: RefreshTokenRequest = { refreshToken };
    this.refreshInFlight$ = this.httpPlain
      .post<RefreshTokenResponse>(`${environment.apiUrl}/auth/refresh`, body)
      .pipe(
        tap((response) => {
          this.session.updateTokens(
            response.access_token,
            response.refresh_token,
            response.user,
          );
          this.profiles.hydrateFromSession();
        }),
        map(() => void 0),
        shareReplay({ bufferSize: 1, refCount: true }),
        finalize(() => {
          this.refreshInFlight$ = undefined;
        }),
      );
    return this.refreshInFlight$;
  }
}
