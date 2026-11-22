import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { clientTemplateExampleRow } from './data-import-client-fields.util';
import { operatorTemplateExampleRows } from './data-import-operator-fields.util';
import { equipmentTemplateExampleRows } from './data-import-equipment-fields.util';
import { unitTemplateExampleRows } from './data-import-unit-fields.util';
import { dataImportHeaderToFieldKey } from './data-import-header-map.util';
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

function sheetToRecords(
  sheet: XLSX.WorkSheet,
  kind: DataImportEntityKind,
): Record<string, string>[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];
  if (matrix.length < 2) {
    return [];
  }
  const headerRow = matrix[0] ?? [];
  const columnKeys: (string | null)[] = headerRow.map((h) => {
    const key = dataImportHeaderToFieldKey(kind, h);
    return key || null;
  });
  if (!columnKeys.some((k) => k != null)) {
    return [];
  }
  const out: Record<string, string>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const record: Record<string, string> = {};
    let any = false;
    for (let c = 0; c < columnKeys.length; c++) {
      const key = columnKeys[c];
      if (!key) {
        continue;
      }
      const val = cellString(row[c]);
      if (val) {
        any = true;
      }
      record[key] = val;
    }
    if (any) {
      out.push(record);
    }
  }
  return out;
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

/** Un archivo = un módulo: se lee la primera hoja con datos. */
export function parseDataImportWorkbookForKind(
  buffer: ArrayBuffer,
  kind: DataImportEntityKind,
): DataImportSheetPreview | null {
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
  const records = sheetToRecords(sheet, kind);
  const rows = prepareDataImportRows(kind, sheetName, records);
  if (rows.length === 0) {
    return null;
  }
  return { kind, sheetName, rows };
}