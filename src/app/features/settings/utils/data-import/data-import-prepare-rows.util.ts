import { isDollyEquipmentType } from '@features/fleet/utils/equipment-dolly-convoy.util';
import { EQUIPMENT_OPERATION_TYPE_OPTIONS } from '@shared/catalogs/fleet-form-options';
import type { CreateClientPayload } from '@shared/models/client.models';
import type { CreateEquipmentPayload, CreateUnitPayload } from '@shared/models/api/api-fleet.model';
import type { Operator } from '@shared/models/logistics.models';
import type { UnitFleetMeta, EquipmentFleetMeta } from '@shared/models/logistics.models';
import {
  defaultOperatorShell,
  mergeOperatorNested,
  normalizeOperatorImssSalaryType,
} from '@features/operators/utils/operator-payload-defaults';
import {
  OPERATOR_EMPLOYMENT_CONTRACT_OPTIONS,
  OPERATOR_PREMIUM_PERIOD_OPTIONS,
} from '@shared/catalogs/operator-form-options';
import {
  isOperatorTemplateExampleRow,
  parseImportYesNo,
  parseOptionalImportDate,
  parseOperatorDailyInsuredAmountLoose,
  resolveOperatorInsuranceKind,
  resolveOperatorLicenseType,
  resolveOperatorPaymentSchedule,
  resolveOperatorWeeklyPayDay,
} from './data-import-operator-fields.util';
import {
  isEquipmentTemplateExampleRow,
  parseEquipmentAxleCountLoose,
} from './data-import-equipment-fields.util';
import {
  isUnitTemplateExampleRow,
  parseImportAmountLoose,
  parseImportTonsLoose,
  resolveTrailerTenureMode,
  resolveUnitModelYear,
} from './data-import-unit-fields.util';
import { deriveFleetBrandAbbr } from '@shared/utils/fleet/derive-fleet-brand-abbr';
import {
  isClientTemplateExampleRow,
  parseCreditGranted,
  parseDataImportDate,
  parseMxPostalCode,
  parseOptionalRfc,
  parsePaymentMethod,
} from './data-import-client-fields.util';
import { DATA_IMPORT_SHEET_META } from './data-import-sheet-meta';
import type {
  DataImportEntityKind,
  DataImportPreparedRow,
} from './data-import.types';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function field(record: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const v = (record[key] ?? '').trim();
    if (v) {
      return v;
    }
  }
  return '';
}

function parseYmdOptional(raw: string, label: string, errors: string[]): string | undefined {
  const t = raw.trim();
  if (!t) {
    return undefined;
  }
  if (!YMD.test(t)) {
    errors.push(`${label} debe ser AAAA-MM-DD.`);
    return undefined;
  }
  return t;
}

function resolveEquipmentOperationType(raw: string): { code: string; label: string } | null {
  const t = raw.trim().toLowerCase();
  if (!t) {
    return null;
  }
  const byValue = EQUIPMENT_OPERATION_TYPE_OPTIONS.find((o) => o.value === t);
  if (byValue) {
    return { code: byValue.value, label: byValue.label };
  }
  const byLabel = EQUIPMENT_OPERATION_TYPE_OPTIONS.find(
    (o) => o.label.trim().toLowerCase() === t,
  );
  if (byLabel) {
    return { code: byLabel.value, label: byLabel.label };
  }
  const partial = EQUIPMENT_OPERATION_TYPE_OPTIONS.find(
    (o) => o.label.toLowerCase().includes(t) || o.value.includes(t),
  );
  if (partial) {
    return { code: partial.value, label: partial.label };
  }
  return null;
}

