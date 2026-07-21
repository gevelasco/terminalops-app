export type TripStatus = 'scheduled' | 'in_transit' | 'completed' | 'cancelled';

/** Forma de cobro pactada al cliente en la maniobra. */
export type TripClientPaymentMethod =
  | 'cash'
  | 'transfer'
  | 'check'
  | 'debit_card'
  | 'credit_card';

/** Código de configuración operacional de la empresa (p. ej. sencillo, full, cama-baja). */
export type TripOperationType = string;

/** Carga del servicio (equipo vacío vs cargado). */
export type TripLoadType = 'vacio' | 'lleno';

/**
 * Contenedor ISO en arrastre portuario / carretera (México).
 * DC = Dry Container estándar (8′6″); HC = High Cube (9′6″).
 */
export type TripContainerType = '20dc' | '20hc' | '40dc' | '40hc' | '45hc' | 'na';

/** Prioridad operativa del incidente (alertas; se infiere en FE, no se persiste). */
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';

/** Entrada de bitácora de maniobra; `isIncident` marca el subconjunto operativo excepcional. */
export interface TripIncident {
  id: string;
  description: string;
  /** Alta de la entrada en bitácora (`created_at`). */
  createdAt: string;
  /** Usuario de torre que registró la entrada (`username`). */
  postedBy: string;
  /** Nombre y rol para UI; lo resuelve la API desde `app_user` u operadores. */
  postedByLabel?: string;
  /** Si es true, cuenta en alertas, métricas y columna de incidente. */
  isIncident?: boolean;
}

export interface Trip {
  id: string;
  /** Código operativo: prefijo del cliente + correlativo (ej. ADM-0001). */
  maneuverCode: string;
  /** Cliente o marca a la que pertenece el servicio. */
  clientName: string;
  /** Id de cliente en catálogo (FK); alineado con `TripTableRow.clientId` en sim-db. */
  clientId: string;
  unitId: string;
  operatorId: string;
  /** Nombre live (join) del operador. */
  operatorName?: string;
  /** Código operativo live (join) de la unidad. */
  unitOperationalCode?: string;
  status: TripStatus;
  /** Alta de la maniobra en el sistema (`created_at`). */
  createdAt: string;
  /** Plan operativo — salida de patio. */
  plannedDepartureAt: string;
  /** Plan operativo — llegada al cliente. */
  plannedArrivalAt: string;
  /** Plan operativo — fin de maniobra. */
  plannedCompletionAt: string;
  operationType: TripOperationType;
  /** FK a configuración operativa viva (catálogo). */
  operationConfigurationId?: string;
  loadType: TripLoadType;
  containerType: TripContainerType;
  /** Qué transporta el contenedor (mercancía, producto, referencia del cliente). */
  cargoDescription?: string;
  /** Fecha y hora de carga (ISO 8601). */
  loadDate?: string;
  /** Lugar de carga (texto libre; catálogo por empresa). */
  loadPlace?: string;
  /** Entrega de vacío: fecha/hora ISO (≥ fin planeado y fin real). */
  emptyDeliveryAt?: string;
  /** Entrega de vacío: lugar (catálogo de lugares por empresa). */
  emptyDeliveryPlace?: string;
  /** Peso aproximado en toneladas (texto libre, ej. decimales). */
  approximateWeightTons: string;
  /** Nombres o códigos de equipo visibles en tabla (1 o hasta 2 si es full). */
  equipment: string[];
  /** Ids de catálogo de equipos en convoy (principal; secundario en full). */
  equipmentIds?: string[];
  /** Salida real (null si aún no aplica). */
  departureAt: string | null;
  /** Llegada a destino. */
  arrivedAt: string | null;
  /** Regreso / cierre de ruta. */
  returnAt: string | null;
  /** Crédito pactado en días. */
  creditDays: number;
  /**
   * `true` si hubo incidents o marcador histórico; conviene mantener activo cuando `incidents` no está vacío.
   */
  hasIncident: boolean;
  /** Lista de incidentes (orden recomendado: más reciente primero). */
  incidents?: TripIncident[];

