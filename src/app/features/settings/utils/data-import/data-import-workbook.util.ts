import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { clientTemplateExampleRow } from './data-import-client-fields.util';
import { operatorTemplateExampleRows } from './data-import-operator-fields.util';
import { equipmentTemplateExampleRows } from './data-import-equipment-fields.util';
import { unitTemplateExampleRows } from './data-import-unit-fields.util';
import {
  applyDataImportColumnMapping,
  buildSuggestedDataImportMapping,
  dataImportAvailableFields,
  dataImportHeaderToKnownFieldKey,
  uniqueDataImportHeaders,
  type DataImportColumnMapping,
  type DataImportExcelColumn,
  type DataImportWorkbookDraft,
} from './data-import-column-map.util';
import { DATA_IMPORT_SHEET_META } from './data-import-sheet-meta';
import type { DataImportEntityKind } from './data-import.types';
import { prepareDataImportRows } from './data-import-prepare-rows.util';
import type { DataImportSheetPreview } from './data-import.types';

function cellString(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).trim();
}

function buildSingleKindWorkbook(kind: DataImportEntityKind): XLSX.WorkBook {
  const meta = DATA_IMPORT_SHEET_META[kind];
  const header = meta.columns.map((c) => (c.required ? `${c.header}*` : c.header));
  const rows: string[][] = [header];
  if (kind === 'clients') {
    rows.push(clientTemplateExampleRow());
  } else if (kind === 'operators') {
    rows.push(...operatorTemplateExampleRows());
  } else if (kind === 'units') {
    rows.push(...unitTemplateExampleRows());
  } else if (kind === 'equipment') {
    rows.push(...equipmentTemplateExampleRows());
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, meta.sheetTitle);
  return wb;
}

const TEMPLATE_FILE: Record<DataImportEntityKind, string> = {
  clients: 'terminalops_clientes.xlsx',
  operators: 'terminalops_operadores.xlsx',
  units: 'terminalops_unidades.xlsx',
  equipment: 'terminalops_equipos.xlsx',
};

/**
 * `file-saver` fuerza descarga real en Safari/macOS (`data:attachment/file`),
 * evitando que Numbers abra el blob y guarde como `.numbers`.
 */
export function downloadDataImportTemplateForKind(kind: DataImportEntityKind): void {
  const wb = buildSingleKindWorkbook(kind);
  const fileName = TEMPLATE_FILE[kind];
  const written = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const bytes = written instanceof Uint8Array ? written : new Uint8Array(written as ArrayBuffer);
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  saveAs(blob, fileName);
}

function sheetMatrix(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];
}

function isBlankRow(cells: string[]): boolean {
  return cells.every((c) => !c.trim());
}

/**
 * Lee el Excel sin aplicar aún el mapeo a filas listas para API.
 * Expone columnas + muestras + sugerencias para el UI de vínculo.
 */
export function parseDataImportWorkbookDraft(
  buffer: ArrayBuffer,
  kind: DataImportEntityKind,
): DataImportWorkbookDraft | null {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => !/instrucciones/i.test(n)) ?? wb.SheetNames[0];
  if (!sheetName) {
    return null;
  }
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    return null;
  }
  const matrix = sheetMatrix(sheet);
  if (matrix.length < 2) {
    return null;
  }
  const headerRow = matrix[0] ?? [];
  if (!headerRow.some((h) => String(h ?? '').trim())) {
    return null;
  }

  const uniqueHeaders = uniqueDataImportHeaders(headerRow);
  const colCount = uniqueHeaders.length;
  const dataRows: string[][] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const cells: string[] = [];
    for (let c = 0; c < colCount; c++) {
      cells.push(cellString(row[c]));
    }
    if (!isBlankRow(cells)) {
      dataRows.push(cells);
    }
  }
  if (dataRows.length === 0) {
    return null;
  }

  const columns: DataImportExcelColumn[] = uniqueHeaders.map((header, index) => {
    const rawHeader = String(headerRow[index] ?? '').trim() || header;
    const samples: string[] = [];
    for (const row of dataRows) {
      const val = (row[index] ?? '').trim();
      if (!val) {
        continue;
      }
      if (samples.includes(val)) {
        continue;
      }
      samples.push(val);
      if (samples.length >= 3) {
        break;
      }
    }
    return {
      header,
      rawHeader,
      index,
      suggestedField: dataImportHeaderToKnownFieldKey(kind, rawHeader) ?? '',
      samples,
    };
  });

  const suggestedMapping = buildSuggestedDataImportMapping(kind, columns);

  return {
    kind,
    sheetName,
    columns,
    dataRows,
    estimatedRows: dataRows.length,
    suggestedMapping,
    availableFields: dataImportAvailableFields(kind),
  };
}

/** Aplica el mapeo del usuario y prepara filas (validación de campos, no unicidad DB). */
export function buildDataImportPreviewFromDraft(
  draft: DataImportWorkbookDraft,
  mapping: DataImportColumnMapping,
): DataImportSheetPreview | null {
  const records = applyDataImportColumnMapping(draft, mapping);
  if (records.length === 0) {
    return null;
  }
  const rows = prepareDataImportRows(draft.kind, draft.sheetName, records);
  if (rows.length === 0) {
    return null;
  }
  return { kind: draft.kind, sheetName: draft.sheetName, rows };
}

/**
 * @deprecated Preferir `parseDataImportWorkbookDraft` + mapeo + `buildDataImportPreviewFromDraft`.
 * Conservado para compatibilidad: auto-mapea y prepara en un solo paso.
 */
export function parseDataImportWorkbookForKind(
  buffer: ArrayBuffer,
  kind: DataImportEntityKind,
): DataImportSheetPreview | null {
  const draft = parseDataImportWorkbookDraft(buffer, kind);
  if (!draft) {
    return null;
  }
  return buildDataImportPreviewFromDraft(draft, draft.suggestedMapping);
}
