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
  /** Contacto comercial (cotizaciones PDF). */
  contactEmail: string | null;
  contactPhone: string | null;
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

function mapOptionalTrimmedString(
  row: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const raw = row[key];
    if (raw == null) {
      continue;
    }
    if (typeof raw === 'object') {
      continue;
    }
    const value = String(raw).trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function mapCompanyLogo(row: Record<string, unknown>): string | null {
  for (const key of [
    'logoDataUrl',
    'logo_data_url',
    'logoUrl',
    'logo_url',
    'companyLogoDataUrl',
    'company_logo_data_url',
    'logo',
  ] as const) {
    const raw = row[key];
    if (raw == null) {
      continue;
    }
    if (typeof raw === 'object') {
      const nested = mapOptionalTrimmedString(
        raw as Record<string, unknown>,
        'url',
        'dataUrl',
        'data_url',
        'href',
      );
      if (nested) {
        return nested;
      }
      continue;
    }
    const value = String(raw).trim();
    if (value) {
      return value;
    }
  }
  return null;
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
    contactEmail: mapOptionalTrimmedString(
      row,
      'contactEmail',
      'contact_email',
    ),
    contactPhone: mapOptionalTrimmedString(
      row,
      'contactPhone',
      'contact_phone',
    ),
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
  /** Enviar `''` para quitar. */
  contactEmail?: string;
  contactPhone?: string;
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

  /** Baja lógica: inactiva la cuenta y la oculta del listado (conserva historial). */
  deleteUser(
    companyId: string | number,
    userId: number,
  ): Observable<{ id: number; deleted: boolean }> {
    return this.http.delete<{ id: number; deleted: boolean }>(
      `${environment.apiUrl}/companies/${companyId}/users/${userId}`,
    );
  }
}