  /** Distancia OSRM en km (solo ida). Km operativos = routeDistanceKm × 2. */
  routeDistanceKm?: number | null;
  /** «Local» / «Foránea» si se derivó del formulario de programación. */
  maneuverKind?: string;
  /** Tarifa de destino vinculada al crear (si hubo match). */
  destinationRateId?: string | null;
  /** Centro operativo de origen al programar (FK). */
  originOperationalCenterId?: string | null;
  /** CP de origen (5 dígitos) y desglose SEPOMex al programar. */
  originPostalCode?: string;
  /** Ciudad y/o municipio + estado (línea legible). */
  originCityMunicipality?: string;
  /** Asentamiento / colonia elegida. */
  originLocality?: string;
  /** CP de destino (5 dígitos). */
  destinationPostalCode?: string;
  destinationCityMunicipality?: string;
  destinationLocality?: string;
  /** Costos operativos y cobro (opcionales; mock / API pueden ir llenándolos). */
  dieselLiters?: string;
  dieselAmount?: string;
  casetasAmount?: string;
  operatorQuota?: string;
  /** Viáticos del operador; 0 u omitido = sin gasto automático. */
  perDiemAmount?: string;
  clientCharge?: string;
  paymentMethod?: TripClientPaymentMethod;
  requiresInvoice?: boolean;
  /** Nombres de archivos adjuntos (UI local; aún no hay storage persistente). */
  attachedDocumentFileNames?: string[];
  /**
   * `false` si se programó sin cliente/cobro (unidades propias).
   * Ausente o `true`: mostrar bloque de cliente y cobro.
   */
  hasClientBilling?: boolean;

  /**
   * El viaje **no** se ejecuta pero el cobro pactado sigue aplicando (maniobra «en falso»).
   * Solo tiene sentido con `status === 'cancelled'`.
   */
  falseManeuver?: boolean;
  /** Motivo o detalle al cancelar / marcar en falso (p. ej. auditoría frente al cliente). */
  cancellationNote?: string;
  /**
   * Fecha/hora ISO en que se confirmó el cobro al cliente.
   * Ausente o `null`: pendiente (cuenta por cobrar / crédito en reportes).
   */
  clientCollectedAt?: string | null;
}

/**
 * Estado operativo del operador.
 * Persistido en API: available | scheduled | in_use | leave | incapacitated.
 * `inactive` es solo display cuando `isActive === false` (no se persiste como status).
 */
export type OperatorOperationalStatus =
  | 'available'
  | 'in_use'
  | 'scheduled'
  | 'incapacitated'
  | 'leave'
  | 'inactive';

/** Periodicidad de pago al operador. */
export type OperatorPaymentSchedule = 'maneuver' | 'weekly' | 'biweekly' | 'monthly';

/** Tipo de licencia de conducir (referencia normativa). */
export type OperatorLicenseType =
  | 'federal'
  | 'state'
  | 'both'
  | 'unspecified';

/** Cobertura de salud / prestaciones: sin registro, IMSS (público) o seguro privado. */
export type OperatorInsuranceKind = 'none' | 'public' | 'private';

/** Prestaciones vía IMSS / seguridad social (mock; campos según lo que capture la empresa). */
export interface OperatorPublicInsurance {
  nss: string;
  /** Alta o referencia IMSS (ISO `YYYY-MM-DD`, opcional). */
  imssAltaDate: string;
  infonavit: boolean;
  /**
   * Número de crédito / cuenta Infonavit (opcional; conviene registrarlo si
   * `infonavit` es verdadero, pero no siempre existe en expediente).
   */
  infonavitCreditNumber: string;
  fonacot: boolean;
  /**
   * Número de crédito FONACOT u otro folio de referencia (opcional). Solo aplica
   * cuando hay crédito/descuento vía FONACOT; el trabajador puede no tenerlo a la mano.
   */
  fonacotCreditNumber: string;
  notes: string;
}

/** Seguro médico privado complementario o principal. */
export interface OperatorPrivateInsurance {
  carrier: string;
  policyNumber: string;
  validFrom: string;
  validTo: string;
  /** Prima (texto libre o monto en UI, ej. "1850 MXN"). */
  premiumAmount: string;
  premiumPeriod: '' | 'monthly' | 'annual' | 'other';
  deductibleNotes: string;
  planSummary: string;
}

