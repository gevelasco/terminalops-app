import type {
  FleetDocumentKind,
  FleetStoredDocument,
} from '@shared/models/logistics.models';

export type FleetDetailDrawerTab = 'ficha' | 'mant' | 'cob';

export type FleetPersistOptions = {
  onSuccess?: () => void;
  /** Usa la respuesta del PATCH y evita GET de lista (p. ej. confirmar pago de póliza). */
  skipListRefresh?: boolean;
  /** Evita overview + listados de flota; el drawer ya tiene el recurso actualizado. */
  skipFleetRefresh?: boolean;
  /**
   * Documentos del multipart de esta sección. Se mezclan en el estado local junto
   * con la respuesta del PATCH (no hace falta GET by id: el PATCH ya devuelve detalle).
   */
  syncedDocuments?: {
    kind: FleetDocumentKind;
    kept: readonly FleetStoredDocument[];
    uploaded: readonly FleetStoredDocument[];
  };
};

export type FleetDetailDrawerStatusBanner = {
  label: string;
  sub?: string;
  mod: string;
};
