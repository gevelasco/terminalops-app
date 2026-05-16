import { MOCK_REPORT_ROWS } from '@app/mock-data/mock-reports';
import { buildCriticalAlertsFromTrips } from './utils/critical-alerts-from-trip-incidents';
import { mergeOperatorNested } from '@features/operators/utils/operator-payload-defaults';
import type { Client } from '@shared/models/client.models';
import type { Operator, Trip } from '@shared/models/logistics.models';
import { SIM_DB_CLIENTS } from './tables/clients.table';
import { SIM_DB_EQUIPMENT } from './tables/equipment.table';
import { SIM_DB_EXPENSES } from './tables/expenses.table';
import { SIM_DB_OPERATORS } from './tables/operators.table';
import { SIM_DB_TRIPS } from './tables/trips.table';
import { SIM_DB_UNITS } from './tables/units.table';
import type { SimulatedDatabaseTables, TripTableRow } from './sim-db.types';

/** Cliente sintético para maniobras sin expediente (misma etiqueta que el formulario de alta). */
const CLI_INTERNAL: Client = {
  id: 'cli-internal',
  name: 'Cliente general',
  relationshipStartedOn: '1900-01-01',
  notes: 'Registro interno demo: servicios sin cliente en expediente.',
  payment: { hasCredit: false, commercialHealth: 'not_evaluated' },
};

function cloneJson<T>(value: T): T {
  return structuredClone(value) as T;
}

function resolveClientId(clients: readonly Client[], trip: { clientName: string }): string {
  const row = clients.find((c) => c.name === trip.clientName);
  if (!row) {
    throw new Error(
      `[sim-db] Viaje "${trip.clientName}" no coincide con ningún cliente del catálogo.`,
    );
  }
  return row.id;
}

function normalizeTripTableRow(clients: readonly Client[], trip: Trip): TripTableRow {
  const resolved = resolveClientId(clients, trip);
  const raw = trip.clientId?.trim();
  let clientId = resolved;
  if (raw) {
    const byId = clients.find((c) => c.id === raw);
    if (!byId) {
      throw new Error(`[sim-db] Viaje ${trip.id}: clientId desconocido "${raw}".`);
    }
    if (byId.name !== trip.clientName) {
      throw new Error(
        `[sim-db] Viaje ${trip.id}: clientId "${raw}" (${byId.name}) no coincide con clientName "${trip.clientName}".`,
      );
    }
    clientId = raw;
  }
  const tripNorm: Trip = { ...trip, clientId };
  return { clientId, trip: tripNorm };
}

/**
 * Construye todas las tablas en memoria a partir de `sim-db/tables/*`
 * más catálogos de dashboard/reportes aún en `mock-data/`.
 */
export function buildSimulatedDatabase(): SimulatedDatabaseTables {
  const clients: Client[] = [CLI_INTERNAL, ...cloneJson(SIM_DB_CLIENTS)];
  const operators: Operator[] = cloneJson(SIM_DB_OPERATORS).map((o) =>
    mergeOperatorNested({ ...o }),
  );
  const units = cloneJson(SIM_DB_UNITS);
  const equipment = cloneJson(SIM_DB_EQUIPMENT);
  const tripRows: TripTableRow[] = cloneJson(SIM_DB_TRIPS).map((trip) =>
    normalizeTripTableRow(clients, trip),
  );
  const expenses = cloneJson(SIM_DB_EXPENSES);
  const criticalAlerts = buildCriticalAlertsFromTrips(
    tripRows.map((row) => row.trip),
  );
  const reportSummaryRows = cloneJson(MOCK_REPORT_ROWS);

  return {
    clients,
    operators,
    units,
    equipment,
    tripRows,
    expenses,
    criticalAlerts,
    reportSummaryRows,
  };
}