function matchCatalogOption(raw: string, options: { value: string; label: string }[]): string {
  const t = raw.trim().toLowerCase();
  if (!t) {
    return '';
  }
  const hit =
    options.find((o) => o.value && o.value.toLowerCase() === t) ??
    options.find((o) => o.label.trim().toLowerCase() === t) ??
    options.find((o) => o.label.toLowerCase().includes(t));
  return hit?.value ?? raw.trim();
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildClientRow(
  record: Record<string, string>,
  sheetName: string,
  rowNumber: number,
): DataImportPreparedRow | null {
  const nombre = field(record, 'nombre');
  if (isClientTemplateExampleRow(nombre)) {
    return null;
  }
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!nombre) {
    errors.push('Falta nombre.');
  }
  const rfc = parseOptionalRfc(field(record, 'rfc'), errors);
  const fecha = parseDataImportDate(
    field(record, 'inicio_relacion', 'fecha_relacion'),
    'inicio_relacion',
    errors,
  );
  const contactoNombre = field(record, 'contacto_nombre');
  const entregaCp = parseMxPostalCode(
    field(record, 'cp_entrega'),
    'cp_entrega',
    errors,
  );
  const hasCredit = parseCreditGranted(field(record, 'credito_otorgado'));
  const creditDaysRaw = field(record, 'dias_credito');
  let creditDays: number | undefined;
  if (creditDaysRaw) {
    const n = Number(creditDaysRaw.replace(/\D/g, ''));
    if (!Number.isFinite(n) || n <= 0) {
      errors.push('dias_credito debe ser un entero mayor a 0.');
    } else {
      creditDays = n;
    }
  }
  if (hasCredit && !creditDays) {
    errors.push('Si credito_otorgado es Sí, indica dias_credito.');
  }

  const billingFields = {
    invoiceLegalName: field(record, 'razon_social_factura'),
    taxRegime: field(record, 'regimen_fiscal'),
    fiscalZip: parseMxPostalCode(field(record, 'cp_fiscal'), 'cp_fiscal', errors),
    cfdiUse: field(record, 'uso_cfdi'),
    billingPhone: field(record, 'telefono_facturacion'),
    billingEmail: field(record, 'correo_facturacion'),
  };
  const hasBilling = Object.values(billingFields).some(
    (v) => v != null && String(v).trim() !== '',
  );

  const delivery =
    entregaCp != null
      ? {
          postalCode: entregaCp,
          cityMunicipality:
            field(record, 'ciudad_municipio_entrega') || undefined,
          locality: field(record, 'localidad_entrega') || undefined,
        }
      : undefined;

  const payload: CreateClientPayload = {
    name: nombre,
    ...(rfc ? { rfc } : {}),
    ...(fecha ? { relationshipStartedOn: fecha } : {}),
    ...(field(record, 'notas_internas', 'notas')
      ? { notes: field(record, 'notas_internas', 'notas') }
      : {}),
    ...(hasBilling
      ? {
          billing: {
            ...(billingFields.invoiceLegalName
              ? { invoiceLegalName: billingFields.invoiceLegalName }
              : {}),
            ...(billingFields.taxRegime ? { taxRegime: billingFields.taxRegime } : {}),
            ...(billingFields.fiscalZip ? { fiscalZip: billingFields.fiscalZip } : {}),
            ...(billingFields.cfdiUse ? { cfdiUse: billingFields.cfdiUse } : {}),
            ...(billingFields.billingPhone
              ? { billingPhone: billingFields.billingPhone }
              : {}),
            ...(billingFields.billingEmail
              ? { billingEmail: billingFields.billingEmail }
              : {}),
          },
        }
      : {}),
    contacts: contactoNombre
      ? [
          {
            id: `import-${rowNumber}`,
            name: contactoNombre,
            ...(field(record, 'contacto_cargo') ? { role: field(record, 'contacto_cargo') } : {}),
            ...(field(record, 'contacto_telefono')
              ? { phone: field(record, 'contacto_telefono') }
              : {}),
            ...(field(record, 'contacto_email')
              ? { email: field(record, 'contacto_email') }
              : {}),
          },
        ]
      : [],
    deliveries: delivery ? [delivery] : [],
    ...(delivery ? { delivery } : {}),
    payment: {
      hasCredit,
      ...(hasCredit && creditDays != null ? { creditDays } : {}),
      ...(field(record, 'limite_credito')
        ? { approximateCreditAmount: field(record, 'limite_credito') }
        : {}),
      ...(parsePaymentMethod(field(record, 'metodo_pago_preferido'))
        ? {
            defaultPaymentMethod: parsePaymentMethod(
              field(record, 'metodo_pago_preferido'),
            ),
          }
        : {}),
    },
  };

  return {
    kind: 'clients',
    sheetName,
    rowNumber,
    status: errors.length ? 'error' : 'ready',
    summary: nombre || '(sin nombre)',
    errors,
    warnings,
    payload,
  };
}

