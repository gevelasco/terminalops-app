import { yesNoToBool } from '@features/clients/utils/client-payload';
import { parseOperatorDailyInsuredAmount } from '@features/operators/utils/operator-payload-defaults';
import type {
  OperatorInsuranceKind,
  OperatorLicenseType,
  OperatorPaymentSchedule,
  OperatorWeeklyPayDay,
} from '@shared/models/logistics.models';
import { DATA_IMPORT_SHEET_META } from './data-import-sheet-meta';
import { parseDataImportDate } from './data-import-client-fields.util';

export function parseOptionalImportDate(raw: string): string {
  const errors: string[] = [];
  return parseDataImportDate(raw, 'fecha', errors) ?? '';
}

export function parseImportYesNo(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  if (!t) {
    return false;
  }
  return yesNoToBool(t) || t === 'sí' || t === 'si' || t === '1' || t === 'true';
}

export function isOperatorTemplateExampleRow(licenseNumber: string): boolean {
  return /^\(ejemplo\)/i.test(licenseNumber.trim());
}

function matchOptionValue(
  raw: string,
  options: { value: string; label: string }[],
): string {
  const t = raw.trim().toLowerCase();
  if (!t) {
    return '';
  }
  const byValue = options.find((o) => o.value.toLowerCase() === t);
  if (byValue) {
    return byValue.value;
  }
  const byLabel = options.find((o) => o.label.trim().toLowerCase() === t);
  if (byLabel) {
    return byLabel.value;
  }
  const partial = options.find(
    (o) =>
      o.label.toLowerCase().includes(t) ||
      t.includes(o.label.trim().toLowerCase()) ||
      o.value.toLowerCase().includes(t),
  );
  return partial?.value ?? raw.trim();
}

export function resolveOperatorLicenseType(raw: string): OperatorLicenseType {
  const v = matchOptionValue(raw, [
    { value: 'unspecified', label: 'no especificado' },
    { value: 'federal', label: 'federal' },
    { value: 'state', label: 'estatal' },
    { value: 'both', label: 'federal y estatal' },
  ]);
  if (v === 'federal' || v === 'state' || v === 'both' || v === 'unspecified') {
    return v;
  }
  return 'unspecified';
}

export function resolveOperatorInsuranceKind(raw: string): OperatorInsuranceKind {
  const t = raw.trim().toLowerCase();
  if (!t || t.includes('ningun')) {
    return 'none';
  }
  if (t.includes('public') || t.includes('imss')) {
    return 'public';
  }
  if (t.includes('priv')) {
    return 'private';
  }
  return 'none';
}

export function resolveOperatorPaymentSchedule(raw: string): OperatorPaymentSchedule {
  const t = raw.trim().toLowerCase();
  if (!t) {
    return 'maneuver';
  }
  if (t === 'weekly' || t === 'semanal' || t === 'semana') {
    return 'weekly';
  }
  if (t === 'biweekly' || t === 'quincenal') {
    return 'biweekly';
  }
  if (t === 'monthly' || t === 'mensual') {
    return 'monthly';
  }
  return 'maneuver';
}

export function resolveOperatorWeeklyPayDay(raw: string): OperatorWeeklyPayDay | undefined {
  const t = raw.trim().toLowerCase();
  if (!t) {
    return undefined;
  }
  const map: Record<string, OperatorWeeklyPayDay> = {
    mon: 'mon',
    lunes: 'mon',
    tue: 'tue',
    martes: 'tue',
    wed: 'wed',
    miercoles: 'wed',
    miércoles: 'wed',
    thu: 'thu',
    jueves: 'thu',
    fri: 'fri',
    viernes: 'fri',
    sat: 'sat',
    sabado: 'sat',
    sábado: 'sat',
    sun: 'sun',
    domingo: 'sun',
  };
  return map[t] ?? (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(t) ? (t as OperatorWeeklyPayDay) : undefined);
}

export function parseOperatorDailyInsuredAmountLoose(raw: string): number | null {
  const parsed = parseOperatorDailyInsuredAmount(raw);
  if (parsed === 'invalid') {
    return null;
  }
  return parsed;
}

