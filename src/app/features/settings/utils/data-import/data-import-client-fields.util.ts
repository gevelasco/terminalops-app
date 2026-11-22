import { yesNoToBool } from '@features/clients/utils/client-payload';
import { normalizeMxPostalCodeDigits } from '@features/trips/utils/mx-postal-settlement';
import { DATA_IMPORT_SHEET_META } from './data-import-sheet-meta';

export function parseDataImportDate(raw: string, label: string, errors: string[]): string | undefined {
  const t = raw.trim();
  if (!t) {
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return t;
  }
  const dmy = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const d = String(dmy[1]).padStart(2, '0');
    const m = String(dmy[2]).padStart(2, '0');
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }
  errors.push(`${label}: usa AAAA-MM-DD o dd/mm/aaaa.`);
  return undefined;
}

/** Sin validación SAT: solo normaliza; duplicados los revisa `data-import-uniqueness`. */
export function parseOptionalRfc(raw: string, _errors?: string[]): string | undefined {
  const t = raw.trim().toUpperCase().replace(/\s/g, '');
  return t ? t : undefined;
}

export function parseCreditGranted(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  if (!t) {
    return false;
  }
  return yesNoToBool(t) || t === 'sí' || t === 'si';
}

export function parsePaymentMethod(raw: string): string | undefined {
  const t = raw.trim().toLowerCase();
  if (!t) {
    return undefined;
  }
  if (['cash', 'efectivo', 'contado'].includes(t)) {
    return 'cash';
  }
  if (['transfer', 'transferencia', 'spei'].includes(t)) {
    return 'transfer';
  }
  if (['check', 'cheque'].includes(t)) {
    return 'check';
  }
  return t;
}

export function parseMxPostalCode(raw: string, label: string, errors: string[]): string | undefined {
  const cp = normalizeMxPostalCodeDigits(raw);
  if (!raw.trim()) {
    return undefined;
  }
  if (!cp || cp.length !== 5) {
    errors.push(`${label}: código postal de 5 dígitos.`);
    return undefined;
  }
  return cp;
}

export function isClientTemplateExampleRow(nombre: string): boolean {
  return /^\(ejemplo\)/i.test(nombre.trim());
}

const CLIENT_TEMPLATE_EXAMPLES: Record<string, string> = {
  nombre: '(ejemplo) Acme de México',
  rfc: 'ACM010101ABC',
  inicio_relacion: '15/01/2024',
  notas_internas: 'Cliente estratégico',
  razon_social_factura: 'Acme de México SA de CV',
  regimen_fiscal: '601',
  cp_fiscal: '64000',
  uso_cfdi: 'G03',
  telefono_facturacion: '8180000000',
  correo_facturacion: 'facturacion@acme.mx',
  cp_entrega: '64000',
  ciudad_municipio_entrega: 'Monterrey',
  localidad_entrega: 'Monterrey Centro',
  contacto_nombre: 'María López',
  contacto_cargo: 'Cuentas por pagar',
  contacto_telefono: '8180001234',
  contacto_email: 'maria.lopez@acme.mx',
  credito_otorgado: 'Sí',
  dias_credito: '30',
  limite_credito: '2500000',
  metodo_pago_preferido: 'transferencia',
};

/** Fila de ejemplo en la plantilla Excel (misma longitud que columnas). */
export function clientTemplateExampleRow(): string[] {
  return DATA_IMPORT_SHEET_META.clients.columns.map(
    (col) => CLIENT_TEMPLATE_EXAMPLES[col.key] ?? '',
  );
}