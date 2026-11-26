/** Persona de contacto en el expediente del cliente. */
export interface ClientContactPerson {
  id: string;
  name: string;
  /** Cargo o área (ej. Cuentas por pagar). */
  role?: string;
  phone?: string;
  email?: string;
}

/** Datos para facturación electrónica y cobro fiscal. */
export interface ClientBilling {
  /** Razón social tal como debe ir en factura (si difiere del nombre corto). */
  invoiceLegalName?: string;
  /** Régimen fiscal (código o etiqueta corta; catálogo SAT en producción). */
  taxRegime?: string;
  /** Código postal del domicilio fiscal. */
  fiscalZip?: string;
  /** Uso de CFDI habitual (ej. G03). */
  cfdiUse?: string;
  billingEmail?: string;
  billingPhone?: string;
}

/** Slot de adjunto en expediente del cliente. */
export type ClientDocumentSlot = 'fiscal';

/** Referencia a un archivo adjunto (constancia fiscal, CSF, etc.). */
export interface ClientAttachedDocument {
  id: string;
  fileName: string;
  slot: ClientDocumentSlot;
  /** Fecha de registro (ISO `YYYY-MM-DD`). */
  addedAt: string;
  /** True when the binary exists in object storage (downloadable). */
  hasStoredFile?: boolean;
}

/**
 * Condición comercial de cobro. Se deriva en UI desde maniobras y cartera;
 * `watch_list` es el valor inicial al registrar un cliente nuevo.
 */
export type ClientCommercialHealth =
  | 'not_evaluated'
  | 'good_standing'
  | 'due_soon'
  | 'watch_list'
  | 'restricted';

export interface ClientPaymentTerms {
  hasCredit: boolean;
  /** Días de crédito pactados (solo si `hasCredit`). */
  creditDays?: number;
  /** Límite o volumen de crédito para alertas (texto libre, ej. "2.5 MMXN"). */
  approximateCreditAmount?: string;
  /** Método de pago preferido para maniobras (`cash`, `transfer`, `check`). */
  defaultPaymentMethod?: string;
}

/** Ubicación de entrega / ruta de tarifa del cliente (varias por expediente). */
export interface ClientDelivery {
  /** Id local o de API para filas de tabla; no se envía en writes. */
  id?: string;
  postalCode?: string;
  cityMunicipality?: string;
  locality?: string;
  settlementConsId?: string;
  latitude?: number;
  longitude?: number;
  /** Tarifa operativa vinculada (ruta origen→destino) de la misma company. */
  destinationRateId?: string;
  /**
   * Derivado (API): destino capturado sin tarifa configurada.
   * No se persiste; no enviar en writes.
   */
  isUnpricedRoute?: boolean;
}

export interface Client {
  id: string;
  /**
   * Razón social o nombre comercial (snapshot en `Trip.clientName`; FK en `Trip.clientId`).
   */
  name: string;
  rfc?: string;
  /**
   * Inicio de la relación comercial («fecha de sociedad» / alta como cliente).
   * ISO `YYYY-MM-DD`.
   */
  relationshipStartedOn?: string;
  notes?: string;
  billing?: ClientBilling;
  /** Ubicaciones de entrega / rutas de tarifa. */
  deliveries?: ClientDelivery[];
  contacts?: ClientContactPerson[];
  /** Adjuntos de datos fiscales / facturación. */
  documents?: ClientAttachedDocument[];
  payment?: ClientPaymentTerms;
  /** Total de maniobras vinculadas por `clientId` (solo en listado). */
  maneuverCount?: number;
  /** Estatus comercial derivado por el backend desde trips (tenant-scoped). */
  commercialHealth?: ClientCommercialHealth;
  /**
   * Baja lógica (solo vía DELETE admin). Inactivo = oculto en Comercial.
   * Sin reactivación: alta nueva. Historial conserva `clientId` / `clientName`.
   */
  isActive?: boolean;
}

export type CreateClientPayload = Omit<Client, 'id'>;