/** Origen del adjunto en expediente del operador (mock: solo metadatos hasta backend). */
export type OperatorDocumentSlot = 'operation' | 'insurance';

/** Referencia a un archivo adjunto (sin binario persistido en mock). */
export interface OperatorAttachedDocument {
  id: string;
  fileName: string;
  slot: OperatorDocumentSlot;
  /** Fecha de registro (ISO `YYYY-MM-DD`). */
  addedAt: string;
}

/** Persona de contacto en emergencia o trámites. */
export interface OperatorEmergencyContact {
  name: string;
  /** Código de catálogo (cónyuge, padre/madre, etc.). */
  relationship: string;
  phone: string;
  email: string;
  /** Autorización expresa para compartir datos médicos con terceros (uso informativo en mock). */
  authorizedMedicalInfo: boolean;
}

/** Resumen de la maniobra más reciente (listado / cards). */
export interface OperatorLastManeuver {
  tripId?: string;
  maneuverCode: string;
  originCityMunicipality?: string;
  destinationCityMunicipality?: string;
  status?: TripStatus;
  occurredOn?: string;
}

export interface Operator {
  id: string;
  name: string;
  /** Foto del operador (`data:image/...` en mock; URL de storage en API). */
  photoDataUrl?: string;
  /** Nacimiento (ISO `YYYY-MM-DD`). */
  birthDate: string;
  curp: string;
  rfc: string;
  licenseNumber: string;
  /** Vencimiento de licencia (ISO `YYYY-MM-DD`). */
  licenseExpiresOn: string;
  licenseType: OperatorLicenseType;
  /** Endosos o restricciones anotadas en licencia. */
  licenseEndorsements: string;
  phone: string;
  phoneSecondary: string;
  address: string;
  /** Fecha de ingreso a la empresa (ISO `YYYY-MM-DD`); sirve para antigüedad. */
  companyHireDate: string;
  /**
   * Régimen de contratación (LFT y práctica interna; valor de catálogo en UI).
   * Ej. `indefinite`, `temporary`, `project`, `fees`, `other`.
   */
  employmentContractType: string;
  /** Periodicidad de pago al operador. */
  paymentSchedule: OperatorPaymentSchedule;
  /** Método de pago al operador (catálogo de gastos). */
  paymentMethod?: string;
  status: OperatorOperationalStatus;
  /** Soft delete lógico: inactivo = oculto en asignaciones operativas. */
  isActive?: boolean;
  emergencyContact: OperatorEmergencyContact;
  insuranceKind: OperatorInsuranceKind;
  publicInsurance: OperatorPublicInsurance;
  privateInsurance: OperatorPrivateInsurance;
  /**
   * Expediente digital (contrato, licencia, constancias IMSS, póliza, etc.).
   * `operation` = operación / contratación; `insurance` = cobertura y prestaciones.
   */
  documents: OperatorAttachedDocument[];
  /** Maniobras concluidas asignadas al operador (agregado del backend). */
  maneuverCount?: number;
  /** Última maniobra asignada (agregado del backend). */
  lastManeuver?: OperatorLastManeuver;
  /** Próximo vencimiento de pago (ISO `YYYY-MM-DD`). */
  nextPayDueOn?: string;
  nextPayDueVariant?: 'success' | 'warning' | 'danger';
  /** Saldo pendiente de pago al operador (agregado del backend). */
  owedAmount?: number;
}

/** Cómo está constituido el capital del remolque (alta / operación). */
export type TrailerTenureMode = 'owned' | 'financed' | 'leased' | 'managed';

/** Estado de una entrada de mantenimiento. */
export type MaintenanceEntryStatus = 'concluido';

/** Entrada individual del historial de verificaciones (físico-mecánica, emisiones, etc.). */
export interface VerificationEntry {
  /** Alcance de la verificación (p. ej. `phys_mech`, `emissions`, `double_articulated`). */
  scope: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  cost?: number;
  notes?: string;
  paymentMethod?: string;
  status?: string;
}

