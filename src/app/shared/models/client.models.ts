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

/**
 * Condición comercial de cobro. `commercialHealth` será alimentado por
 * reglas de negocio (puntualidad de pago, antigüedad de cartera, etc.).
 */
export type ClientCommercialHealth =
  | 'not_evaluated'
  | 'good_standing'
  | 'watch_list'
  | 'restricted';

export interface ClientPaymentTerms {
  hasCredit: boolean;
  /** Días de crédito pactados (solo si `hasCredit`). */
  creditDays?: number;
  /** Límite o volumen de crédito aproximado (texto libre, ej. "2.5 MMXN"). */
  approximateCreditAmount?: string;
  commercialHealth: ClientCommercialHealth;
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
  contacts?: ClientContactPerson[];
  payment?: ClientPaymentTerms;
}

export type CreateClientPayload = Omit<Client, 'id'>;
