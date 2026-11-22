import type { DataImportEntityKind } from './data-import.types';
import { DATA_IMPORT_SHEET_META } from './data-import-sheet-meta';

/** Igual que en data-import-workbook.util (evita ciclo de imports). */
export function normalizeDataImportHeaderCell(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\*+$/, '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

const CLIENT_HEADER_ALIASES: Record<string, string> = {
  nombre: 'nombre',
  razon_social: 'nombre',
  nombre_o_razon_social: 'nombre',
  razon_social_o_nombre: 'nombre',
  rfc: 'rfc',
  inicio_relacion: 'inicio_relacion',
  inicio_de_relacion_comercial: 'inicio_relacion',
  fecha_relacion: 'inicio_relacion',
  notas_internas: 'notas_internas',
  notas: 'notas_internas',
  razon_social_factura: 'razon_social_factura',
  razon_social_en_factura: 'razon_social_factura',
  regimen_fiscal: 'regimen_fiscal',
  cp_fiscal: 'cp_fiscal',
  'c.p._fiscal': 'cp_fiscal',
  uso_cfdi: 'uso_cfdi',
  uso_cfdi_habitual: 'uso_cfdi',
  telefono_facturacion: 'telefono_facturacion',
  correo_facturacion: 'correo_facturacion',
  correo_para_envio_de_facturas: 'correo_facturacion',
  cp_entrega: 'cp_entrega',
  'c.p._entrega': 'cp_entrega',
  ciudad_municipio_entrega: 'ciudad_municipio_entrega',
  ciudad_o_municipio_entrega: 'ciudad_municipio_entrega',
  localidad_entrega: 'localidad_entrega',
  contacto_nombre: 'contacto_nombre',
  contacto_cargo: 'contacto_cargo',
  'contacto_cargo_/_area': 'contacto_cargo',
  contacto_telefono: 'contacto_telefono',
  contacto_email: 'contacto_email',
  contacto_correo: 'contacto_email',
  credito_otorgado: 'credito_otorgado',
  dias_credito: 'dias_credito',
  limite_credito: 'limite_credito',
  'limite_o_volumen_de_credito_(alerta)': 'limite_credito',
  limite_o_volumen_de_credito_alerta: 'limite_credito',
  metodo_pago_preferido: 'metodo_pago_preferido',
};

const OPERATOR_HEADER_ALIASES: Record<string, string> = {
  licencia_numero: 'licencia_numero',
  numero_de_licencia: 'licencia_numero',
  licencia_vigencia: 'licencia_vigencia',
  vence_licencia: 'licencia_vigencia',
  nombre: 'nombre',
  nombre_completo: 'nombre',
  forma_pago: 'metodo_cobro',
  metodo_cobro: 'metodo_cobro',
  fecha_ingreso: 'fecha_ingreso',
  fecha_de_ingreso_a_la_empresa: 'fecha_ingreso',
  tipo_contratacion: 'tipo_contratacion',
  dia_pago_semanal: 'dia_pago_semanal',
  telefono_secundario: 'telefono_secundario',
  'telefono_secundario_/_whatsapp': 'telefono_secundario',
  tipo_cobertura: 'tipo_cobertura',
  endosos_licencia: 'endosos_licencia',
  'endosos_/_restricciones': 'endosos_licencia',
};

const UNIT_HEADER_ALIASES: Record<string, string> = {
  placa: 'placa',
  marca: 'marca',
  version: 'version',
  modelo_ano: 'modelo_ano',
  'modelo_(ano)': 'modelo_ano',
  alias: 'nombre_alias',
  nombre_alias: 'nombre_alias',
  numero_serie: 'numero_serie',
  'numero_serie_/_vin': 'numero_serie',
  numero_motor: 'numero_motor',
  tipo_transporte: 'tipo_transporte',
  capacidad_ton: 'capacidad_ton',
};

const EQUIPMENT_HEADER_ALIASES: Record<string, string> = {
  ...UNIT_HEADER_ALIASES,
  tipo_equipo: 'tipo_equipo',
  'tipo_de_equipo': 'tipo_equipo',
  nombre: 'nombre_alias',
  'nombre_o_alias': 'nombre_alias',
  'situacion_del_activo': 'situacion_activo',
  'valor_comercial_estimado': 'valor_comercial',
  'periodicidad_de_pago': 'periodicidad_tenencia',
  'configuracion_contenedor': 'configuracion_contenedor',
  'numero_de_ejes': 'numero_ejes',
  'costo_ultimo_mantenimiento': 'ultimo_mantenimiento_costo',
  'observaciones_mantenimiento': 'notas_mantenimiento',
  'nombre_del_seguro': 'aseguradora',
  'numero_de_poliza': 'numero_poliza',
  'periodicidad_pago_seguro': 'periodicidad_pago_seguro',
  'forma_de_pago_seguro': 'metodo_pago_seguro',
  'fecha_contratacion_seguro': 'fecha_contrato_seguro',
  'costo_seguro': 'costo_seguro',
};

/** Normaliza encabezado de hoja → clave interna de campo. */
export function dataImportHeaderToFieldKey(
  kind: DataImportEntityKind,
  headerCell: unknown,
): string {
  const norm = normalizeDataImportHeaderCell(headerCell);
  if (!norm) {
    return '';
  }
  if (kind === 'clients' && CLIENT_HEADER_ALIASES[norm]) {
    return CLIENT_HEADER_ALIASES[norm]!;
  }
  if (kind === 'operators' && OPERATOR_HEADER_ALIASES[norm]) {
    return OPERATOR_HEADER_ALIASES[norm]!;
  }
  if (kind === 'units' && UNIT_HEADER_ALIASES[norm]) {
    return UNIT_HEADER_ALIASES[norm]!;
  }
  if (kind === 'equipment' && EQUIPMENT_HEADER_ALIASES[norm]) {
    return EQUIPMENT_HEADER_ALIASES[norm]!;
  }
  const meta = DATA_IMPORT_SHEET_META[kind];
  for (const col of meta.columns) {
    if (col.key === norm) {
      return col.key;
    }
    if (normalizeDataImportHeaderCell(col.header) === norm) {
      return col.key;
    }
  }
  return norm;
}