/** Entrada individual del historial de mantenimientos del remolque. */
export interface MaintenanceEntry {
  /** ISO `YYYY-MM-DD`. */
  date?: string;
  /** Etiqueta del catálogo (ej. "Servicio completo", "Reparación eléctrica"). */
  type?: string;
  /** Costo / precio / cantidad pagada por la entrada. */
  cost?: number;
  /** Observaciones libres (taller, refacciones, diagnóstico). */
  notes?: string;
  /** Código de método de pago (transfer, cash, …). */
  paymentMethod?: string;
  /** Nombres de archivos asociados a esta entrada. */
  documentNames?: string[];
  /** Si la entrada está programada (futuro) o concluida (pasado). */
  status?: MaintenanceEntryStatus;
}

/** Metadatos de alta / operación (mock; API puede mapear a columnas). */
export interface UnitFleetMeta {
  trailerBrandName?: string;
  trailerVersion?: string;
  trailerColor?: string;
  /** Modalidad de autotransporte federal de carga (RDAFYSA). */
  serviceModality?: string;
  /** Propio, financiado, arrendado o administrado. */
  trailerTenureMode?: TrailerTenureMode;
  /** Valor comercial estimado (modo propio). */
  trailerCommercialValue?: number;
  /** Monto de cada cuota (financiado) o renta (arrendado). */
  trailerRecurringPaymentAmount?: number;
  /** Fecha de referencia del pago (p. ej. próximo vencimiento o día pactado). */
  trailerRecurringPaymentDate?: string;
  /** Total de cuotas del crédito (financiado) o plazos / meses de contrato (arrendado). */
  trailerRecurringInstallmentCount?: number;
  /** Periodicidad de cuotas: monthly, quarterly, annual. */
  trailerRecurringPaymentCadence?: string;
  /** Fecha del último pago confirmado (para tracking de cuotas). */
  trailerRecurringLastPaymentDate?: string;
  /** Beneficiario de cuotas de financiamiento o arrendamiento. */
  trailerTenureBeneficiary?: string;
  /** Monto pagado al dueño por administración del activo. */
  trailerManagementOwnerPayout?: number;
  transmissionType?: string;
  transmissionSpeeds?: string;
  grossVehicleWeightLb?: string;
  /**
   * Kilometraje acumulado de la unidad (arranque + km de maniobras completadas).
   * Solo lectura en UI; lo actualiza el backend al completar maniobras.
   */
  odometerKm?: string;
  /**
   * Km acumulados desde el último mantenimiento para alertas por distancia.
   * Se reinicia al concluir un servicio; lo incrementa el backend al completar maniobras.
   */
  maintenanceKmCounter?: number | null;
  lastMaintenanceDate?: string;
  /**
   * Tipo de servicio realizado (catálogo): mantenimiento_general | servicio_general |
   * medio_servicio | reparacion_motriz | reparacion_electrica | reparacion_neumatica |
   * cambio_llantas | otro.
   */
  lastMaintenanceType?: string;
  /** Costo, precio o cantidad pagada por el último mantenimiento. */
  lastMaintenanceCost?: number;
  /** Observaciones libres (refacciones, taller, diagnóstico). */
  lastMaintenanceNotes?: string;
  /** Historial de mantenimientos (la entrada más reciente va primero al presentarse). */
  maintenanceEntries?: MaintenanceEntry[];
  tireCondition?: string;
  /**
   * @deprecated Control global en configuración operativa; usar `maintenanceKmCounter`.
   */
  maintenanceAlertByKm?: boolean;
  /**
   * @deprecated No se persiste desde el FE; el próximo mantenimiento se calcula en vivo
   * con la política de empresa (fecha o km).
   */
  maintenanceNextDateOverride?: string;
  /** Historial de verificaciones (físico-mecánica, emisiones, etc.). */
  verificationEntries?: VerificationEntry[];
  /**
   * @deprecated Intervalo definido en configuración operativa de la empresa.
   */
  maintenanceKmInterval?: number | null;
  /**
   * @deprecated Sustituido por `maintenanceKmCounter` + intervalo global.
   */
  maintenanceTripKmAtLastService?: number | null;
  /**
   * @deprecated Se calcula: intervalo global − `maintenanceKmCounter`.
   */
  maintenanceKmRemaining?: number | null;
  verificationPhysMechDate?: string;
  /** Costo, precio pagado o cantidad asociada a la última verificación (seguimiento). */
  verificationPhysMechCost?: number;
  verificationEmissionsDate?: string;
  verificationEmissionsCost?: number;
  verificationDoubleArticulatedApplies?: boolean;
  verificationDoubleArticulatedDate?: string;
  verificationDoubleArticulatedCost?: number;
  insurancePolicyNumber?: string;
  /** Aseguradora o nombre comercial del seguro (texto libre). */
  insuranceCarrierName?: string;
  insurancePaymentCadence?: string;
  insuranceContractDate?: string;
  /** Último pago de póliza registrado (ISO `YYYY-MM-DD`); ancla el próximo ciclo. */
  insuranceLastPaymentDate?: string;
  /** Código de forma de pago (transfer, cash, check…), alineado con gastos. */
  insurancePaymentMethod?: string;
  /** Si los cobros de la póliza requieren factura fiscal. */
  insuranceInvoiceRequired?: boolean;
  /** Costo, precio pagado o cantidad asociada al ciclo de seguro (seguimiento). */
  insuranceCost?: number;
  /**
   * `true` si hay rastreo GPS contratado; con `false` el resto de campos GPS se ignoran en UI.
   */
  hasGps?: boolean;
  /** Marca o proveedor del servicio / equipo GPS. */
  gpsProviderBrand?: string;
  /** Precio del equipo, instalación o cuota según corresponda. */
  gpsPrice?: number;
  /** Misma convención que seguro: semanal, mensual, trimestral, anual (value o etiqueta). */
  gpsPaymentCadence?: string;
  /** Fecha de contratación o inicio del servicio (ISO `YYYY-MM-DD`). */
  gpsContractDate?: string;
  /** Último pago del servicio GPS registrado (ISO `YYYY-MM-DD`). */
  gpsLastPaymentDate?: string;
  /** Código de forma de pago (transfer, cash, check…), alineado con gastos. */
  gpsPaymentMethod?: string;
  /** Si los cobros del GPS requieren factura fiscal. */
  gpsInvoiceRequired?: boolean;
  /** URL del portal del proveedor para ver ubicación en vivo. */
  gpsTrackingPortalUrl?: string;
  /**
   * Si el GPS consta como endoso o anexo en la póliza del remolque (cobertura o listado del activo).
   */
  gpsCoveredByInsuranceEndorsement?: boolean;
  /** Solo nombres de archivo en cliente hasta API de storage. */
  documentMaintenanceNames?: string[];
  documentVerificationNames?: string[];
  documentPolicyNames?: string[];
  /** Factura de compra, título de propiedad, NOM, endosos, etc. */
  documentOwnershipNames?: string[];
}

