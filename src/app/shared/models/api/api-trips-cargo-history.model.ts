export interface ClientCargoHistoryItem {
  description: string;
  operationType: string;
  containerType: string;
  loadType: string;
  approximateWeightTons: string;
}

export interface ClientCargoHistoryResponse {
  items: ClientCargoHistoryItem[];
}
