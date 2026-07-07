export type FleetDetailDrawerTab = 'ficha' | 'mant' | 'cob';

export type FleetPersistOptions = {
  onSuccess?: () => void;
  /** Usa la respuesta del PATCH y evita GET de lista (p. ej. confirmar pago de póliza). */
  skipListRefresh?: boolean;
  /** Evita overview + listados de flota; el drawer ya tiene el recurso actualizado. */
  skipFleetRefresh?: boolean;
};

export type FleetDetailDrawerStatusBanner = {
  label: string;
  sub?: string;
  mod: string;
};
