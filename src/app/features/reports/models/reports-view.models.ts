import type { KpiTitleIcon, TripStatus } from '@shared/models/logistics.models';

export type ReportsTabId =
  | 'general'
  | 'maniobras'
  | 'balance'
  | 'fleet';

export type ReportsPeriodPreset =
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'semester'
  | 'year';

/** Filtro por forma de cobro pactada al cliente en la maniobra (`Trip.paymentMethod`). */
export type ReportsClientPaymentMethodFilter = 'both' | 'cash' | 'transfer';

export interface ReportsFilter {
  preset: ReportsPeriodPreset;
  from: string;
  to: string;
  /** Incluye efectivo, transferencia y cheque; al filtrar por efectivo o transferencia solo coinciden esos valores explícitos. */
  clientPaymentMethod: ReportsClientPaymentMethodFilter;
  clientIds: string[];
  unitId: string;
}

export type ReportsDeltaTone = 'up' | 'down' | 'neutral';

export type ReportsKpiLegendPlacement = 'below' | 'beside';

export interface ReportsKpiCard {
  id: string;
  title: string;
  titleIcon?: KpiTitleIcon;
  value: string;
  legend?: string;
  /** `beside`: leyenda a la derecha del monto (p. ej. Crédito). */
  legendPlacement?: ReportsKpiLegendPlacement;
  deltaLabel?: string;
  deltaTone?: ReportsDeltaTone;
}

export interface ReportsBarSlice {
  key: string;
  label: string;
  count: number;
  pct: number;
  fillClass: string;
}

export interface ReportsWeeklyPoint {
  label: string;
  value: number;
}

export interface ReportsDonutSlice {
  key: string;
  label: string;
  value: number;
  pct: number;
  color: string;
}

export interface ReportsClientRow {
  clientName: string;
  maneuvers: number;
  km: number;
  revenue: number;
  /** Participación del cliente en ingresos del periodo (0–100). */
  revenuePct: number;
}

export interface ReportsUnitRow {
  unitLabel: string;
  maneuvers: number;
  km: number;
  revenue: number;
  expenses: number;
}

export interface ReportsManeuverRow {
  id: string;
  code: string;
  route: string;
  client: string;
  unit: string;
  status: TripStatus;
  km: number;
  revenue: number;
  diesel: number;
  casetas: number;
}

export interface ReportsExpenseKindRow {
  kindLabel: string;
  amount: number;
  pct: number;
}

export interface ReportsMaintenanceRow {
  date: string;
  target: string;
  unitOrEquipment: string;
  amount: number;
  description: string;
}

export interface ReportsGeneralTabView {
  kpis: ReportsKpiCard[];
  weeklyBalance: ReportsWeeklyPoint[];
  expenseByKind: ReportsBarSlice[];
  topClients: ReportsClientRow[];
  topClientsMarginDonut: ReportsDonutSlice[];
}

export interface ReportsDestinationPerformanceRow {
  key: string;
  label: string;
  maneuvers: number;
  revenue: number;
  cost: number;
  margin: number;
}

export interface ReportsManiobraByOperatorRow {
  key: string;
  label: string;
  maneuverCount: number;
  avgDurationLabel: string;
}

export interface ReportsManiobrasTabView {
  kpis: ReportsKpiCard[];
  destinationSlices: ReportsBarSlice[];
  clientSlices: ReportsBarSlice[];
  operationDonut: ReportsDonutSlice[];
  maneuversByOperator: ReportsManiobraByOperatorRow[];
  destinationPerformance: ReportsDestinationPerformanceRow[];
  incidentsByRoute: ReportsBarSlice[];
}

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

export interface ReportsBalanceTabView {
  kpis: ReportsKpiCard[];
  collectionPaymentDonut: ReportsDonutSlice[];
  costBreakdown: ReportsBarSlice[];
  expenseByCategoryDonut: ReportsDonutSlice[];
  fleetPayables: ReportsBarSlice[];
  creditByClient: ReportsCreditByClientRow[];
  routeClientProfitability: ReportsRouteClientProfitRow[];
}

export interface ReportsFleetActivityBarRow {
  key: string;
  label: string;
  km: number;
  maneuvers: number;
  pct: number;
  fillClass: string;
}

export interface ReportsFleetIncidentBarRow {
  key: string;
  label: string;
  routes: string;
  count: number;
  pct: number;
  fillClass: string;
}

/** Unidad o equipo con mantenimiento registrado en el periodo filtrado. */
export interface ReportsFleetMaintServicedRow {
  key: string;
  label: string;
  targetLabel: 'Unidad' | 'Equipo';
  /** Fechas de servicio en el periodo (legible). */
  serviceDatesLabel: string;
  periodSpend: number;
  periodServices: number;
}

export interface ReportsFleetMaintCompletedRow {
  key: string;
  assetId: string;
  assetLabel: string;
  targetLabel: string;
  targetKind: 'unit' | 'equipment';
  date: string;
  dateLabel: string;
  typeLabel: string;
  amount: number;
  notes: string;
  sourceLabel: string;
  vendor: string;
  documentCount: number;
}

/** Conteo de registros de mantenimiento en el periodo por tipo de activo. */
export interface ReportsFleetMaintTargetCountRow {
  key: string;
  label: 'Unidades' | 'Equipos';
  count: number;
  color: string;
}

export interface ReportsFleetOperatorPayRow {
  key: string;
  label: string;
  paidAmount: number;
  /** Saldo por maniobras completadas aún no liquidadas. */
  pendingCompletedAmount: number;
  /** Cuota estimada de maniobras en curso o programadas. */
  pendingInTransitAmount: number;
  /** Fecha o contexto del próximo pago / viaje en curso. */
  pendingDueLabel: string;
}

export interface ReportsFleetTabView {
  kpis: ReportsKpiCard[];
  topUnitsByActivity: ReportsFleetActivityBarRow[];
  operationDonut: ReportsDonutSlice[];
  topEquipmentByActivity: ReportsFleetActivityBarRow[];
  unitsWithIncidents: ReportsFleetIncidentBarRow[];
  maintenanceServicedInPeriod: ReportsFleetMaintServicedRow[];
  maintenanceByTargetDonut: ReportsDonutSlice[];
  maintenanceTargetCounts: ReportsFleetMaintTargetCountRow[];
  operatorPayments: ReportsFleetOperatorPayRow[];
  avgManeuversPerUnit: number;
  unitsWithManeuversInPeriod: number;
  maneuversPerUnit: ReportsBarSlice[];
}

export interface ReportsMaintenanceTabView {
  kpis: ReportsKpiCard[];
  spendByMonth: ReportsWeeklyPoint[];
  byTarget: ReportsBarSlice[];
  table: ReportsMaintenanceRow[];
}

export interface ReportsRouteClientProfitRow {
  key: string;
  client: string;
  route: string;
  maneuvers: number;
  volumeTons: number;
  km: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
}

