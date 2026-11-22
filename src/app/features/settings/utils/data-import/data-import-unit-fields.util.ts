import { parseFleetModelYear } from '@features/fleet/utils/fleet-drawer-form.utils';
import type { TrailerTenureMode } from '@shared/models/logistics.models';
import { parseImportYesNo, parseOptionalImportDate } from './data-import-operator-fields.util';
import { DATA_IMPORT_SHEET_META } from './data-import-sheet-meta';
import { stripGroupedNumber } from '@shared/utils/format-grouped-number';

export function isUnitTemplateExampleRow(plate: string): boolean {
  return /^\(ejemplo\)/i.test(plate.trim());
}

export function parseImportAmountLoose(raw: string): number | undefined {
  const t = stripGroupedNumber(raw);
  if (!t) {
    return undefined;
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseImportTonsLoose(raw: string): { tons?: number; kg: number } {
  const t = raw.trim().replace(/,/g, '');
  if (!t) {
    return { kg: 0 };
  }
  const tons = Number(t);
  if (!Number.isFinite(tons) || tons <= 0) {
    return { kg: 0 };
  }
  return { tons, kg: Math.round(tons * 1000) };
}

export function resolveUnitModelYear(raw: string): string {
  const t = raw.trim();
  if (!t) {
    return '';
  }
  const parsed = parseFleetModelYear(t);
  return parsed.ok ? parsed.year : t;
}

export function resolveTrailerTenureMode(raw: string): TrailerTenureMode {
  const t = raw.trim().toLowerCase();
  if (!t || t.includes('propio')) {
    return 'owned';
  }
  if (t.includes('financ')) {
    return 'financed';
  }
  if (t.includes('arrend') || t.includes('rent')) {
    return 'leased';
  }
  if (t.includes('administr') || t.includes('managed')) {
    return 'managed';
  }
  if (['owned', 'financed', 'leased', 'managed'].includes(t)) {
    return t as TrailerTenureMode;
  }
  return 'owned';
}

function unitExampleCells(record: Record<string, string>): string[] {
  return DATA_IMPORT_SHEET_META.units.columns.map((col) => record[col.key] ?? '');
}

const UNIT_TEMPLATE_EXAMPLE: Record<string, string> = {
  placa: '(ejemplo) 12-AB-3C',
  marca: 'Kenworth',
  version: 'T800',
  modelo_ano: '2022',
  tipo_transporte: 'tractocamion',
  numero_serie: '3HSDZSPR5KN123456',
  numero_motor: '79412345',
  modalidad_servicio: 'Carga general',
  color: 'Blanco',
  nombre_alias: 'Ruta norte',
  situacion_activo: 'Propio',
  valor_comercial: '580000',
  monto_cuota_renta: '',
  fecha_primer_pago: '',
  plazo_cuotas: '',
  pago_administracion: '',
  transmision: 'Automática',
  velocidades_transmision: '18',
  rendimiento_km_l: '2.8',
  capacidad_ton: '30',
  ejes_traccion: '3',
  kilometraje_actual: '285000',
  ultimo_mantenimiento_fecha: '15/01/2025',
  ultimo_mantenimiento_costo: '3500',
  tipo_ultimo_mantenimiento: 'mantenimiento_general',
  km_desde_ultimo_servicio: '12000',
  estado_llantas: 'Buen estado',
  notas_mantenimiento: '',
  aplica_verificacion_fisico_mecanica: 'Sí',
  fecha_verificacion_fisico_mecanica: '01/06/2025',
  costo_verificacion_fisico_mecanica: '850',
  aplica_verificacion_emisiones: 'Sí',
  fecha_verificacion_emisiones: '01/06/2025',
  costo_verificacion_emisiones: '650',
  aplica_doble_articulado: 'No',
  fecha_verificacion_doble_articulado: '',
  costo_verificacion_doble_articulado: '',
  aseguradora: 'GNP',
  numero_poliza: 'POL-UNIT-001',
  periodicidad_pago_seguro: 'Anual',
  metodo_pago_seguro: 'Transferencia',
  fecha_contrato_seguro: '01/01/2025',
  costo_seguro: '42000',
  tiene_gps: 'Sí',
  marca_proveedor_gps: 'Samsara',
  periodicidad_pago_gps: 'Mensual',
  metodo_pago_gps: 'Transferencia',
  fecha_contrato_gps: '01/01/2025',
  precio_gps: '450',
  url_portal_gps: 'https://cloud.samsara.com',
  gps_cubierto_por_endoso: 'No',
};

export function unitTemplateExampleRow(): string[] {
  return unitExampleCells(UNIT_TEMPLATE_EXAMPLE);
}

export function unitTemplateExampleRows(): string[][] {
  return [unitTemplateExampleRow()];
}