function buildOperatorRow(
  record: Record<string, string>,
  sheetName: string,
  rowNumber: number,
): DataImportPreparedRow | null {
  const licenseNumber = field(record, 'licencia_numero', 'licencia_numero')
    .toUpperCase()
    .replace(/\s+/g, '');
  if (isOperatorTemplateExampleRow(licenseNumber)) {
    return null;
  }
  const errors: string[] = [];
  if (!licenseNumber) {
    errors.push('Falta número de licencia.');
  }
  const nombre = field(record, 'nombre') || licenseNumber || 'Operador';
  const paymentSchedule = resolveOperatorPaymentSchedule(
    field(record, 'metodo_cobro', 'forma_pago'),
  );
  const weeklyPayDay =
    paymentSchedule === 'weekly'
      ? resolveOperatorWeeklyPayDay(field(record, 'dia_pago_semanal'))
      : undefined;
  const insuranceKind = resolveOperatorInsuranceKind(field(record, 'tipo_cobertura'));
  const companyHireDate =
    parseOptionalImportDate(field(record, 'fecha_ingreso')) || todayYmd();

  const payload = mergeOperatorNested(
    defaultOperatorShell({
      id: '',
      name: nombre,
      licenseNumber: licenseNumber || '',
      licenseExpiresOn: parseOptionalImportDate(
        field(record, 'licencia_vigencia', 'licencia_vigencia'),
      ),
      phone: field(record, 'telefono') || '',
      status: 'available',
      birthDate: parseOptionalImportDate(field(record, 'fecha_nacimiento')),
      curp: field(record, 'curp').toUpperCase(),
      rfc: field(record, 'rfc').toUpperCase(),
      licenseType: resolveOperatorLicenseType(field(record, 'tipo_licencia')),
      licenseEndorsements: field(record, 'endosos_licencia'),
      phoneSecondary: field(record, 'telefono_secundario'),
      address: field(record, 'domicilio'),
      companyHireDate,
      employmentContractType: matchCatalogOption(
        field(record, 'tipo_contratacion'),
        OPERATOR_EMPLOYMENT_CONTRACT_OPTIONS,
      ),
      paymentSchedule,
      weeklyPayDay,
      paymentMethod: parsePaymentMethod(field(record, 'metodo_pago')) ?? '',
      insuranceKind,
      emergencyContact: {
        name: field(record, 'contacto_emergencia_nombre'),
        relationship: field(record, 'contacto_emergencia_parentesco'),
        phone: field(record, 'contacto_emergencia_telefono'),
        email: field(record, 'contacto_emergencia_correo'),
        authorizedMedicalInfo: parseImportYesNo(
          field(record, 'contacto_emergencia_info_medica'),
        ),
      },
      publicInsurance: {
        nss: field(record, 'nss'),
        imssAltaDate: parseOptionalImportDate(field(record, 'imss_alta')),
        dailyInsuredAmount: parseOperatorDailyInsuredAmountLoose(
          field(record, 'cantidad_diaria_imss'),
        ),
        salaryType: normalizeOperatorImssSalaryType(field(record, 'tipo_salario_imss')),
        infonavit: parseImportYesNo(field(record, 'infonavit')),
        infonavitCreditNumber: field(record, 'infonavit_credito'),
        fonacot: parseImportYesNo(field(record, 'fonacot')),
        fonacotCreditNumber: field(record, 'fonacot_credito'),
        notes: field(record, 'notas_imss'),
      },
      privateInsurance: {
        carrier: field(record, 'aseguradora'),
        policyNumber: field(record, 'poliza'),
        validFrom: parseOptionalImportDate(field(record, 'poliza_vigencia_desde')),
        validTo: parseOptionalImportDate(field(record, 'poliza_vigencia_hasta')),
        premiumAmount: field(record, 'prima'),
        premiumPeriod: matchCatalogOption(
          field(record, 'periodo_prima'),
          OPERATOR_PREMIUM_PERIOD_OPTIONS,
        ) as Operator['privateInsurance']['premiumPeriod'],
        deductibleNotes: field(record, 'deducible_poliza'),
        planSummary: field(record, 'resumen_plan'),
      },
      documents: [],
    }),
  ) as unknown as Omit<Operator, 'id'>;

  return {
    kind: 'operators',
    sheetName,
    rowNumber,
    status: errors.length ? 'error' : 'ready',
    summary: nombre || licenseNumber || '(fila)',
    errors,
    warnings: [],
    payload,
  };
}

