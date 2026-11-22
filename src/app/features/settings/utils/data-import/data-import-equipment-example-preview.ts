import { equipmentTemplateExampleRow } from './data-import-equipment-fields.util';
import { DATA_IMPORT_SHEET_META } from './data-import-sheet-meta';

const EQUIPMENT_TEMPLATE_EXAMPLE_ROW = equipmentTemplateExampleRow();

export const DATA_IMPORT_EQUIPMENT_EXAMPLE_COLUMNS: readonly {
  header: string;
  example: string;
}[] = DATA_IMPORT_SHEET_META.equipment.columns.map((col, index) => ({
  header: col.required ? `${col.header} *` : col.header,
  example: EQUIPMENT_TEMPLATE_EXAMPLE_ROW[index] ?? '',
}));