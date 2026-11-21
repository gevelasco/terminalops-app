export interface DestinationRateRouteWaypoint {
  label: string;
  lat: number;
  lon: number;
  searchLabel?: string;
}

/** Caseta en ruta persistida en la tarifa (misma forma que consulta INEGI al editar). */
export interface DestinationRateRouteTollPlaza {
  order: number;
  plazaKey: string;
  plazaKeySource?: 'inegi' | 'fallback';
  inegiPoint?: string;
  name: string;
  costMxn: number | null;
}

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
  /** Referencia UX — horas de manejo (ida / retorno); no operativo directo. */
  estimatedArrivalTimeValue?: number;
  estimatedReturnTimeValue?: number;
  maneuverCount?: number;
  /** Claves INEGI de casetas que no se cruzan (por libre). */
  excludedTollPlazaKeys?: string[];
  /** Puntos intermedios de ruta personalizada, en orden de recorrido. */
  routeWaypoints?: DestinationRateRouteWaypoint[];
  /** Casetas en ruta para esta tarifa (fuente única al visualizar / mapa). */
  routeTollPlazas?: DestinationRateRouteTollPlaza[];
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
  axleCount?: number;
  perDiemAmount: number;
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
  axleCount?: number;
  perDiemAmount: number;
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
  notes?: string;
  excludedTollPlazaKeys?: string[];
  routeWaypoints?: DestinationRateRouteWaypoint[];
  routeTollPlazas?: DestinationRateRouteTollPlaza[];
}

export type UpdateDestinationRatePayload = Partial<CreateDestinationRatePayload>;

export interface DestinationRatePriceDraft {
  rowKey: string;
  operationConfigurationId: string;
  operationConfigurationName: string;
  clientCharge: string;
  operatorPaymentEstimate: string;
  estimatedTollAmount: string;
  axleCount: string;
  perDiemAmount: string;
  notes: string;
}
