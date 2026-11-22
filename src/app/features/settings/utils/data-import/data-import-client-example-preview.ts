import { clientTemplateExampleRow } from './data-import-client-fields.util';
import { DATA_IMPORT_SHEET_META } from './data-import-sheet-meta';

const CLIENT_TEMPLATE_EXAMPLE_ROW = clientTemplateExampleRow();

/** Vista de ejemplo en UI: todas las columnas de la plantilla de clientes. */
export const DATA_IMPORT_CLIENT_EXAMPLE_COLUMNS: readonly {
  header: string;
  example: string;
}[] = DATA_IMPORT_SHEET_META.clients.columns.map((col, index) => ({
  header: col.required ? `${col.header} *` : col.header,
  example: CLIENT_TEMPLATE_EXAMPLE_ROW[index] ?? '',
}));