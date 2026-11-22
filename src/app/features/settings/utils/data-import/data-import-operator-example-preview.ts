import {
  operatorTemplateExampleRow,
  operatorTemplateExampleRows,
} from './data-import-operator-fields.util';
import { DATA_IMPORT_SHEET_META } from './data-import-sheet-meta';

export const DATA_IMPORT_OPERATOR_EXAMPLE_COLUMNS: readonly {
  header: string;
  example: string;
}[] = DATA_IMPORT_SHEET_META.operators.columns.map((col, index) => ({
  header: col.required ? `${col.header} *` : col.header,
  example: operatorTemplateExampleRow()[index] ?? '',
}));

/** Filas de muestra en la UI (IMSS + seguro privado). */
export const DATA_IMPORT_OPERATOR_EXAMPLE_ROWS: readonly {
  label: string;
  cells: readonly string[];
}[] = [
  { label: 'IMSS (público)', cells: operatorTemplateExampleRows()[0] ?? [] },
  {
    label: 'Seguro médico privado',
    cells: operatorTemplateExampleRows()[1] ?? [],
  },
];