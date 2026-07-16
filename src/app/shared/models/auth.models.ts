export type UserRole = 'superadmin' | 'admin' | 'staff';

export type ThemeScheme = 'light' | 'dark';

export interface AuthUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  username: string;
  phone?: string;
  jobTitle?: string;
  photoDataUrl?: string;
  role: UserRole;
  allowedModules?: string[];
  moduleGrants?: import('@shared/models/app-modules.models').StaffModuleGrant[];
  companyId: string;
  companyName?: string;
  theme: ThemeScheme;
  memberSince?: string;
  department?: string;
  workLocation?: string;
  employeeId?: string;
  operationalAnalysisEnabled?: boolean;
  operationalAnalysisChangedAt?: string;
  tripAssistPrefillEnabled?: boolean;
  tripAssistPrefillChangedAt?: string;
  tripAutoMaintenanceProvisionPercent?: number;
  tripAutoFuelPaymentMethod?: string;
  tripAutoTollsPaymentMethod?: string;
  tripAutoPerDiemPaymentMethod?: string;
  tripAutoControlPaymentMethod?: string;
  dieselControlEnabled?: boolean;
  dieselControlChangedAt?: string;
  controlAutomaticRecognition?: boolean;
  controlAutomaticRecognitionChangedAt?: string;
  maintenanceKmControlEnabled?: boolean;
  maintenanceKmIntervalDefault?: number;
  maintenanceDateControlEnabled?: boolean;
  maintenanceDatePeriodDefault?: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  maintenanceKmControlChangedAt?: string;
  maintenanceDateControlChangedAt?: string;
  operationalCenterName?: string;
  operationalCenterPostalCode?: string;
  operationalCenterCityMunicipality?: string;
  operationalCenterLocality?: string;
  operationalCenterSettlementConsId?: string;
  operationalCenterLatitude?: number;
  operationalCenterLongitude?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  companyName: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  invitationCode: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

export interface SessionData {
  token: string;
  refreshToken: string;
  role: string;
  allowedModules: string[];
  moduleGrants: import('@shared/models/app-modules.models').StaffModuleGrant[];
  companyId: string;
  companyName?: string;
  companyTagline?: string;
  theme: ThemeScheme;
  id: string;
  username: string;
  name?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  photoDataUrl?: string;
  memberSince?: string;
  department?: string;
  workLocation?: string;
  employeeId?: string;
  operationalAnalysisEnabled: boolean;
  operationalAnalysisChangedAt?: string;
  tripAssistPrefillEnabled: boolean;
  tripAssistPrefillChangedAt?: string;
  tripAutoMaintenanceProvisionPercent: number;
  tripAutoFuelPaymentMethod: string;
  tripAutoTollsPaymentMethod: string;
  tripAutoPerDiemPaymentMethod: string;
  tripAutoControlPaymentMethod: string;
  dieselControlEnabled: boolean;
  dieselControlChangedAt?: string;
  controlAutomaticRecognition: boolean;
  controlAutomaticRecognitionChangedAt?: string;
  maintenanceKmControlEnabled: boolean;
  maintenanceKmIntervalDefault?: number;
  maintenanceDateControlEnabled: boolean;
  maintenanceDatePeriodDefault?: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  maintenanceKmControlChangedAt?: string;
  maintenanceDateControlChangedAt?: string;
  operationalCenterName?: string;
  operationalCenterPostalCode?: string;
  operationalCenterCityMunicipality?: string;
  operationalCenterLocality?: string;
  operationalCenterSettlementConsId?: string;
  operationalCenterLatitude?: number;
  operationalCenterLongitude?: number;
}
