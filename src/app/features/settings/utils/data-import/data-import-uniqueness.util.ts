import type { CreateClientPayload } from '@shared/models/client.models';
import type { CreateEquipmentPayload, CreateUnitPayload } from '@shared/models/api/api-fleet.model';
import type { Operator } from '@shared/models/logistics.models';
import type { DataImportCatalogSnapshot } from './data-import-catalog.types';
import type { DataImportEntityKind, DataImportPreparedRow } from './data-import.types';

export function normIdKey(raw: string | undefined | null): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function normNameKey(raw: string | undefined | null): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

type UniqueProbe = { label: string; key: string };

function pushProbe(out: UniqueProbe[], label: string, raw: string | undefined): void {
  const key = normIdKey(raw);
  if (key) {
    out.push({ label, key });
  }
}

function probesForRow(row: DataImportPreparedRow): UniqueProbe[] {
  const out: UniqueProbe[] = [];
  switch (row.kind) {
    case 'clients': {
      const p = row.payload as CreateClientPayload;
      pushProbe(out, 'RFC', p.rfc);
      break;
    }
    case 'operators': {
      const p = row.payload as Omit<Operator, 'id'>;
      pushProbe(out, 'número de licencia', p.licenseNumber);
      break;
    }
    case 'units': {
      const p = row.payload as CreateUnitPayload;
      pushProbe(out, 'placa', p.plate);
      pushProbe(out, 'número de serie', p.serialNumber);
      pushProbe(out, 'número de motor', p.motorNumber);
      break;
    }
    case 'equipment': {
      const p = row.payload as CreateEquipmentPayload;
      pushProbe(out, 'placa', p.plate);
      pushProbe(out, 'número de serie', p.serialNumber);
      break;
    }
  }
  return out;
}

function catalogHits(
  kind: DataImportEntityKind,
  probe: UniqueProbe,
  catalog: DataImportCatalogSnapshot,
): boolean {
  const { label, key } = probe;
  switch (kind) {
    case 'clients':
      if (label === 'RFC') {
        return catalog.clientRfcs.has(key);
      }
      return false;
    case 'operators':
      if (label === 'número de licencia') {
        return catalog.operatorLicenses.has(key);
      }
      return false;
    case 'units':
      if (label === 'placa') {
        return catalog.allPlates.has(key);
      }
      if (label === 'número de serie') {
        return catalog.allSerials.has(key);
      }
      if (label === 'número de motor') {
        return catalog.unitMotors.has(key);
      }
      return false;
    case 'equipment':
      if (label === 'placa') {
        return catalog.allPlates.has(key);
      }
      if (label === 'número de serie') {
        return catalog.allSerials.has(key);
      }
      return false;
  }
}

function duplicateMessage(
  label: string,
  scope: 'archivo' | 'empresa',
  otherRows?: number[],
): string {
  if (scope === 'archivo' && otherRows?.length) {
    const refs = otherRows.map((n) => `fila ${n}`).join(', ');
    return `${label} duplicado en el archivo (${refs}).`;
  }
  if (scope === 'empresa') {
    return `${label} ya está registrado en la base de datos de la empresa.`;
  }
  return `${label} duplicado.`;
}

/**
 * Marca filas con error si un identificador sensible se repite en el Excel
 * o ya está registrado en el catálogo del tenant.
 */
export function applyDataImportUniquenessRules(
  rows: DataImportPreparedRow[],
  catalog: DataImportCatalogSnapshot,
): DataImportPreparedRow[] {
  const keyToRows = new Map<string, number[]>();

  for (const row of rows) {
    for (const probe of probesForRow(row)) {
      const mapKey = `${probe.label}\0${probe.key}`;
      const list = keyToRows.get(mapKey) ?? [];
      list.push(row.rowNumber);
      keyToRows.set(mapKey, list);
    }
  }

  return rows.map((row) => {
    const errors = [...row.errors];
    const probes = probesForRow(row);

    for (const probe of probes) {
      const mapKey = `${probe.label}\0${probe.key}`;
      const peers = keyToRows.get(mapKey) ?? [];
      if (peers.length > 1) {
        const others = peers.filter((n) => n !== row.rowNumber);
        const msg = duplicateMessage(probe.label, 'archivo', others);
        if (!errors.includes(msg)) {
          errors.push(msg);
        }
      }
      if (catalogHits(row.kind, probe, catalog)) {
        const msg = duplicateMessage(probe.label, 'empresa');
        if (!errors.includes(msg)) {
          errors.push(msg);
        }
      }
    }

    const status = errors.length > 0 ? 'error' : row.status === 'error' ? 'error' : 'ready';
    return { ...row, errors, status };
  });
}