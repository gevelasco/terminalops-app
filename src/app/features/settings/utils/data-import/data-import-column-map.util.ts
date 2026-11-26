import type { DataImportEntityKind } from './data-import.types';
import {
  dataImportHeaderToFieldKey,
  normalizeDataImportHeaderCell,
} from './data-import-header-map.util';
import { DATA_IMPORT_SHEET_META } from './data-import-sheet-meta';

/** Valor especial: la columna Excel no se importa. */
export const DATA_IMPORT_IGNORE_FIELD = 'ignore';

export type DataImportColumnMapping = Record<string, string>;

export type DataImportExcelColumn = {
  /** Clave estable (encabezado, único si hay duplicados). */
  header: string;
  /** Encabezado original de la hoja. */
  rawHeader: string;
  index: number;
  suggestedField: string;
  samples: string[];
};

export type DataImportFieldOption = {
  id: string;
  label: string;
  required?: boolean;
};

export type DataImportWorkbookDraft = {
  kind: DataImportEntityKind;
  sheetName: string;
  columns: DataImportExcelColumn[];
  /** Filas de datos alineadas a `columns` (mismo índice). */
  dataRows: string[][];
  estimatedRows: number;
  suggestedMapping: DataImportColumnMapping;
  availableFields: DataImportFieldOption[];
};

export function dataImportAvailableFields(
  kind: DataImportEntityKind,
): DataImportFieldOption[] {
  const fields: DataImportFieldOption[] = DATA_IMPORT_SHEET_META[kind].columns.map(
    (col) => ({
      id: col.key,
      label: col.required ? `${col.header} *` : col.header,
      required: Boolean(col.required),
    }),
  );
  fields.push({
    id: DATA_IMPORT_IGNORE_FIELD,
    label: 'Ignorar columna',
  });
  return fields;
}

/** Solo claves conocidas del catálogo TerminalOps (no el norm crudo). */
export function dataImportHeaderToKnownFieldKey(
  kind: DataImportEntityKind,
  headerCell: unknown,
): string | null {
  const key = dataImportHeaderToFieldKey(kind, headerCell);
  if (!key) {
    return null;
  }
  const known = DATA_IMPORT_SHEET_META[kind].columns.some((c) => c.key === key);
  return known ? key : null;
}

/**
 * Auto-mapeo 1:1 por palabras clave / alias.
 * Cada campo TerminalOps solo se asigna a una columna Excel.
 */
export function buildSuggestedDataImportMapping(
  kind: DataImportEntityKind,
  columns: readonly Pick<DataImportExcelColumn, 'header' | 'rawHeader'>[],
): DataImportColumnMapping {
  const meta = DATA_IMPORT_SHEET_META[kind];
  const fieldOrder = [
    ...meta.columns.filter((c) => c.required).map((c) => c.key),
    ...meta.columns.filter((c) => !c.required).map((c) => c.key),
  ];
  const out: DataImportColumnMapping = {};
  const used = new Set<string>();

  const scored = columns.map((col) => {
    const fromRaw = dataImportHeaderToKnownFieldKey(kind, col.rawHeader);
    const fromUnique = dataImportHeaderToKnownFieldKey(kind, col.header);
    const field = fromRaw ?? fromUnique;
    const priority = field ? fieldOrder.indexOf(field) : 9999;
    return { header: col.header, field, priority: priority < 0 ? 9999 : priority };
  });

  scored.sort((a, b) => a.priority - b.priority || a.header.localeCompare(b.header, 'es'));

  for (const row of scored) {
    if (!row.field || used.has(row.field)) {
      continue;
    }
    out[row.header] = row.field;
    used.add(row.field);
  }

  return out;
}

export function dataImportMissingRequiredFields(
  kind: DataImportEntityKind,
  mapping: DataImportColumnMapping,
): string[] {
  const assigned = new Set(
    Object.values(mapping).filter(
      (id) => id && id !== DATA_IMPORT_IGNORE_FIELD,
    ),
  );
  return DATA_IMPORT_SHEET_META[kind].columns
    .filter((col) => col.required && !assigned.has(col.key))
    .map((col) => col.key);
}

export function dataImportFieldLabel(
  kind: DataImportEntityKind,
  fieldId: string | null | undefined,
): string {
  if (!fieldId) {
    return 'Sin asignar';
  }
  if (fieldId === DATA_IMPORT_IGNORE_FIELD) {
    return 'Ignorar columna';
  }
  const col = DATA_IMPORT_SHEET_META[kind].columns.find((c) => c.key === fieldId);
  return col?.header ?? fieldId;
}

/**
 * Aplica el mapeo columna→campo a las filas crudas.
 * Si dos columnas apuntan al mismo campo, gana la primera no vacía.
 */
export function applyDataImportColumnMapping(
  draft: DataImportWorkbookDraft,
  mapping: DataImportColumnMapping,
): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  for (const cells of draft.dataRows) {
    const record: Record<string, string> = {};
    let any = false;
    for (let i = 0; i < draft.columns.length; i++) {
      const col = draft.columns[i]!;
      const fieldId = (mapping[col.header] ?? '').trim();
      if (!fieldId || fieldId === DATA_IMPORT_IGNORE_FIELD) {
        continue;
      }
      const val = (cells[i] ?? '').trim();
      if (val) {
        any = true;
      }
      const prev = record[fieldId];
      if (prev == null || prev === '') {
        record[fieldId] = val;
      }
    }
    if (any) {
      out.push(record);
    }
  }
  return out;
}

/** Encabezados únicos para usar como clave de mapeo. */
export function uniqueDataImportHeaders(rawHeaders: unknown[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((raw) => {
    const base = String(raw ?? '').trim() || '(sin título)';
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

export function isLikelyInstructionOrEmptyHeader(header: unknown): boolean {
  const norm = normalizeDataImportHeaderCell(header);
  return !norm || /instruccion/.test(norm);
}
