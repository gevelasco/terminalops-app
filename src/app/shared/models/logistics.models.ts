export type TripStatus = 'scheduled' | 'in_transit' | 'completed' | 'cancelled';

/** Full suele llevar hasta 2 equipos; sencillo/plana típicamente uno. */
export type TripOperationType = 'sencillo' | 'full' | 'plana';

/** Carga del servicio (equipo vacío vs cargado). */
export type TripLoadType = 'vacio' | 'lleno';

/** Contenedor ISO / convención terrestre (N/A si no aplica). */
export type TripContainerType = '20ft' | '40ft' | '40hc' | 'na';

/** Incidente registrado durante una maniobra (descripción + momento). */
export interface TripIncident {
  id: string;
  description: string;
  /** Fecha y hora en que ocurrió (ISO). */
  occurredAt: string;
}

export interface Trip {
  id: string;
  /** Código operativo: iniciales del cliente + correlativo global (ej. FL-24103). */
  maneuverCode: string;
  origin: string;
  destination: string;
  /** Cliente o marca a la que pertenece el servicio. */
  clientName: string;
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
  /** Peso aproximado en toneladas (texto libre, ej. decimales). */
  approximateWeightTons: string;
  /** Nombres o códigos de equipo visibles en tabla (1 o hasta 2 si es full). */
  equipment: string[];
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
  /** Costos operativos y cobro (opcionales; mock / API pueden ir llenándolos). */
  dieselLiters?: string;
  dieselAmount?: string;
  casetasAmount?: string;
  operatorQuota?: string;
  clientCharge?: string;
  paymentMethod?: 'cash' | 'transfer' | 'check';
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
}

export interface Operator {
  id: string;
  name: string;
  licenseNumber: string;
  phone: string;
  status: 'active' | 'inactive';
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
  /** Solo nombres de archivo en cliente hasta API de storage. */
  documentMaintenanceNames?: string[];
  documentVerificationNames?: string[];
  documentPolicyNames?: string[];
}

export interface Unit {
  id: string;
  plate: string;
  type: string;
  capacityKg: number;
  status: string;
  /** Marca del remolque (abreviatura operativa). */
  trailerBrandAbbr?: string;
  /** Año del remolque (modelo por año, no versión de equipo). */
  trailerYear?: string;
  fleetMeta?: UnitFleetMeta;
}

export interface Equipment {
  id: string;
  unitId: string;
  name: string;
  serialNumber: string;
  lastServiceDate: string;
  /** Ejes (plataforma, full, dolly, etc.); opcional. */
  axleConfiguration?: string;
}

export interface Expense {
  id: string;
  tripId: string;
  category: string;
  amount: number;
  currency: string;
  incurredAt: string;
}

export type AlertSeverity = 'success' | 'warning' | 'danger' | 'neutral';

/** Icono opcional junto al título en tarjetas KPI (dashboard). */
export type KpiTitleIcon = 'maniobras' | 'units' | 'equipment' | 'revenue';

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
export type CriticalSeverity = 'critical' | 'high' | 'medium';

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
  description: string;
  detectedAt: string;
}

export interface ReportSummaryRow {
  id: string;
  metric: string;
  period: string;
  value: string;
}
