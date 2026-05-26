import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import { labelForUnitId } from '@shared/utils/fleet/unit-label';
import { FLEET_MAINTENANCE_TYPE_OPTIONS } from '@shared/catalogs/fleet-form-options';
import type {
  Equipment,
  Expense,
  MaintenanceEntry,
  Unit,
} from '@shared/models/logistics.models';
import type { ReportsFleetMaintCompletedRow } from '../models/reports-view.models';
import type { ReportsFilteredBundle } from './reports-bundle-filter';
import { isoDayInRange } from './reports-filter';

function maintTypeLabel(value: string | undefined): string {
  const v = value?.trim();
  if (!v) {
    return 'Mantenimiento';
  }
  return FLEET_MAINTENANCE_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function formatDateLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return ymd;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function entryYmd(entry: MaintenanceEntry): string {
  return (entry.date ?? '').trim().slice(0, 10);
}

function isConcluded(entry: MaintenanceEntry): boolean {
  return entry.status !== 'programado';
}

function rowsFromEntries(
  entries: readonly MaintenanceEntry[],
  assetId: string,
  assetLabel: string,
  targetLabel: 'Unidad' | 'Equipo',
  targetKind: 'unit' | 'equipment',
  from: string,
  to: string,
  keyPrefix: string,
): ReportsFleetMaintCompletedRow[] {
  const out: ReportsFleetMaintCompletedRow[] = [];
  for (const [i, entry] of entries.entries()) {
    if (!isConcluded(entry)) {
      continue;
    }
    const ymd = entryYmd(entry);
    if (!ymd || !isoDayInRange(ymd, from, to)) {
      continue;
    }
    const amount = typeof entry.cost === 'number' && entry.cost > 0 ? entry.cost : 0;
    out.push({
      key: `${keyPrefix}-hist-${i}-${ymd}`,
      assetId,
      assetLabel,
      targetLabel,
      targetKind,
      date: ymd,
      dateLabel: formatDateLabel(ymd),
      typeLabel: maintTypeLabel(entry.type),
      amount: Math.round(amount),
      notes: entry.notes?.trim() ?? '',
      sourceLabel: 'Historial de flota',
      vendor: '—',
      documentCount: entry.documentNames?.length ?? 0,
    });
  }
  return out;
}

function rowsFromExpense(
  e: Expense,
  bundle: ReportsFilteredBundle,
): ReportsFleetMaintCompletedRow | null {
  const ymd = e.incurredAt.trim().slice(0, 10);
  if (!ymd) {
    return null;
  }
  let assetId = '';
  let assetLabel = '—';
  let targetLabel: 'Unidad' | 'Equipo' | 'General' = 'General';
  let targetKind: 'unit' | 'equipment' = 'unit';
  if (e.maintenanceTarget === 'unit' && e.relatedUnitId?.trim()) {
    assetId = e.relatedUnitId.trim();
    assetLabel = labelForUnitId(assetId, bundle.units);
    targetLabel = 'Unidad';
    targetKind = 'unit';
  } else if (e.maintenanceTarget === 'equipment' && e.relatedEquipmentId?.trim()) {
    assetId = e.relatedEquipmentId.trim();
    const eq = bundle.equipment.find((x) => x.id === assetId);
    assetLabel = eq ? formatEquipmentOperationalId(eq) : assetId;
    targetLabel = 'Equipo';
    targetKind = 'equipment';
  }
  if (targetLabel === 'General') {
    return null;
  }
  return {
    key: `exp-${e.id}`,
    assetId,
    assetLabel,
    targetLabel,
    targetKind,
    date: ymd,
    dateLabel: formatDateLabel(ymd),
    typeLabel: e.category?.trim() || e.description?.trim() || 'Gasto de mantenimiento',
    amount: Math.round(e.amount),
    notes: e.description?.trim() ?? '',
    sourceLabel: 'Gasto registrado',
    vendor: e.vendor?.trim() || '—',
    documentCount: 0,
  };
}

export function buildFleetMaintenanceCompleted(
  bundle: ReportsFilteredBundle,
  from: string,
  to: string,
): ReportsFleetMaintCompletedRow[] {
  const rows: ReportsFleetMaintCompletedRow[] = [];

  for (const u of bundle.units) {
    const meta = u.fleetMeta;
    if (!meta) {
      continue;
    }
    const label = labelForUnitId(u.id, bundle.units);
    const entries = meta.maintenanceEntries ?? [];
    if (entries.length > 0) {
      rows.push(
        ...rowsFromEntries(entries, u.id, label, 'Unidad', 'unit', from, to, u.id),
      );
    } else if (meta.lastMaintenanceDate) {
      rows.push(
        ...rowsFromEntries(
          [
            {
              date: meta.lastMaintenanceDate,
              type: meta.lastMaintenanceType,
              cost: meta.lastMaintenanceCost,
              notes: meta.lastMaintenanceNotes,
              status: 'concluido',
            },
          ],
          u.id,
          label,
          'Unidad',
          'unit',
          from,
          to,
          u.id,
        ),
      );
    }
  }

  for (const eq of bundle.equipment) {
    const meta = eq.fleetMeta;
    if (!meta) {
      continue;
    }
    const label = formatEquipmentOperationalId(eq);
    const entries = meta.maintenanceEntries ?? [];
    if (entries.length > 0) {
      rows.push(
        ...rowsFromEntries(entries, eq.id, label, 'Equipo', 'equipment', from, to, eq.id),
      );
    } else if (meta.lastMaintenanceDate) {
      rows.push(
        ...rowsFromEntries(
          [
            {
              date: meta.lastMaintenanceDate,
              type: meta.lastMaintenanceType,
              cost: meta.lastMaintenanceCost,
              notes: meta.lastMaintenanceNotes,
              status: 'concluido',
            },
          ],
          eq.id,
          label,
          'Equipo',
          'equipment',
          from,
          to,
          eq.id,
        ),
      );
    }
  }

  const maintExpenses = bundle.expenses.filter(
    (e) => e.kind === 'maintenance' && e.currency === 'MXN',
  );
  for (const e of maintExpenses) {
    const row = rowsFromExpense(e, bundle);
    if (row) {
      rows.push(row);
    }
  }

  const seen = new Set<string>();
  const deduped: ReportsFleetMaintCompletedRow[] = [];
  for (const r of rows.sort(
    (a, b) => b.date.localeCompare(a.date) || b.amount - a.amount,
  )) {
    const sig = `${r.assetId}|${r.date}|${r.typeLabel}|${r.amount}|${r.sourceLabel}`;
    if (seen.has(sig)) {
      continue;
    }
    seen.add(sig);
    deduped.push(r);
  }
  return deduped;
}
