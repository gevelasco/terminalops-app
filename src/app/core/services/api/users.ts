import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { ThemeScheme } from '@shared/models/auth.models';
import { environment } from '../../../../environments/environment';

export type UserMeResponse = {
  id: number;
  username: string;
  displayName: string;
  email: string;
  phone: string;
  jobTitle: string;
  photoDataUrl: string;
  theme: ThemeScheme;
  role: string;
  memberSince: string;
  department: string;
  workLocation: string;
  employeeId: string;
};

export type UpdateUserProfileRequest = {
  displayName?: string;
  username?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  photoDataUrl?: string;
  theme?: ThemeScheme;
};

export type UpdateUserPasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  getMe(): Observable<UserMeResponse> {
    return this.http.get<UserMeResponse>(`${environment.apiUrl}/users/me`);
  }

  patchMe(body: UpdateUserProfileRequest): Observable<UserMeResponse> {
    return this.http.patch<UserMeResponse>(`${environment.apiUrl}/users/me`, body);
  }

  patchPassword(body: UpdateUserPasswordRequest): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(
      `${environment.apiUrl}/users/me/password`,
      body,
    );
  }
}
