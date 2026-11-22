import { unitTemplateExampleRow } from './data-import-unit-fields.util';
import { DATA_IMPORT_SHEET_META } from './data-import-sheet-meta';

const UNIT_TEMPLATE_EXAMPLE_ROW = unitTemplateExampleRow();

export const DATA_IMPORT_UNIT_EXAMPLE_COLUMNS: readonly {
  header: string;
  example: string;
}[] = DATA_IMPORT_SHEET_META.units.columns.map((col, index) => ({
  header: col.required ? `${col.header} *` : col.header,
  example: UNIT_TEMPLATE_EXAMPLE_ROW[index] ?? '',
}));