import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  StaffGrantableModuleCode,
  StaffModuleGrant,
} from '@shared/models/app-modules.models';
import type { UserRole } from '@shared/models/auth.models';
import { environment } from '../../../../environments/environment';

export interface CompanyAccount {
  id: number;
  name: string;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  subscriptionEndsAt: string | null;
}

export interface CompanyUserRow {
  id: number;
  username: string;
  displayName: string;
  email: string;
  phone: string;
  jobTitle: string;
  photoDataUrl?: string;
  department: string;
  workLocation: string;
  role: UserRole;
  status: 'active' | 'disabled' | 'pending';
  moduleCodes: StaffGrantableModuleCode[];
  moduleGrants?: StaffModuleGrant[];
  allowedModules: string[];
  memberSince?: string;
  employeeId: string;
}

export interface CreateCompanyUserPayload {
  username: string;
  password: string;
  displayName?: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  photoDataUrl?: string;
  role: 'admin' | 'staff';
  moduleCodes?: StaffGrantableModuleCode[];
  moduleGrants?: StaffModuleGrant[];
}

export interface UpdateCompanyUserPayload {
  displayName?: string;
  username?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  photoDataUrl?: string;
  newPassword?: string;
  role?: 'admin' | 'staff';
  status?: 'active' | 'disabled';
  moduleCodes?: StaffGrantableModuleCode[];
  moduleGrants?: StaffModuleGrant[];
}

@Injectable({ providedIn: 'root' })
export class CompanyUsersApiService {
  private readonly http = inject(HttpClient);

  getAccount(companyId: string | number): Observable<CompanyAccount> {
    return this.http.get<CompanyAccount>(
      `${environment.apiUrl}/companies/${companyId}/account`,
    );
  }

  listUsers(companyId: string | number): Observable<CompanyUserRow[]> {
    return this.http.get<CompanyUserRow[]>(
      `${environment.apiUrl}/companies/${companyId}/users`,
    );
  }

  createUser(
    companyId: string | number,
    payload: CreateCompanyUserPayload,
  ): Observable<CompanyUserRow> {
    return this.http.post<CompanyUserRow>(
      `${environment.apiUrl}/companies/${companyId}/users`,
      payload,
    );
  }

  updateUser(
    companyId: string | number,
    userId: number,
    payload: UpdateCompanyUserPayload,
  ): Observable<CompanyUserRow> {
    return this.http.patch<CompanyUserRow>(
      `${environment.apiUrl}/companies/${companyId}/users/${userId}`,
      payload,
    );
  }
}
