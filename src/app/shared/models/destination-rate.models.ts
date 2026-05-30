export interface DestinationRate {
  id: string;
  companyId: string;
  postalCode: string;
  cityMunicipality: string;
  locality: string;
  prices: readonly DestinationRatePrice[];
  active: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DestinationRatePrice {
  id: string;
  operationConfigurationId: string;
  operationConfigurationCode?: string;
  operationConfigurationName?: string;
  clientCharge: number;
  operatorPaymentEstimate: number;
  estimatedTollAmount: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DestinationRatePriceInput {
  operationConfigurationId?: string;
  operationConfigurationName?: string;
  clientCharge: number;
  operatorPaymentEstimate: number;
  estimatedTollAmount: number;
  notes?: string;
}

export interface CreateDestinationRatePayload {
  postalCode: string;
  cityMunicipality: string;
  locality: string;
  prices: DestinationRatePriceInput[];
  active?: boolean;
  notes?: string;
}

export type UpdateDestinationRatePayload = Partial<CreateDestinationRatePayload>;

export interface DestinationRatePriceDraft {
  rowKey: string;
  operationConfigurationId: string;
  operationConfigurationName: string;
  clientCharge: string;
  operatorPaymentEstimate: string;
  estimatedTollAmount: string;
  notes: string;
}
