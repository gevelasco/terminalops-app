export interface OperationConfiguration {
  id: string;
  companyId: string;
  code: string;
  name: string;
  maxEquipmentCount: number;
  version: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateOperationConfigurationPayload {
  name: string;
  code?: string;
  maxEquipmentCount?: number;
  active?: boolean;
}

export type UpdateOperationConfigurationPayload =
  Partial<CreateOperationConfigurationPayload>;
