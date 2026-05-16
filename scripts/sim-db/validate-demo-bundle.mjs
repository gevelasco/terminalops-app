#!/usr/bin/env node
/**
 * Valida un bundle JSON de demo contra las mismas relaciones que `sim-db.seed`.
 * Pensado para cuando exportes datos desde la API o desde SQL → JSON.
 *
 * Uso:
 *   node scripts/sim-db/validate-demo-bundle.mjs ./fixtures/demo-bundle.json
 *
 * Formato esperado del JSON:
 *   { "clients": [...], "operators": [...], "units": [...], "equipment": [...],
 *     "trips": [...], "expenses": [...] }
 *
 * Comprueba: trips.clientName ∈ clients.name, trips.unitId ∈ units.id,
 * trips.operatorId ∈ operators.id, equipment.unitId ∈ units.id,
 * expenses.tripId vacío o ∈ trips.id, expenses.relatedUnitId / relatedEquipmentId.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function fail(msg) {
  console.error(`[sim-db:validate] ${msg}`);
  process.exit(1);
}

function main() {
  const pathArg = process.argv[2];
  if (!pathArg) {
    console.log(
      'sim-db: pasa la ruta a un JSON de bundle, p. ej. node scripts/sim-db/validate-demo-bundle.mjs ./demo.json',
    );
    process.exit(0);
  }
  const abs = resolve(process.cwd(), pathArg);
  if (!existsSync(abs)) {
    fail(`No existe el archivo: ${abs}`);
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e) {
    fail(`JSON inválido: ${e instanceof Error ? e.message : String(e)}`);
  }
  const clients = raw.clients;
  const operators = raw.operators;
  const units = raw.units;
  const equipment = raw.equipment;
  const trips = raw.trips;
  const expenses = raw.expenses;
  if (!Array.isArray(clients)) {
    fail('Falta array "clients"');
  }
  if (!Array.isArray(operators)) {
    fail('Falta array "operators"');
  }
  if (!Array.isArray(units)) {
    fail('Falta array "units"');
  }
  if (!Array.isArray(equipment)) {
    fail('Falta array "equipment"');
  }
  if (!Array.isArray(trips)) {
    fail('Falta array "trips"');
  }
  if (!Array.isArray(expenses)) {
    fail('Falta array "expenses"');
  }

  const clientNames = new Set(clients.map((c) => String(c.name ?? '').trim()).filter(Boolean));
  const operatorIds = new Set(operators.map((o) => String(o.id ?? '').trim()).filter(Boolean));
  const unitIds = new Set(units.map((u) => String(u.id ?? '').trim()).filter(Boolean));
  const equipmentIds = new Set(equipment.map((e) => String(e.id ?? '').trim()).filter(Boolean));
  const tripIds = new Set(trips.map((t) => String(t.id ?? '').trim()).filter(Boolean));

  for (let i = 0; i < trips.length; i++) {
    const t = trips[i];
    const cn = String(t.clientName ?? '').trim();
    if (cn && !clientNames.has(cn)) {
      fail(`trips[${i}].clientName "${cn}" no está en clients[].name`);
    }
    const uid = String(t.unitId ?? '').trim();
    if (uid && !unitIds.has(uid)) {
      fail(`trips[${i}].unitId "${uid}" no está en units[].id`);
    }
    const oid = String(t.operatorId ?? '').trim();
    if (oid && !operatorIds.has(oid)) {
      fail(`trips[${i}].operatorId "${oid}" no está en operators[].id`);
    }
  }

  for (let i = 0; i < equipment.length; i++) {
    const e = equipment[i];
    const uid = String(e.unitId ?? '').trim();
    if (uid && !unitIds.has(uid)) {
      fail(`equipment[${i}].unitId "${uid}" no está en units[].id`);
    }
  }

  for (let i = 0; i < expenses.length; i++) {
    const ex = expenses[i];
    const tid = String(ex.tripId ?? '').trim();
    if (tid && !tripIds.has(tid)) {
      fail(`expenses[${i}].tripId "${tid}" no está en trips[].id`);
    }
    const ru = String(ex.relatedUnitId ?? '').trim();
    if (ru && !unitIds.has(ru)) {
      fail(`expenses[${i}].relatedUnitId "${ru}" no está en units[].id`);
    }
    const re = String(ex.relatedEquipmentId ?? '').trim();
    if (re && !equipmentIds.has(re)) {
      fail(`expenses[${i}].relatedEquipmentId "${re}" no está en equipment[].id`);
    }
  }

  console.log(`[sim-db:validate] OK — ${trips.length} viajes, ${expenses.length} gastos.`);
}

main();
