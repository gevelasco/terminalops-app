import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type {
  StaffGrantableModuleCode,
  StaffModuleGrant,
} from '@shared/models/app-modules.models';
import type { UserRole } from '@shared/models/auth.models';
import { environment } from '../../../../environments/environment';

export interface CompanyAccount {
  id: number;
  name: string;
  tagline: string | null;
  /** Logo de la empresa (data URL o URL absoluta). */
  logoDataUrl: string | null;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  subscriptionEndsAt: string | null;
  createdAt: string | null;
  /**
   * Historial de pagos si el API lo incluye en `/account`.
   * Filas crudas; la UI las normaliza en `buildAccountBillingHistory`.
   */
  billingHistory?: Record<string, unknown>[] | null;
}

function mapCompanyLogo(row: Record<string, unknown>): string | null {
  const raw =
    row['logoDataUrl'] ??
    row['logo_data_url'] ??
    row['logoUrl'] ??
    row['logo_url'] ??
    row['companyLogoDataUrl'] ??
    row['company_logo_data_url'] ??
    row['logo'] ??
    null;
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'object') {
    const nested = raw as Record<string, unknown>;
    const nestedUrl =
      nested['url'] ?? nested['dataUrl'] ?? nested['data_url'] ?? nested['href'];
    if (nestedUrl == null) {
      return null;
    }
    const nestedValue = String(nestedUrl).trim();
    return nestedValue || null;
  }
  const value = String(raw).trim();
  return value || null;
}

function mapBillingHistory(
  row: Record<string, unknown>,
): Record<string, unknown>[] | null {
  const raw =
    row['billingHistory'] ??
    row['subscriptionPayments'] ??
    row['payments'] ??
    null;
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  return raw.filter((item) => item && typeof item === 'object') as Record<
    string,
    unknown
  >[];
}

function mapCompanyAccount(row: Record<string, unknown>): CompanyAccount {
  return {
    id: Number(row['id'] ?? 0),
    name: String(row['name'] ?? ''),
    tagline:
      row['tagline'] == null && row['tagLine'] == null
        ? null
        : String(row['tagline'] ?? row['tagLine'] ?? ''),
    logoDataUrl: mapCompanyLogo(row),
    subscriptionStatus: String(
      row['subscriptionStatus'] ?? row['subscription_status'] ?? 'active',
    ),
    subscriptionPlan:
      row['subscriptionPlan'] != null || row['subscription_plan'] != null
        ? String(row['subscriptionPlan'] ?? row['subscription_plan'])
        : null,
    subscriptionEndsAt:
      row['subscriptionEndsAt'] != null || row['subscription_ends_at'] != null
        ? String(row['subscriptionEndsAt'] ?? row['subscription_ends_at'])
        : null,
    createdAt:
      row['createdAt'] != null || row['created_at'] != null
        ? String(row['createdAt'] ?? row['created_at'])
        : null,
    billingHistory: mapBillingHistory(row),
  };
}

export interface UpdateCompanyAccountPayload {
  name?: string;
  tagline?: string;
  /** Enviar `''` para quitar el logo. */
  logoDataUrl?: string;
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
    return this.http
      .get<Record<string, unknown>>(
        `${environment.apiUrl}/companies/${companyId}/account`,
      )
      .pipe(map((row) => mapCompanyAccount(row)));
  }

  updateAccount(
    companyId: string | number,
    payload: UpdateCompanyAccountPayload,
  ): Observable<CompanyAccount> {
    return this.http
      .patch<Record<string, unknown>>(
        `${environment.apiUrl}/companies/${companyId}/account`,
        payload,
      )
      .pipe(map((row) => mapCompanyAccount(row)));
  }

  activateProPlan(
    companyId: string | number,
    invitationCode: string,
  ): Observable<CompanyAccount> {
    return this.http
      .post<Record<string, unknown>>(
        `${environment.apiUrl}/companies/${companyId}/account/activate-pro`,
        { invitationCode },
      )
      .pipe(map((row) => mapCompanyAccount(row)));
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