/**
 * Vanos / plazas ISO o chasis fijo (porte-contenedor, etc.).
 * Valores de catálogo en UI; en datos puede persistir la etiqueta legible.
 */
export type EquipmentContainerSlotConfigKey =
  | 'na'
  | 'fixed'
  | 'iso_20'
  | 'iso_40'
  | 'iso_45'
  | 'iso_20_20'
  | 'iso_20_40'
  | 'iso_20_45'
  | 'iso_20_40_45'
  | 'gooseneck'
  | 'ft_53'
  | 'ft_48'
  | 'ft_46'
  | 'ft_42'
  | 'ft_40';

/**
 * Metadatos de equipo (semirremolque / remolque): tenencia, técnico, seguro,
 * mantenimiento; documentos de propiedad en `documentOwnershipNames`.
 */
export interface EquipmentFleetMeta {
  trailerBrandName?: string;
  trailerVersion?: string;
  trailerColor?: string;
  trailerTenureMode?: TrailerTenureMode;
  trailerCommercialValue?: number;
  trailerRecurringPaymentAmount?: number;
  trailerRecurringPaymentDate?: string;
  trailerRecurringInstallmentCount?: number;
  trailerRecurringPaymentCadence?: string;
  trailerRecurringLastPaymentDate?: string;
  trailerTenureBeneficiary?: string;
  trailerManagementOwnerPayout?: number;
  /** Capacidad en toneladas (texto libre). */
  equipmentCapacityTons?: string;
  /** Número de ejes. */
  equipmentAxleCount?: number;
  /** Configuración de contenedor / plazas (etiqueta o value del catálogo). */
  equipmentContainerSlotConfig?: string;
  lastMaintenanceDate?: string;
  lastMaintenanceType?: string;
  lastMaintenanceCost?: number;
  lastMaintenanceNotes?: string;
  maintenanceEntries?: MaintenanceEntry[];
  tireCondition?: string;
  /**
   * Si es `true`, la alerta de próximo mantenimiento se basa en km recorridos.
   * Si es `false` o ausente, por tiempo / calendario.
   * En producción suelen leerse y persistirse vía API en el `fleetMeta` del equipo.
   */
  maintenanceAlertByKm?: boolean;
  /**
   * @deprecated No se persiste desde el FE; el próximo mantenimiento se calcula en vivo
   * con la política de empresa (fecha o km).
   */
  maintenanceNextDateOverride?: string;
  verificationEntries?: VerificationEntry[];
  maintenanceKmInterval?: number | null;
  maintenanceTripKmAtLastService?: number | null;
  maintenanceKmRemaining?: number | null;
  /** Última verificación físico-mecánica del remolque (ISO `YYYY-MM-DD`). */
  verificationPhysMechDate?: string;
  verificationPhysMechCost?: number;
  insurancePolicyNumber?: string;
  /** Aseguradora o nombre comercial del seguro (texto libre). */
  insuranceCarrierName?: string;
  insurancePaymentCadence?: string;
  insuranceContractDate?: string;
  insuranceLastPaymentDate?: string;
  insurancePaymentMethod?: string;
  insuranceInvoiceRequired?: boolean;
  insuranceCost?: number;
  documentMaintenanceNames?: string[];
  documentVerificationNames?: string[];
  documentPolicyNames?: string[];
  /** Factura de compra, título de propiedad, NOM-051, endosos, etc. */
  documentOwnershipNames?: string[];
}

