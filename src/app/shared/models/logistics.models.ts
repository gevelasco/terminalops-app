export type TripStatus = 'scheduled' | 'in_transit' | 'completed' | 'cancelled';

/** Forma de cobro pactada al cliente en la maniobra. */
export type TripClientPaymentMethod =
  | 'cash'
  | 'transfer'
  | 'check'
  | 'debit_card'
  | 'credit_card';

/** Full suele llevar hasta 2 equipos; sencillo/plana típicamente uno. */
export type TripOperationType = 'sencillo' | 'full' | 'plana';

/** Carga del servicio (equipo vacío vs cargado). */
export type TripLoadType = 'vacio' | 'lleno';

/** Contenedor ISO / convención terrestre (N/A si no aplica). */
export type TripContainerType = '20ft' | '40ft' | '40hc' | 'na';

/** Prioridad operativa del incidente (alertas y notificaciones). */
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';

/** Incidente registrado durante una maniobra (descripción + momento). */
export interface TripIncident {
  id: string;
  description: string;
  /** Fecha y hora en que ocurrió (ISO). */
  occurredAt: string;
  /**
   * Usuario que registró el incidente: `portalUsername` del operador en ruta
   * o usuario de coordinación / monitoreo (ej. `gvelasco`, `jlopez`).
   */
  postedBy: string;
  /** Si no se indica, se infiere del estatus de la maniobra al generar alertas. */
  severity?: IncidentSeverity;
}

export interface Trip {
  id: string;
  /** Código operativo: iniciales del cliente + correlativo global (ej. FL-24103). */
  maneuverCode: string;
  origin: string;
  destination: string;
  /** Cliente o marca a la que pertenece el servicio. */
  clientName: string;
  /** Id de cliente en catálogo (FK); alineado con `TripTableRow.clientId` en sim-db. */
  clientId: string;
  unitId: string;
  operatorId: string;
  status: TripStatus;
  /** Momento en que la maniobra quedó registrada en el sistema (alta / programación del envío). */
  programmedAt: string;
  /** Ventana operativa prevista del servicio en ruta (distinta del momento de alta). */
  scheduledAt: string;
  operationType: TripOperationType;
  loadType: TripLoadType;
  containerType: TripContainerType;
  /** Qué transporta el contenedor (mercancía, producto, referencia del cliente). */
  cargoDescription?: string;
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