function buildUnitRow(
  record: Record<string, string>,
  sheetName: string,
  rowNumber: number,
): DataImportPreparedRow | null {
  const plate = field(record, 'placa').toUpperCase().replace(/\s+/g, '');
  if (isUnitTemplateExampleRow(plate)) {
    return null;
  }
  const errors: string[] = [];
  const brand = field(record, 'marca');
  const version = field(record, 'version');
  const yearRaw = field(record, 'modelo_ano');

  if (!plate) {
    errors.push('Falta placa.');
  }
  if (!brand) {
    errors.push('Falta marca.');
  }
  if (!version) {
    errors.push('Falta versión.');
  }
  if (!yearRaw) {
    errors.push('Falta modelo (año).');
  }

  const { tons: capacityTons, kg: capacityKg } = parseImportTonsLoose(
    field(record, 'capacidad_ton'),
  );
  const tenureMode = resolveTrailerTenureMode(field(record, 'situacion_activo'));
  const physApplies = parseImportYesNo(field(record, 'aplica_verificacion_fisico_mecanica'));
  const emisApplies = parseImportYesNo(field(record, 'aplica_verificacion_emisiones'));
  const doubleApplies = parseImportYesNo(field(record, 'aplica_doble_articulado'));
  const hasGps = parseImportYesNo(field(record, 'tiene_gps'));
  const perfRaw = field(record, 'rendimiento_km_l').replace(/,/g, '.');

  const meta: UnitFleetMeta = {
    trailerBrandName: brand || undefined,
    trailerVersion: version || undefined,
    trailerColor: field(record, 'color') || undefined,
    serviceModality: field(record, 'modalidad_servicio') || undefined,
    trailerTenureMode: tenureMode,
    trailerCommercialValue:
      tenureMode === 'owned'
        ? parseImportAmountLoose(field(record, 'valor_comercial'))
        : undefined,
    trailerRecurringPaymentAmount:
      tenureMode === 'financed' || tenureMode === 'leased'
        ? parseImportAmountLoose(field(record, 'monto_cuota_renta'))
        : undefined,
    trailerRecurringPaymentDate:
      tenureMode === 'financed' || tenureMode === 'leased'
        ? parseOptionalImportDate(field(record, 'fecha_primer_pago')) || undefined
        : undefined,
    trailerRecurringInstallmentCount:
      tenureMode === 'financed' || tenureMode === 'leased'
        ? parseImportAmountLoose(field(record, 'plazo_cuotas'))
        : undefined,
    trailerManagementOwnerPayout:
      tenureMode === 'managed'
        ? parseImportAmountLoose(field(record, 'pago_administracion'))
        : undefined,
    transmissionType: field(record, 'transmision') || undefined,
    transmissionSpeeds: field(record, 'velocidades_transmision') || undefined,
    approximatePerformanceKmL:
      perfRaw && Number(perfRaw) > 0 ? Number(perfRaw) : undefined,
    grossVehicleWeightLb: field(record, 'ejes_traccion') || undefined,
    odometerKm: field(record, 'kilometraje_actual') || undefined,
    maintenanceKmCounter: parseImportAmountLoose(field(record, 'km_desde_ultimo_servicio')),
    lastMaintenanceDate:
      parseOptionalImportDate(field(record, 'ultimo_mantenimiento_fecha')) || undefined,
    lastMaintenanceType: field(record, 'tipo_ultimo_mantenimiento') || undefined,
    lastMaintenanceCost: parseImportAmountLoose(field(record, 'ultimo_mantenimiento_costo')),
    lastMaintenanceNotes: field(record, 'notas_mantenimiento') || undefined,
    tireCondition: field(record, 'estado_llantas') || undefined,
    verificationPhysMechDate: physApplies
      ? parseOptionalImportDate(field(record, 'fecha_verificacion_fisico_mecanica')) || undefined
      : undefined,
    verificationPhysMechCost: physApplies
      ? parseImportAmountLoose(field(record, 'costo_verificacion_fisico_mecanica'))
      : undefined,
    verificationEmissionsDate: emisApplies
      ? parseOptionalImportDate(field(record, 'fecha_verificacion_emisiones')) || undefined
      : undefined,
    verificationEmissionsCost: emisApplies
      ? parseImportAmountLoose(field(record, 'costo_verificacion_emisiones'))
      : undefined,
    verificationDoubleArticulatedApplies: doubleApplies,
    verificationDoubleArticulatedDate: doubleApplies
      ? parseOptionalImportDate(field(record, 'fecha_verificacion_doble_articulado')) || undefined
      : undefined,
    verificationDoubleArticulatedCost: doubleApplies
      ? parseImportAmountLoose(field(record, 'costo_verificacion_doble_articulado'))
      : undefined,
    insuranceCarrierName: field(record, 'aseguradora') || undefined,
    insurancePolicyNumber: field(record, 'numero_poliza') || undefined,
    insurancePaymentCadence: field(record, 'periodicidad_pago_seguro') || undefined,
    insurancePaymentMethod: field(record, 'metodo_pago_seguro') || undefined,
    insuranceContractDate:
      parseOptionalImportDate(field(record, 'fecha_contrato_seguro')) || undefined,
    insuranceCost: parseImportAmountLoose(field(record, 'costo_seguro')),
    ...(hasGps
      ? {
          hasGps: true as const,
          gpsProviderBrand: field(record, 'marca_proveedor_gps') || undefined,
          gpsPaymentCadence: field(record, 'periodicidad_pago_gps') || undefined,
          gpsPaymentMethod: field(record, 'metodo_pago_gps') || undefined,
          gpsContractDate:
            parseOptionalImportDate(field(record, 'fecha_contrato_gps')) || undefined,
          gpsPrice: parseImportAmountLoose(field(record, 'precio_gps')),
          gpsTrackingPortalUrl: field(record, 'url_portal_gps') || undefined,
          gpsCoveredByInsuranceEndorsement: parseImportYesNo(
            field(record, 'gps_cubierto_por_endoso'),
          )
            ? true
            : undefined,
        }
      : { hasGps: false as const }),
  };

  const payload: CreateUnitPayload = {
    plate: plate || '',
    transportType: field(record, 'tipo_transporte') || 'tractocamion',
    capacityKg,
    ...(capacityTons != null ? { capacityTons } : {}),
    trailerBrandAbbr: deriveFleetBrandAbbr(brand) || undefined,
    trailerYear: resolveUnitModelYear(yearRaw),
    motorNumber: field(record, 'numero_motor', 'numero_motor').toUpperCase() || undefined,
    serialNumber: field(record, 'numero_serie').toUpperCase() || undefined,
    name: field(record, 'nombre_alias', 'alias') || undefined,
    fleetMeta: meta,
  };

  return {
    kind: 'units',
    sheetName,
    rowNumber,
    status: errors.length ? 'error' : 'ready',
    summary: plate || brand || '(fila)',
    errors,
    warnings: [],
    payload,
  };
}