export interface Unit {
  id: string;
  plate: string;
  /** Configuración del vehículo motriz: tractocamión, unitario, torton, etc. */
  transportType?: string;
  capacityKg: number;
  status: string;
  /** Soft delete lógico: inactivo = oculto en asignaciones operativas. */
  isActive?: boolean;
  /** Número de serie del chasis / VIN u otro identificador de fábrica. */
  serialNumber?: string;
  /** Número de motor (identificación del tren motriz). */
  motorNumber?: string;
  /** Capacidad de carga en toneladas métricas. */
  capacityTons?: number;
  /** Nombre comercial o alias interno (opcional). */
  name?: string;
  /** Marca del remolque (abreviatura operativa). */
  trailerBrandAbbr?: string;
  /** Año del remolque (modelo por año, no versión de equipo). */
  trailerYear?: string;
  fleetMeta?: UnitFleetMeta;
  /** Equipos enganchados (presente en listado/detalle de unidad desde API). */
  hitchedEquipment?: Equipment[];
}

/** Posición del remolque en el convoy enganchado a la tractora. */
export type EquipmentHitchPosition = 'lead' | 'rear';

export interface Equipment {
  id: string;
  unitId: string;
  /** Delantero (tracto) o trasero en configuración full; solo si hay `unitId`. */
  hitchPosition?: EquipmentHitchPosition | null;
  /** Etiqueta corta opcional (ej. dolly #1). */
  name: string;
  /** Número de serie o inventario del activo. */
  serialNumber: string;
  /** Fecha de último mantenimiento (derivada del historial; no se escribe en core). */
  lastServiceDate: string;
  /** Placa del remolque, si aplica. */
  plate?: string;
  /** Tipo operativo (caja seca, portacontenedor, plataforma…). */
  type?: string;
  /** Estado operativo (misma convención que unidad). */
  status?: string;
  /** Soft delete lógico: inactivo = oculto en asignaciones operativas. */
  isActive?: boolean;
  trailerBrandAbbr?: string;
  trailerYear?: string;
  fleetMeta?: EquipmentFleetMeta;
  /**
   * @deprecated Preferir `fleetMeta.equipmentAxleCount` y bloque técnico.
   */
  axleConfiguration?: string;
}

