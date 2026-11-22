import { DATA_IMPORT_SHEET_META } from './data-import-sheet-meta';
import { resolveUnitModelYear, resolveTrailerTenureMode, parseImportAmountLoose } from './data-import-unit-fields.util';
import { parseImportYesNo, parseOptionalImportDate } from './data-import-operator-fields.util';

export function isEquipmentTemplateExampleRow(plate: string): boolean {
  return /^\(ejemplo\)/i.test(plate.trim());
}

function equipmentExampleCells(record: Record<string, string>): string[] {
  return DATA_IMPORT_SHEET_META.equipment.columns.map((col) => record[col.key] ?? '');
}

const EQUIPMENT_TEMPLATE_EXAMPLE: Record<string, string> = {
  placa: '(ejemplo) 98-XY-1',
  marca: 'Great Dane',
  tipo_equipo: 'Caja seca',
  modelo_ano: '2021',
  version: 'Champion SE',
  numero_serie: 'CHS-882-A',
  nombre_alias: 'Chasis principal',
  color: 'Blanco',
  situacion_activo: 'Propio',
  valor_comercial: '420000',
  beneficiario_tenencia: '',
  monto_cuota_renta: '',
  fecha_primer_pago: '',
  plazo_cuotas: '',
  periodicidad_tenencia: '',
  pago_administracion: '',
  configuracion_contenedor: '',
  capacidad_ton: '32.5',
  numero_ejes: '3',
  ultimo_mantenimiento_fecha: '10/01/2025',
  ultimo_mantenimiento_costo: '2800',
  tipo_ultimo_mantenimiento: 'mantenimiento_general',
  estado_llantas: 'Buen estado',
  notas_mantenimiento: '',
  aplica_verificacion_fisico_mecanica: 'Sí',
  fecha_verificacion_fisico_mecanica: '01/03/2025',
  costo_verificacion_fisico_mecanica: '750',
  aplica_doble_articulado: 'No',
  fecha_verificacion_doble_articulado: '',
  costo_verificacion_doble_articulado: '',
  aseguradora: 'GNP',
  numero_poliza: 'POL-EQ-442',
  periodicidad_pago_seguro: 'Anual',
  metodo_pago_seguro: 'Transferencia',
  fecha_contrato_seguro: '01/01/2025',
  costo_seguro: '12500',
};

export function equipmentTemplateExampleRow(): string[] {
  return equipmentExampleCells(EQUIPMENT_TEMPLATE_EXAMPLE);
}

export function equipmentTemplateExampleRows(): string[][] {
  return [equipmentTemplateExampleRow()];
}

export function parseEquipmentAxleCountLoose(raw: string): number | undefined {
  const n = parseImportAmountLoose(raw);
  if (n == null || n < 1) {
    return undefined;
  }
  return Math.floor(n);
}