  /** Distancia OSRM en km si se calculó al programar (demo). */
  routeDistanceKm?: number | null;
  /** «Local» / «Foránea» si se derivó del formulario de programación. */
  maneuverKind?: string;
  /** CP de origen (5 dígitos) y desglose SEPOMex al programar. */
  originPostalCode?: string;
  /** Ciudad y/o municipio + estado (línea legible, snapshot). */
  originCityMunicipality?: string;
  /** Asentamiento / colonia elegida (snapshot). */
  originLocality?: string;
  /** CP de destino (5 dígitos). */
  destinationPostalCode?: string;
  destinationCityMunicipality?: string;
  destinationLocality?: string;
  /** Licencia del operador al momento de programar (snapshot). */
  operatorLicenseNumber?: string;
  operatorLicenseExpiresLabel?: string;
  /** Costos operativos y cobro (opcionales; mock / API pueden ir llenándolos). */
  dieselLiters?: string;
  dieselAmount?: string;
  casetasAmount?: string;
  operatorQuota?: string;
  clientCharge?: string;
  paymentMethod?: TripClientPaymentMethod;
  requiresInvoice?: boolean;
  /** Nombres de archivos adjuntos al programar. */
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

/** Estado operativo (misma lógica de catálogo que unidades en Flota + RRHH). */
export type OperatorOperationalStatus =
  | 'available'
  | 'in_use'
  | 'scheduled'
  | 'maintenance'
  | 'on_route'
  | 'incapacitated'
  | 'leave'
  | 'inactive';

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

export interface Operator {
  id: string;
  name: string;
  /**
   * Usuario de acceso a TerminalOps (app operador). Coincide con `postedBy`
   * cuando el operador reporta incidentes en carretera.
   */
  portalUsername?: string;
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
  status: OperatorOperationalStatus;
  emergencyContact: OperatorEmergencyContact;
  insuranceKind: OperatorInsuranceKind;
  publicInsurance: OperatorPublicInsurance;
  privateInsurance: OperatorPrivateInsurance;
  /**
   * Expediente digital (contrato, licencia, constancias IMSS, póliza, etc.).
   * `operation` = operación / contratación; `insurance` = cobertura y prestaciones.
   */
  documents: OperatorAttachedDocument[];
}

/** Cómo está constituido el capital del remolque (alta / operación). */
export type TrailerTenureMode = 'owned' | 'financed' | 'leased' | 'managed';

/** Estado de una entrada de mantenimiento. */
export type MaintenanceEntryStatus = 'programado' | 'concluido';

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
  /** Monto pagado al dueño por administración del activo. */
  trailerManagementOwnerPayout?: number;
  transmissionType?: string;
  transmissionSpeeds?: string;
  grossVehicleWeightLb?: string;
  odometerKm?: string;
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
   * Si es `true`, la alerta de próximo mantenimiento se basa en km recorridos.
   * Si es `false` o ausente, por tiempo / calendario (intervalo desde último servicio).
   * En producción suelen leerse y persistirse vía API en el `fleetMeta` de la unidad.
   */
  maintenanceAlertByKm?: boolean;
  /**
   * Próximo mantenimiento por calendario (ISO `YYYY-MM-DD`).
   * Si está definida, sustituye a «último servicio + 6 meses» en etiquetas y alertas por tiempo.
   */
  maintenanceNextDateOverride?: string;
  /**
   * Km entre servicios cuando la alerta es por km (`maintenanceAlertByKm`).
   * Los km recorridos en maniobras completadas se comparan contra `maintenanceTripKmAtLastService`.
   */
  maintenanceKmInterval?: number | null;
  /**
   * Suma de km de maniobras completadas registrada al último servicio o al programar el intervalo.
   */
  maintenanceTripKmAtLastService?: number | null;
  /**
   * Km estimados hasta el próximo mantenimiento (cuando `maintenanceAlertByKm`).
   * Ausente o `null`: se calcula con intervalo y km de maniobras si hay datos; si no, "—".
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
  insurancePaymentCadence?: string;
  insuranceContractDate?: string;
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
  | 'iso_40'
  | 'iso_20'
  | 'iso_20_20';

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
  trailerManagementOwnerPayout?: number;
  /** Capacidad en toneladas (texto libre). */
  equipmentCapacityTons?: string;
  /** Número de ejes. */
  equipmentAxleCount?: number;
  /** Configuración de contenedor / plazas (etiqueta o value del catálogo). */
  equipmentContainerSlotConfig?: string;
  /** Número de llantas del equipo (remolque / semirremolque). */
  equipmentTireCount?: number;
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
  /** Próximo mantenimiento por calendario (ISO `YYYY-MM-DD`); sustituye al ciclo sugerido si está definida. */
  maintenanceNextDateOverride?: string;
  maintenanceKmInterval?: number | null;
  maintenanceTripKmAtLastService?: number | null;
  maintenanceKmRemaining?: number | null;
  /** Última verificación físico-mecánica del remolque (ISO `YYYY-MM-DD`). */
  verificationPhysMechDate?: string;
  verificationPhysMechCost?: number;
  /**
   * Equipo operado por agencia: la verificación físico-mecánica no aplica por 2 años
   * desde `physMechTwoYearExemptStartDate` o, si falta, desde `Equipment.lastServiceDate`.
   */
  equipmentOperatedByAgency?: boolean;
  /** Inicio del período de exención de 2 años (físico-mecánica), ISO `YYYY-MM-DD`. */
  physMechTwoYearExemptStartDate?: string;
  insurancePolicyNumber?: string;
  insurancePaymentCadence?: string;
  insuranceContractDate?: string;
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
  type: string;
  capacityKg: number;
  status: string;
  /** Número de serie del chasis / VIN u otro identificador de fábrica. */
  serialNumber?: string;
  /** Nombre comercial o alias interno (opcional). */
  name?: string;
  /** Marca del remolque (abreviatura operativa). */
  trailerBrandAbbr?: string;
  /** Año del remolque (modelo por año, no versión de equipo). */
  trailerYear?: string;
  fleetMeta?: UnitFleetMeta;
}