/** Clasificación de gasto para relaciones y reportes. */
export type ExpenseKind =
  | 'trip'
  | 'fuel'
  | 'tolls'
  | 'per_diem'
  | 'lodging'
  | 'repair'
  | 'tires'
  | 'maintenance'
  | 'insurance'
  | 'gps'
  | 'verification'
  | 'equipment_purchase'
  | 'unit_purchase'
  | 'equipment_rent'
  | 'unit_rent'
  | 'tenure_payment'
  | 'trailer_admin_payout'
  | 'operator_payment'
  | 'operator_commission'
  | 'operational_control'
  | 'service'
  | 'other';

export type ExpenseMaintenanceTarget = 'unit' | 'equipment';

export type ExpenseVerificationScope =
  | 'phys_mech'
  | 'emissions'
  | 'double_articulated';

export interface Expense {
  id: string;
  /**
   * Maniobra asociada (opcional, cualquier rubro). `trip.id` en sim-db;
   * cadena vacía si el gasto no está ligado a una maniobra.
   */
  tripId: string;
  /** Código de maniobra (`trip.maneuverCode`) cuando el gasto está ligado a una maniobra. */
  tripManeuverCode?: string;
  /**
   * Etiqueta legible del vínculo operativo (código de unidad/equipo o nombre de operador).
   * Denormalizado en API; la UI no debe cargar catálogos de flota solo para listado.
   */
  fleetRelationLabel?: string;
  /** Etiqueta legible de la unidad relacionada, si existe. */
  relatedUnitLabel?: string;
  /** Etiqueta legible del equipo relacionado, si existe. */
  relatedEquipmentLabel?: string;
  /** Etiqueta legible del operador relacionado, si existe. */
  relatedOperatorLabel?: string;
  /** Concepto o categoría contable legible (ej. Casetas, Póliza anual). */
  category: string;
  amount: number;
  currency: string;
  /** Fecha del gasto (ISO `YYYY-MM-DD` o con zona, según origen). */
  incurredAt: string;
  /** Fecha operativa canónica `YYYY-MM-DD` (zona México), cuando la expone el API. */
  incurredDate?: string;
  /**
   * Rubro operativo: determina qué campos de relación (`related*`) tienen sentido.
   * Mantenimiento/seguro: unidad o equipo vía related IDs.
   * Verificación: categoría canónica (estilo GPS).
   */
  kind: ExpenseKind;
  /** Detalle libre (taller, factura, cobertura, etc.). */
  description?: string;
  /** Proveedor, aseguradora, taller, plataforma GPS… */
  vendor?: string;
  /** Método de pago (valor del catálogo UI). */
  paymentMethod?: string;
  /** Derivado en API (compat): unit|equipment según related IDs. */
  maintenanceTarget?: ExpenseMaintenanceTarget;
  /** Derivado en API (compat): unit|equipment según related IDs. */
  insuranceTarget?: ExpenseMaintenanceTarget;
  /** Unidad tractora relacionada. */
  relatedUnitId?: string;
  /** Equipo/remolque relacionado. */
  relatedEquipmentId?: string;
  /** Operador relacionado (pagos y comisiones). */
  relatedOperatorId?: string;
  /** Derivado en API desde category (compat UI). */
  verificationScope?: ExpenseVerificationScope;
  /** Derivado: kind === operational_control (compat). */
  isOperationalProvision?: boolean;
  /** Si el gasto debe contar con factura fiscal. */
  invoiceRequired?: boolean;
  /** Fecha en que se pagó (ISO). null = pendiente de pago. */
  paidAt?: string | null;
}

/** Icono opcional junto al título en tarjetas KPI / gráficas. */
export type KpiTitleIcon =
  | 'maniobras'
  | 'units'
  | 'equipment'
  | 'operators'
  | 'revenue'
  | 'chart-line'
  | 'chart-bar'
  | 'chart-donut'
  | 'clients'
  | 'trophy'
  | 'route'
  | 'target'
  | 'payment'
  | 'wallet'
  | 'credit'
  | 'alert'
  | 'maintenance'
  | 'calendar';

/** Tipo de alerta (define el icono Material en UI). */
export type CriticalAlertKind =
  | 'cold_chain'
  | 'gps'
  | 'driver'
  | 'maintenance'
  | 'document'
  | 'schedule'
  | 'default';
