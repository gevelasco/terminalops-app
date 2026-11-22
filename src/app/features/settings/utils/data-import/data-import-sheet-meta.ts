import type { DataImportEntityKind } from './data-import.types';

export type DataImportColumnDef = {
  key: string;
  header: string;
  required?: boolean;
  hint?: string;
};

export const DATA_IMPORT_SHEET_META: Record<
  DataImportEntityKind,
  { sheetTitle: string; columns: DataImportColumnDef[] }
> = {
  clients: {
    sheetTitle: 'Clientes',
    columns: [
      {
        key: 'nombre',
        header: 'Nombre o razón social',
        required: true,
        hint: 'Único obligatorio (igual que en Comercial)',
      },
      { key: 'rfc', header: 'RFC', hint: 'Opcional; único en la empresa si se captura' },
      {
        key: 'inicio_relacion',
        header: 'Inicio de relación comercial',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      { key: 'notas_internas', header: 'Notas internas', hint: 'Opcional' },
      {
        key: 'razon_social_factura',
        header: 'Razón social en factura',
        hint: 'Opcional; si difiere del nombre corto',
      },
      { key: 'regimen_fiscal', header: 'Régimen fiscal', hint: 'Opcional. Ej. 601' },
      { key: 'cp_fiscal', header: 'C.P. fiscal', hint: 'Opcional. 5 dígitos' },
      { key: 'uso_cfdi', header: 'Uso CFDI habitual', hint: 'Opcional. Ej. G03' },
      { key: 'telefono_facturacion', header: 'Teléfono facturación', hint: 'Opcional' },
      {
        key: 'correo_facturacion',
        header: 'Correo para envío de facturas',
        hint: 'Opcional',
      },
      {
        key: 'cp_entrega',
        header: 'C.P. entrega',
        hint: 'Opcional; con CP se geocodifica localidad',
      },
      { key: 'ciudad_municipio_entrega', header: 'Ciudad o municipio entrega', hint: 'Opcional' },
      { key: 'localidad_entrega', header: 'Localidad entrega', hint: 'Opcional' },
      { key: 'contacto_nombre', header: 'Contacto nombre', hint: 'Opcional' },
      { key: 'contacto_cargo', header: 'Contacto cargo / área', hint: 'Opcional' },
      { key: 'contacto_telefono', header: 'Contacto teléfono', hint: 'Opcional' },
      { key: 'contacto_email', header: 'Contacto correo', hint: 'Opcional' },
      {
        key: 'credito_otorgado',
        header: '¿Crédito otorgado?',
        hint: 'Opcional. Sí / No',
      },
      {
        key: 'dias_credito',
        header: 'Días de crédito',
        hint: 'Opcional; obligatorio si hay crédito',
      },
      {
        key: 'limite_credito',
        header: 'Límite o volumen de crédito (Alerta)',
        hint: 'Opcional. Monto numérico para alertas (sin moneda ni texto)',
      },
      {
        key: 'metodo_pago_preferido',
        header: 'Método de pago preferido',
        hint: 'Opcional. efectivo, transferencia, cheque',
      },
    ],
  },
  operators: {
    sheetTitle: 'Operadores',
    columns: [
      {
        key: 'licencia_numero',
        header: 'Número de licencia',
        required: true,
        hint: 'Único en la empresa; único obligatorio',
      },
      { key: 'nombre', header: 'Nombre completo', hint: 'Opcional' },
      {
        key: 'fecha_nacimiento',
        header: 'Fecha de nacimiento',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      { key: 'curp', header: 'CURP', hint: 'Opcional' },
      { key: 'rfc', header: 'RFC', hint: 'Opcional' },
      {
        key: 'licencia_vigencia',
        header: 'Vence licencia',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      { key: 'tipo_licencia', header: 'Tipo de licencia', hint: 'Opcional. Federal, estatal…' },
      { key: 'endosos_licencia', header: 'Endosos / restricciones', hint: 'Opcional' },
      { key: 'telefono', header: 'Teléfono principal', hint: 'Opcional' },
      {
        key: 'telefono_secundario',
        header: 'Teléfono secundario / WhatsApp',
        hint: 'Opcional',
      },
      { key: 'domicilio', header: 'Domicilio', hint: 'Opcional' },
      {
        key: 'fecha_ingreso',
        header: 'Fecha de ingreso a la empresa',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      { key: 'tipo_contratacion', header: 'Tipo de contratación', hint: 'Opcional' },
      {
        key: 'metodo_cobro',
        header: 'Método de cobro',
        hint: 'Opcional. Maniobra, semana, quincenal, mensual',
      },
      { key: 'dia_pago_semanal', header: 'Día de pago semanal', hint: 'Opcional si cobro semanal' },
      { key: 'metodo_pago', header: 'Método de pago', hint: 'Opcional' },
      { key: 'contacto_emergencia_nombre', header: 'Contacto emergencia nombre', hint: 'Opcional' },
      {
        key: 'contacto_emergencia_parentesco',
        header: 'Contacto emergencia parentesco',
        hint: 'Opcional',
      },
      {
        key: 'contacto_emergencia_telefono',
        header: 'Contacto emergencia teléfono',
        hint: 'Opcional',
      },
      { key: 'contacto_emergencia_correo', header: 'Contacto emergencia correo', hint: 'Opcional' },
      {
        key: 'contacto_emergencia_info_medica',
        header: 'Autorizado info médica',
        hint: 'Opcional. Sí / No',
      },
      {
        key: 'tipo_cobertura',
        header: 'Tipo de cobertura',
        hint: 'Opcional. Ninguno, público (IMSS), privado',
      },
      { key: 'nss', header: 'NSS', hint: 'Opcional; seguro público' },
      {
        key: 'imss_alta',
        header: 'Fecha de alta IMSS',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      {
        key: 'cantidad_diaria_imss',
        header: 'Cantidad diaria IMSS',
        hint: 'Opcional. Solo número (ej. 350)',
      },
      { key: 'tipo_salario_imss', header: 'Tipo de salario IMSS', hint: 'Opcional' },
      { key: 'infonavit', header: 'Infonavit', hint: 'Opcional. Sí / No' },
      { key: 'infonavit_credito', header: 'Crédito Infonavit', hint: 'Opcional' },
      { key: 'fonacot', header: 'Fonacot', hint: 'Opcional. Sí / No' },
      { key: 'fonacot_credito', header: 'Crédito Fonacot', hint: 'Opcional' },
      { key: 'notas_imss', header: 'Notas IMSS', hint: 'Opcional' },
      { key: 'aseguradora', header: 'Aseguradora', hint: 'Opcional; seguro privado' },
      { key: 'poliza', header: 'Número de póliza', hint: 'Opcional' },
      {
        key: 'poliza_vigencia_desde',
        header: 'Póliza vigencia desde',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      {
        key: 'poliza_vigencia_hasta',
        header: 'Póliza vigencia hasta',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      {
        key: 'prima',
        header: 'Prima',
        hint: 'Opcional. Solo monto numérico; el periodo va en la columna siguiente',
      },
      {
        key: 'periodo_prima',
        header: 'Periodo de prima',
        hint: 'Opcional. Mensual, anual, otro…',
      },
      {
        key: 'deducible_poliza',
        header: 'Deducible / notas póliza',
        hint: 'Opcional. Texto libre (notas)',
      },
      { key: 'resumen_plan', header: 'Resumen del plan', hint: 'Opcional' },
    ],
  },
  units: {
    sheetTitle: 'Unidades',
    columns: [
      { key: 'placa', header: 'Placa', required: true, hint: 'Único en la empresa si se captura' },
      { key: 'marca', header: 'Marca', required: true, hint: 'Obligatorio' },
      { key: 'version', header: 'Versión', required: true, hint: 'Obligatorio' },
      { key: 'modelo_ano', header: 'Modelo (año)', required: true, hint: 'Obligatorio. Ej. 2022' },
      {
        key: 'tipo_transporte',
        header: 'Tipo de transporte',
        hint: 'Opcional. Ej. tractocamion',
      },
      { key: 'numero_serie', header: 'Número de serie / VIN', hint: 'Opcional; único si se captura' },
      { key: 'numero_motor', header: 'Número de motor', hint: 'Opcional; único si se captura' },
      { key: 'modalidad_servicio', header: 'Modalidad', hint: 'Opcional' },
      { key: 'color', header: 'Color', hint: 'Opcional' },
      { key: 'nombre_alias', header: 'Nombre o alias', hint: 'Opcional' },
      {
        key: 'situacion_activo',
        header: 'Situación del activo',
        hint: 'Opcional. Propio, financiado, arrendado, administrado',
      },
      {
        key: 'valor_comercial',
        header: 'Valor comercial estimado',
        hint: 'Opcional. Solo número',
      },
      {
        key: 'monto_cuota_renta',
        header: 'Monto cuota o renta',
        hint: 'Opcional. Solo número',
      },
      {
        key: 'fecha_primer_pago',
        header: 'Fecha del primer pago',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      { key: 'plazo_cuotas', header: 'Plazo de cuotas', hint: 'Opcional. Solo número entero' },
      {
        key: 'pago_administracion',
        header: 'Pago administración al dueño',
        hint: 'Opcional. Solo número',
      },
      { key: 'transmision', header: 'Transmisión', hint: 'Opcional' },
      { key: 'velocidades_transmision', header: 'Velocidades', hint: 'Opcional' },
      {
        key: 'rendimiento_km_l',
        header: 'Rendimiento aprox.',
        hint: 'Opcional. Solo número (km/L)',
      },
      { key: 'capacidad_ton', header: 'Capacidad', hint: 'Opcional. Solo número (ton)' },
      { key: 'ejes_traccion', header: 'Ejes de tracción', hint: 'Opcional. Solo número entero' },
      {
        key: 'kilometraje_actual',
        header: 'Kilometraje actual',
        hint: 'Opcional. Solo número',
      },
      {
        key: 'ultimo_mantenimiento_fecha',
        header: 'Último mantenimiento',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      {
        key: 'ultimo_mantenimiento_costo',
        header: 'Costo último mantenimiento',
        hint: 'Opcional. Solo número',
      },
      { key: 'tipo_ultimo_mantenimiento', header: 'Tipo de mantenimiento', hint: 'Opcional' },
      {
        key: 'km_desde_ultimo_servicio',
        header: 'Km desde último servicio',
        hint: 'Opcional. Solo número',
      },
      { key: 'estado_llantas', header: 'Estado de llantas', hint: 'Opcional' },
      { key: 'notas_mantenimiento', header: 'Observaciones mantenimiento', hint: 'Opcional' },
      {
        key: 'aplica_verificacion_fisico_mecanica',
        header: 'Aplica verificación físico-mecánica',
        hint: 'Opcional. Sí / No',
      },
      {
        key: 'fecha_verificacion_fisico_mecanica',
        header: 'Fecha verificación físico-mecánica',
        hint: 'Opcional',
      },
      {
        key: 'costo_verificacion_fisico_mecanica',
        header: 'Costo verificación físico-mecánica',
        hint: 'Opcional. Solo número',
      },
      {
        key: 'aplica_verificacion_emisiones',
        header: 'Aplica verificación de emisiones',
        hint: 'Opcional. Sí / No',
      },
      {
        key: 'fecha_verificacion_emisiones',
        header: 'Fecha verificación emisiones',
        hint: 'Opcional',
      },
      {
        key: 'costo_verificacion_emisiones',
        header: 'Costo verificación emisiones',
        hint: 'Opcional. Solo número',
      },
      {
        key: 'aplica_doble_articulado',
        header: 'Aplica doble articulado',
        hint: 'Opcional. Sí / No',
      },
      {
        key: 'fecha_verificacion_doble_articulado',
        header: 'Fecha verificación doble articulado',
        hint: 'Opcional',
      },
      {
        key: 'costo_verificacion_doble_articulado',
        header: 'Costo verificación doble articulado',
        hint: 'Opcional. Solo número',
      },
      { key: 'aseguradora', header: 'Aseguradora', hint: 'Opcional' },
      { key: 'numero_poliza', header: 'Número de póliza', hint: 'Opcional' },
      { key: 'periodicidad_pago_seguro', header: 'Periodicidad pago seguro', hint: 'Opcional' },
      { key: 'metodo_pago_seguro', header: 'Método de pago seguro', hint: 'Opcional' },
      {
        key: 'fecha_contrato_seguro',
        header: 'Fecha contrato seguro',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      { key: 'costo_seguro', header: 'Costo seguro', hint: 'Opcional. Solo número' },
      { key: 'tiene_gps', header: 'Tiene GPS', hint: 'Opcional. Sí / No' },
      { key: 'marca_proveedor_gps', header: 'Marca proveedor GPS', hint: 'Opcional' },
      { key: 'periodicidad_pago_gps', header: 'Periodicidad pago GPS', hint: 'Opcional' },
      { key: 'metodo_pago_gps', header: 'Método de pago GPS', hint: 'Opcional' },
      {
        key: 'fecha_contrato_gps',
        header: 'Fecha contrato GPS',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      { key: 'precio_gps', header: 'Precio GPS', hint: 'Opcional. Solo número' },
      { key: 'url_portal_gps', header: 'URL portal GPS', hint: 'Opcional' },
      {
        key: 'gps_cubierto_por_endoso',
        header: 'GPS cubierto por endoso',
        hint: 'Opcional. Sí / No',
      },
    ],
  },
  equipment: {
    sheetTitle: 'Equipos',
    columns: [
      {
        key: 'placa',
        header: 'Placa',
        hint: 'Obligatorio salvo dolly/convertidor. Único en la empresa si se captura',
      },
      { key: 'marca', header: 'Marca', required: true, hint: 'Obligatorio' },
      {
        key: 'tipo_equipo',
        header: 'Tipo de equipo',
        required: true,
        hint: 'Obligatorio. Código o etiqueta (ej. caja_seca, Caja seca)',
      },
      { key: 'modelo_ano', header: 'Modelo (año)', required: true, hint: 'Obligatorio. Ej. 2022' },
      { key: 'version', header: 'Versión', hint: 'Opcional' },
      {
        key: 'numero_serie',
        header: 'Número de serie',
        hint: 'Opcional; único si se captura. Obligatorio en dolly sin placa (si vacío, se usa la placa)',
      },
      { key: 'nombre_alias', header: 'Nombre o alias', hint: 'Opcional' },
      { key: 'color', header: 'Color', hint: 'Opcional' },
      {
        key: 'situacion_activo',
        header: 'Situación del activo',
        hint: 'Opcional. Propio, financiado, arrendado, administrado',
      },
      {
        key: 'valor_comercial',
        header: 'Valor comercial estimado',
        hint: 'Opcional. Solo número',
      },
      { key: 'beneficiario_tenencia', header: 'Beneficiario', hint: 'Opcional' },
      {
        key: 'monto_cuota_renta',
        header: 'Monto cuota o renta',
        hint: 'Opcional. Solo número',
      },
      {
        key: 'fecha_primer_pago',
        header: 'Fecha del primer pago',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      { key: 'plazo_cuotas', header: 'Plazo de cuotas', hint: 'Opcional. Solo número entero' },
      { key: 'periodicidad_tenencia', header: 'Periodicidad de pago', hint: 'Opcional' },
      {
        key: 'pago_administracion',
        header: 'Pago administración al dueño',
        hint: 'Opcional. Solo número',
      },
      {
        key: 'configuracion_contenedor',
        header: 'Configuración contenedor',
        hint: 'Opcional',
      },
      { key: 'capacidad_ton', header: 'Capacidad', hint: 'Opcional. Solo número (ton)' },
      { key: 'numero_ejes', header: 'Número de ejes', hint: 'Opcional. Solo número entero' },
      {
        key: 'ultimo_mantenimiento_fecha',
        header: 'Último mantenimiento',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      {
        key: 'ultimo_mantenimiento_costo',
        header: 'Costo último mantenimiento',
        hint: 'Opcional. Solo número',
      },
      { key: 'tipo_ultimo_mantenimiento', header: 'Tipo de mantenimiento', hint: 'Opcional' },
      { key: 'estado_llantas', header: 'Estado de llantas', hint: 'Opcional' },
      { key: 'notas_mantenimiento', header: 'Observaciones mantenimiento', hint: 'Opcional' },
      {
        key: 'aplica_verificacion_fisico_mecanica',
        header: 'Aplica verificación físico-mecánica',
        hint: 'Opcional. Sí / No',
      },
      {
        key: 'fecha_verificacion_fisico_mecanica',
        header: 'Fecha verificación físico-mecánica',
        hint: 'Opcional',
      },
      {
        key: 'costo_verificacion_fisico_mecanica',
        header: 'Costo verificación físico-mecánica',
        hint: 'Opcional. Solo número',
      },
      {
        key: 'aplica_doble_articulado',
        header: 'Aplica doble articulado',
        hint: 'Opcional. Sí / No',
      },
      {
        key: 'fecha_verificacion_doble_articulado',
        header: 'Fecha verificación doble articulado',
        hint: 'Opcional',
      },
      {
        key: 'costo_verificacion_doble_articulado',
        header: 'Costo verificación doble articulado',
        hint: 'Opcional. Solo número',
      },
      { key: 'aseguradora', header: 'Nombre del seguro', hint: 'Opcional' },
      { key: 'numero_poliza', header: 'Número de póliza', hint: 'Opcional' },
      { key: 'periodicidad_pago_seguro', header: 'Periodicidad pago seguro', hint: 'Opcional' },
      { key: 'metodo_pago_seguro', header: 'Forma de pago seguro', hint: 'Opcional' },
      {
        key: 'fecha_contrato_seguro',
        header: 'Fecha contratación seguro',
        hint: 'Opcional. dd/mm/aaaa o AAAA-MM-DD',
      },
      { key: 'costo_seguro', header: 'Costo seguro', hint: 'Opcional. Solo número' },
    ],
  },
};

const SHEET_NAME_TO_KIND: Record<string, DataImportEntityKind> = {
  clientes: 'clients',
  clients: 'clients',
  comercial: 'clients',
  operadores: 'operators',
  operators: 'operators',
  unidades: 'units',
  units: 'units',
  equipos: 'equipment',
  equipment: 'equipment',
};

export function dataImportKindFromSheetName(name: string): DataImportEntityKind | null {
  const n = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return SHEET_NAME_TO_KIND[n] ?? null;
}