export interface Equipment {
  id: string;
  unitId: string;
  /** Etiqueta corta opcional (ej. dolly #1). */
  name: string;
  /** Número de serie o inventario del activo. */
  serialNumber: string;
  /** Fecha de último mantenimiento o servicio (ISO `YYYY-MM-DD`). */
  lastServiceDate: string;
  /** Placa del remolque, si aplica. */
  plate?: string;
  /** Tipo operativo (caja seca, portacontenedor, plataforma…). */
  type?: string;
  /** Estado operativo (misma convención que unidad). */
  status?: string;
  trailerBrandAbbr?: string;
  trailerYear?: string;
  fleetMeta?: EquipmentFleetMeta;
  /**
   * Solo UI (drawer de detalle en Flota): suma de km en maniobras completadas
   * del tractor (`unitId`). La página de flota lo inyecta al abrir el panel; no persistir en API.
   */
  uiTractorCompletedTripDistanceKm?: number | null;
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
  | 'trailer_admin_payout'
  | 'operator_payment'
  | 'operator_commission'
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
  /** Concepto o categoría contable legible (ej. Casetas, Póliza anual). */
  category: string;
  amount: number;
  currency: string;
  /** Fecha del gasto (ISO `YYYY-MM-DD` o con zona, según origen). */
  incurredAt: string;
  /**
   * Rubro operativo: determina qué campos de relación (`related*`) tienen sentido.
   * Mantenimiento exige `maintenanceTarget` + unidad o equipo.
   */
  kind: ExpenseKind;
  /** Detalle libre (taller, factura, cobertura, etc.). */
  description?: string;
  /** Proveedor, aseguradora, taller, plataforma GPS… */
  vendor?: string;
  /** Método de pago (valor del catálogo UI). */
  paymentMethod?: string;
  /** Solo si `kind === 'maintenance'`. */
  maintenanceTarget?: ExpenseMaintenanceTarget;
  /**
   * Solo `kind === 'insurance'`: póliza de unidad o de equipo (exclusivo).
   */
  insuranceTarget?: ExpenseMaintenanceTarget;
  /** Unidad tractora relacionada. */
  relatedUnitId?: string;
  /** Equipo/remolque relacionado. */
  relatedEquipmentId?: string;
  /** Operador relacionado (pagos y comisiones). */
  relatedOperatorId?: string;
  /** Solo si `kind === 'verification'`. */
  verificationScope?: ExpenseVerificationScope;
  /** Si es reserva estimada por maniobra (provisión operativa), no un pago real. */
  isOperationalProvision?: boolean;
  /** Si el gasto debe contar con factura fiscal. */
  invoiceRequired?: boolean;
}

export type AlertSeverity = 'success' | 'warning' | 'danger' | 'neutral';

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

export interface Alert {
  id: string;
  severity: AlertSeverity;
  message: string;
  createdAt: string;
  /** Título de tarjeta / KPI */
  title?: string;
  /** Texto secundario (delta, leyenda, estado) junto al mensaje principal */
  legend?: string;
  /** Icono en la etiqueta superior del KPI */
  titleIcon?: KpiTitleIcon;
}

/** Alerta operativa para tabla del dashboard (prioridad alta). */
export type CriticalSeverity = IncidentSeverity;

/** Tipo de alerta (define el icono Material en UI). */
export type CriticalAlertKind =
  | 'cold_chain'
  | 'gps'
  | 'driver'
  | 'maintenance'
  | 'document'
  | 'schedule'
  | 'default';

export interface CriticalAlert {
  id: string;
  severity: CriticalSeverity;
  kind: CriticalAlertKind;
  title: string;
  /** Línea combinada (maniobra · cliente · ruta · autor) para listados compactos. */
  description: string;
  maneuverCode: string;
  clientName: string;
  routeLabel: string;
  authorLabel: string;
  detectedAt: string;
}
