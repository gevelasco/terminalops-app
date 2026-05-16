import type { Client } from '@shared/models/client.models';
import type {
  CriticalAlert,
  Equipment,
  Expense,
  Operator,
  ReportSummaryRow,
  Trip,
  Unit,
} from '@shared/models/logistics.models';

/**
 * Esquema lógico de la BD demo (solo lectura pensada para API; hoy en memoria).
 *
 * Relaciones principales:
 * - `trips.client_id` → `clients.id` (`Trip.clientId` FK; `Trip.clientName` es snapshot de UI).
 * - `trips.unit_id` → `units.id`
 * - `trips.operator_id` → `operators.id`
 * - `equipment.unit_id` → `units.id`
 * - `expenses.trip_id` → `trips.id` (vacío si no aplica)
 * - `expenses.related_unit_id` → `units.id` (mantenimiento / verificación)
 * - `expenses.related_equipment_id` → `equipment.id` (seguros, etc.)
 *
 * Las tarjetas KPI del dashboard se derivan al vuelo de `trips`, `units`,
 * `equipment` y `expenses` (equivalente a un agregado de API).
 */
export interface TripTableRow {
  readonly clientId: string;
  trip: Trip;
}

export interface SimulatedDatabaseTables {
  clients: Client[];
  operators: Operator[];
  units: Unit[];
  equipment: Equipment[];
  tripRows: TripTableRow[];
  expenses: Expense[];
  criticalAlerts: CriticalAlert[];
  reportSummaryRows: ReportSummaryRow[];
}
