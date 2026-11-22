export type DataImportEntityKind =
  | 'clients'
  | 'operators'
  | 'units'
  | 'equipment';

/** Orden de importación (dependencias ligeras; sin enganche unidad–equipo). */
export const DATA_IMPORT_KIND_ORDER: readonly DataImportEntityKind[] = [
  'clients',
  'operators',
  'units',
  'equipment',
] as const;

export type DataImportRowStatus = 'ready' | 'error' | 'imported' | 'failed' | 'skipped';

export interface DataImportParsedRow {
  kind: DataImportEntityKind;
  sheetName: string;
  rowNumber: number;
  status: DataImportRowStatus;
  summary: string;
  errors: string[];
  warnings: string[];
}

export interface DataImportSheetPreview {
  kind: DataImportEntityKind;
  sheetName: string;
  rows: DataImportPreparedRow[];
}

export interface DataImportPreparedRow extends DataImportParsedRow {
  payload: unknown;
}

export interface DataImportRunResult {
  created: Record<DataImportEntityKind, number>;
  failed: Record<DataImportEntityKind, number>;
  messages: string[];
}