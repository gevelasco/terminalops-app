export type DestinationRateEstimatedTimeUnit = 'hours' | 'days';

export interface DestinationRate {
  id: string;
  companyId: string;
  originOperationalCenterId: string;
  originOperationalCenterName?: string;
  originOperationalCenterCode?: string;
  originPostalCode: string;
  originCityMunicipality: string;
  originLocality: string;
  originLatitude?: number;
  originLongitude?: number;
  postalCode: string;
  cityMunicipality: string;
  locality: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  routeDistanceKm?: number;
  operationalDistanceKm?: number;
  isRoundTrip: boolean;
  distanceCalculatedAt?: string;
  /** Referencia UX — no operativo; no alimenta trips. */
  estimatedArrivalTimeValue?: number;
  estimatedReturnTimeValue?: number;
  estimatedTimeUnit?: DestinationRateEstimatedTimeUnit;
  maneuverCount?: number;
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
  originOperationalCenterId: string;
  postalCode: string;
  cityMunicipality: string;
  locality: string;
  prices: DestinationRatePriceInput[];
  routeDistanceKm?: number;
  isRoundTrip?: boolean;
  destinationLatitude?: number;
  destinationLongitude?: number;
  active?: boolean;
  estimatedArrivalTimeValue?: number | null;
  estimatedReturnTimeValue?: number | null;
  estimatedTimeUnit?: DestinationRateEstimatedTimeUnit | null;
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
