export interface OperationalCenter {
  id: string;
  companyId: string;
  name: string;
  code: string;
  postalCode?: string;
  cityMunicipality?: string;
  locality?: string;
  settlementConsId?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}