function operatorExampleCells(record: Record<string, string>): string[] {
  return DATA_IMPORT_SHEET_META.operators.columns.map((col) => record[col.key] ?? '');
}

/** Operador con cobertura pública (IMSS). */
const OPERATOR_TEMPLATE_EXAMPLES_IMSS: Record<string, string> = {
  licencia_numero: '(ejemplo) CMX-778899',
  nombre: 'Juan Pérez García',
  fecha_nacimiento: '15/03/1990',
  curp: 'PEGJ900315HDFRRN09',
  rfc: 'PEGJ900315ABC',
  licencia_vigencia: '31/12/2028',
  tipo_licencia: 'Federal',
  endosos_licencia: '',
  telefono: '5512345678',
  telefono_secundario: '',
  domicilio: 'Cd. de México',
  fecha_ingreso: '01/06/2024',
  tipo_contratacion: 'Tiempo indeterminado',
  metodo_cobro: 'Semana',
  dia_pago_semanal: 'Viernes',
  metodo_pago: 'Transferencia',
  contacto_emergencia_nombre: 'María Pérez',
  contacto_emergencia_parentesco: 'Cónyuge',
  contacto_emergencia_telefono: '5587654321',
  contacto_emergencia_correo: 'maria@ejemplo.com',
  contacto_emergencia_info_medica: 'Sí',
  tipo_cobertura: 'Público (IMSS)',
  nss: '12345678901',
  imss_alta: '01/06/2024',
  cantidad_diaria_imss: '350',
  tipo_salario_imss: 'Fijo',
  infonavit: 'No',
  infonavit_credito: '',
  fonacot: 'No',
  fonacot_credito: '',
  notas_imss: '',
  aseguradora: '',
  poliza: '',
  poliza_vigencia_desde: '',
  poliza_vigencia_hasta: '',
  prima: '',
  periodo_prima: '',
  deducible_poliza: '',
  resumen_plan: '',
};

/** Operador con seguro médico privado (sin datos IMSS). */
const OPERATOR_TEMPLATE_EXAMPLES_PRIVATE: Record<string, string> = {
  licencia_numero: '(ejemplo) GDL-445566',
  nombre: 'Rosa Martínez López',
  fecha_nacimiento: '22/07/1988',
  curp: '',
  rfc: '',
  licencia_vigencia: '15/06/2027',
  tipo_licencia: 'Estatal',
  endosos_licencia: 'Solo carga seca',
  telefono: '3311223344',
  telefono_secundario: '3333445566',
  domicilio: 'Guadalajara, Jal.',
  fecha_ingreso: '10/02/2025',
  tipo_contratacion: 'Por obra o servicio',
  metodo_cobro: 'Maniobra',
  dia_pago_semanal: '',
  metodo_pago: 'Efectivo',
  contacto_emergencia_nombre: 'Luis Martínez',
  contacto_emergencia_parentesco: 'Hermano / hermana',
  contacto_emergencia_telefono: '3310001122',
  contacto_emergencia_correo: '',
  contacto_emergencia_info_medica: 'No',
  tipo_cobertura: 'Privado',
  nss: '',
  imss_alta: '',
  cantidad_diaria_imss: '',
  tipo_salario_imss: '',
  infonavit: '',
  infonavit_credito: '',
  fonacot: '',
  fonacot_credito: '',
  notas_imss: '',
  aseguradora: 'GNP',
  poliza: 'POL-7788-A',
  poliza_vigencia_desde: '01/01/2025',
  poliza_vigencia_hasta: '31/12/2025',
  prima: '980',
  periodo_prima: 'Mensual',
  deducible_poliza: '5% deducible',
  resumen_plan: 'Gastos médicos mayores',
};

export function operatorTemplateExampleRow(): string[] {
  return operatorExampleCells(OPERATOR_TEMPLATE_EXAMPLES_IMSS);
}

export function operatorTemplateExampleRows(): string[][] {
  return [
    operatorExampleCells(OPERATOR_TEMPLATE_EXAMPLES_IMSS),
    operatorExampleCells(OPERATOR_TEMPLATE_EXAMPLES_PRIVATE),
  ];
}