function buildEquipmentRow(
  record: Record<string, string>,
  sheetName: string,
  rowNumber: number,
): DataImportPreparedRow | null {
  const plate = field(record, 'placa').toUpperCase().replace(/\s+/g, '');
  if (isEquipmentTemplateExampleRow(plate)) {
    return null;
  }
  const errors: string[] = [];
  const brand = field(record, 'marca');
  const version = field(record, 'version');
  const yearRaw = field(record, 'modelo_ano');
  const opRaw = field(record, 'tipo_equipo');
  const op = opRaw ? resolveEquipmentOperationType(opRaw) : null;
  const isDolly = isDollyEquipmentType(op?.code ?? opRaw);

  if (!plate && !isDolly) {
    errors.push('Falta placa.');
  }
  if (!plate && isDolly) {
    const serialField = field(record, 'numero_serie').trim();
    const nameField = field(record, 'nombre_alias', 'nombre').trim();
    if (!serialField && !nameField) {
      errors.push('Para dolly sin placa indica número de serie o nombre.');
    }
  }
  if (!brand) {
    errors.push('Falta marca.');
  }
  if (!opRaw) {
    errors.push('Falta tipo de equipo.');
  }
  if (!yearRaw) {
    errors.push('Falta modelo (año).');
  }

  const resolvedSerial = field(record, 'numero_serie').toUpperCase() || plate;
  const displayName = field(record, 'nombre_alias', 'nombre') || resolvedSerial || plate;

  const tenureMode = resolveTrailerTenureMode(field(record, 'situacion_activo'));
  const physApplies = parseImportYesNo(field(record, 'aplica_verificacion_fisico_mecanica'));
  const doubleApplies = parseImportYesNo(field(record, 'aplica_doble_articulado'));

  const meta: EquipmentFleetMeta = {
    trailerBrandName: brand || undefined,
    trailerVersion: version || undefined,
    trailerColor: field(record, 'color') || undefined,
    trailerTenureMode: tenureMode,
    trailerCommercialValue:
      tenureMode === 'owned'
        ? parseImportAmountLoose(field(record, 'valor_comercial'))
        : undefined,
    trailerRecurringPaymentAmount:
      tenureMode === 'financed' || tenureMode === 'leased'
        ? parseImportAmountLoose(field(record, 'monto_cuota_renta'))
        : undefined,
    trailerRecurringPaymentDate:
      tenureMode === 'financed' || tenureMode === 'leased'
        ? parseOptionalImportDate(field(record, 'fecha_primer_pago')) || undefined
        : undefined,
    trailerRecurringInstallmentCount:
      tenureMode === 'financed' || tenureMode === 'leased'
        ? parseImportAmountLoose(field(record, 'plazo_cuotas'))
        : undefined,
    trailerRecurringPaymentCadence: field(record, 'periodicidad_tenencia') || undefined,
    trailerTenureBeneficiary: field(record, 'beneficiario_tenencia') || undefined,
    trailerManagementOwnerPayout:
      tenureMode === 'managed'
        ? parseImportAmountLoose(field(record, 'pago_administracion'))
        : undefined,
    equipmentCapacityTons: field(record, 'capacidad_ton') || undefined,
    equipmentAxleCount: parseEquipmentAxleCountLoose(field(record, 'numero_ejes')),
    equipmentContainerSlotConfig: field(record, 'configuracion_contenedor') || undefined,
    lastMaintenanceDate:
      parseOptionalImportDate(field(record, 'ultimo_mantenimiento_fecha')) || undefined,
    lastMaintenanceType: field(record, 'tipo_ultimo_mantenimiento') || undefined,
    lastMaintenanceCost: parseImportAmountLoose(field(record, 'ultimo_mantenimiento_costo')),
    lastMaintenanceNotes: field(record, 'notas_mantenimiento') || undefined,
    tireCondition: field(record, 'estado_llantas') || undefined,
    verificationPhysMechDate: physApplies
      ? parseOptionalImportDate(field(record, 'fecha_verificacion_fisico_mecanica')) || undefined
      : undefined,
    verificationPhysMechCost: physApplies
      ? parseImportAmountLoose(field(record, 'costo_verificacion_fisico_mecanica'))
      : undefined,
    verificationDoubleArticulatedApplies: doubleApplies,
    verificationDoubleArticulatedDate: doubleApplies
      ? parseOptionalImportDate(field(record, 'fecha_verificacion_doble_articulado')) || undefined
      : undefined,
    verificationDoubleArticulatedCost: doubleApplies
      ? parseImportAmountLoose(field(record, 'costo_verificacion_doble_articulado'))
      : undefined,
    insuranceCarrierName: field(record, 'aseguradora') || undefined,
    insurancePolicyNumber: field(record, 'numero_poliza') || undefined,
    insurancePaymentCadence: field(record, 'periodicidad_pago_seguro') || undefined,
    insurancePaymentMethod: field(record, 'metodo_pago_seguro') || undefined,
    insuranceContractDate:
      parseOptionalImportDate(field(record, 'fecha_contrato_seguro')) || undefined,
    insuranceCost: parseImportAmountLoose(field(record, 'costo_seguro')),
  };

  const payload: CreateEquipmentPayload = {
    name: displayName,
    serialNumber: resolvedSerial,
    plate: plate || undefined,
    type: op?.label ?? opRaw,
    trailerBrandAbbr: deriveFleetBrandAbbr(brand) || undefined,
    trailerYear: resolveUnitModelYear(yearRaw),
    fleetMeta: meta,
  };

  return {
    kind: 'equipment',
    sheetName,
    rowNumber,
    status: errors.length ? 'error' : 'ready',
    summary: plate || displayName,
    errors,
    warnings: ['Enganche a unidad no se importa; asigna en Flota si aplica.'],
    payload,
  };
}

export function prepareDataImportRows(
  kind: DataImportEntityKind,
  sheetName: string,
  records: Record<string, string>[],
): DataImportPreparedRow[] {
  const requiredKeys = new Set(
    DATA_IMPORT_SHEET_META[kind].columns.filter((c) => c.required).map((c) => c.key),
  );
  const out: DataImportPreparedRow[] = [];
  for (let idx = 0; idx < records.length; idx++) {
    const record = records[idx]!;
    const rowNumber = idx + 2;
    const row =
      kind === 'clients'
        ? buildClientRow(record, sheetName, rowNumber)
        : kind === 'operators'
          ? buildOperatorRow(record, sheetName, rowNumber)
          : kind === 'units'
            ? buildUnitRow(record, sheetName, rowNumber)
            : buildEquipmentRow(record, sheetName, rowNumber);
    if (row == null) {
      continue;
    }

    for (const key of requiredKeys) {
      if (!field(record, key)) {
        if (!row.errors.some((e) => e.includes(key))) {
          row.errors.push(`Falta ${key}.`);
        }
      }
    }
    if (row.errors.length > 0) {
      row.status = 'error';
    }
    out.push(row);
  }
  return out;
}