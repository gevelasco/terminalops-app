export interface ClientCargoHistoryItem {
  description: string;
  operationType: string;
  containerType: string;
  cargoCategory: string;
  loadType: string;
  approximateWeightTons: string;
}

export interface ClientCargoHistoryResponse {
  items: ClientCargoHistoryItem[];
}
