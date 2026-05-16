import { Injectable } from '@angular/core';
import type { Client } from '@shared/models/client.models';
import type {
  Alert,
  CriticalAlert,
  Equipment,
  Expense,
  Operator,
  ReportSummaryRow,
  Trip,
  Unit,
} from '@shared/models/logistics.models';
import { buildSimulatedDatabase } from './sim-db.seed';
import type { TripTableRow } from './sim-db.types';
import { buildCriticalAlertsFromTrips } from './utils/critical-alerts-from-trip-incidents';
import { buildDashboardKpisFromTables } from './utils/dashboard-kpis-from-tables';
import { labelForEquipmentId as equipmentIdLabel } from './utils/equipment-label';
import { labelForUnitId as unitIdLabel } from './utils/unit-label';

/**
 * Base de datos simulada en memoria: una sola fuente de verdad para demos.
 * Los `Mock*Repository` delegan aquí; una API real reemplazaría estos métodos
 * por `HttpClient` manteniendo los mismos contratos de repositorio.
 */
@Injectable({ providedIn: 'root' })
export class SimulatedDbService {
  private clients: Client[];
  private operators: Operator[];
  private units: Unit[];
  private equipment: Equipment[];
  private tripRows: TripTableRow[];
  private expenses: Expense[];
  private criticalAlerts: CriticalAlert[];
  private reportSummaryRows: ReportSummaryRow[];

  constructor() {
    const seed = buildSimulatedDatabase();
    this.clients = seed.clients;
    this.operators = seed.operators;
    this.units = seed.units;
    this.equipment = seed.equipment;
    this.tripRows = seed.tripRows;
    this.expenses = seed.expenses;
    this.criticalAlerts = seed.criticalAlerts;
    this.reportSummaryRows = seed.reportSummaryRows;
  }

  /** Nombre de cliente → id (incluye `cli-internal` / «Cliente general»). */
  resolveClientIdByName(label: string): string {
    const t = label.trim();
    const row = this.clients.find((c) => c.name === t);
    if (!row) {
      return 'cli-internal';
    }
    return row.id;
  }

  private clientNameById(clientId: string): string | undefined {
    return this.clients.find((c) => c.id === clientId)?.name;
  }

  private hydrateTrip(row: TripTableRow): Trip {
    const name = this.clientNameById(row.clientId) ?? row.trip.clientName;
    return { ...row.trip, clientId: row.clientId, clientName: name };
  }

  listClients(): Client[] {
    return this.clients.map((c) => structuredClone(c));
  }

  getClient(id: string): Client | null {
    const row = this.clients.find((c) => c.id === id) ?? null;
    return row ? structuredClone(row) : null;
  }

  insertClient(client: Client): void {
    this.clients = [client, ...this.clients];
  }

  updateClient(client: Client): void {
    const idx = this.clients.findIndex((c) => c.id === client.id);
    if (idx < 0) {
      return;
    }
    const copy = [...this.clients];
    copy[idx] = structuredClone(client);
    this.clients = copy;
  }

  listOperators(): Operator[] {
    return this.operators.map((o) => structuredClone(o));
  }

  getOperator(id: string): Operator | null {
    const row = this.operators.find((o) => o.id === id) ?? null;
    return row ? structuredClone(row) : null;
  }

  insertOperator(operator: Operator): void {
    this.operators = [...this.operators, operator];
  }

  updateOperator(operator: Operator): void {
    const idx = this.operators.findIndex((o) => o.id === operator.id);
    const next = structuredClone(operator);
    if (idx >= 0) {
      const copy = [...this.operators];
      copy[idx] = next;
      this.operators = copy;
    }
  }

  listUnits(): Unit[] {
    return this.units.map((u) => structuredClone(u));
  }

  addUnit(unit: Unit): void {
    this.units = [...this.units, unit];
  }

  listEquipment(): Equipment[] {
    return this.equipment.map((e) => structuredClone(e));
  }

  addEquipment(row: Equipment): void {
    this.equipment = [...this.equipment, row];
  }

  /** Filas normalizadas (incluye `clientId`). */
  listTripTableRows(): TripTableRow[] {
    return this.tripRows.map((r) => ({
      clientId: r.clientId,
      trip: structuredClone(r.trip),
    }));
  }

  listTrips(): Trip[] {
    return this.tripRows.map((r) => structuredClone(this.hydrateTrip(r)));
  }

  getTrip(id: string): Trip | undefined {
    const row = this.tripRows.find((r) => r.trip.id === id);
    return row ? structuredClone(this.hydrateTrip(row)) : undefined;
  }

  prependTripRow(clientId: string, trip: Trip): void {
    const cid = (trip.clientId?.trim() || clientId).trim();
    const nextTrip = structuredClone({ ...trip, clientId: cid });
    this.tripRows = [{ clientId: cid, trip: nextTrip }, ...this.tripRows];
  }

  replaceTrip(tripId: string, trip: Trip): void {
    const i = this.tripRows.findIndex((r) => r.trip.id === tripId);
    if (i < 0) {
      return;
    }
    const prev = this.tripRows[i];
    const cid = (trip.clientId?.trim() || prev.clientId).trim();
    const next: TripTableRow = {
      clientId: cid,
      trip: structuredClone({ ...trip, clientId: cid }),
    };
    this.tripRows = [...this.tripRows.slice(0, i), next, ...this.tripRows.slice(i + 1)];
  }

  listExpenses(): Expense[] {
    return this.expenses.map((e) => structuredClone(e));
  }

  prependExpense(expense: Expense): void {
    this.expenses = [expense, ...this.expenses];
  }

  listAlerts(): Alert[] {
    return buildDashboardKpisFromTables({
      trips: this.listTrips(),
      units: this.units,
      equipment: this.equipment,
      expenses: this.expenses,
    });
  }

  listCriticalAlerts(): CriticalAlert[] {
    return buildCriticalAlertsFromTrips(this.listTrips());
  }

  listReportSummaryRows(): ReportSummaryRow[] {
    return this.reportSummaryRows.map((r) => structuredClone(r));
  }

  /** Etiqueta operativa de unidad usando el catálogo en memoria. */
  labelForUnitId(unitId: string): string {
    return unitIdLabel(unitId, this.units);
  }

  /** Etiqueta de equipo usando el catálogo en memoria. */
  labelForEquipmentId(equipmentId: string): string {
    return equipmentIdLabel(equipmentId, this.equipment);
  }
}
