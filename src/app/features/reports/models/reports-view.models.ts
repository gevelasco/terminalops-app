import type { TripClientPaymentMethod } from '@shared/models/logistics.models';

export type ReportsTabId = 'balance' | 'maniobras' | 'fleet';

export type ReportsPeriodPreset =
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'semester'
  | 'year';

/** Forma de cobro pactada al cliente en la maniobra (`Trip.paymentMethod`). */
export type ReportsTripPaymentMethod = TripClientPaymentMethod;

export interface ReportsFilter {
  /** Mes calendario 1–12. */
  periodMonth: number;
  periodYear: number;
  from: string;
  to: string;
  /** Vacío = todos los clientes. */
  clientIds: string[];
  /** Vacío = efectivo y transferencia. */
  clientPaymentMethods: ReportsTripPaymentMethod[];
}

/** Usado por clientes / crédito por cobrar (fuera del módulo de reportes). */
export type ReportsCreditDueBadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

export interface ReportsCreditByClientRow {
  key: string;
  label: string;
  amount: number;
  pct: number;
  fillClass: string;
  nextDueLabel: string;
  nextDueBadgeVariant: ReportsCreditDueBadgeVariant;
}

export interface ReportsBarSlice {
  key: string;
  label: string;
  count: number;
  pct: number;
  fillClass: string;
}
