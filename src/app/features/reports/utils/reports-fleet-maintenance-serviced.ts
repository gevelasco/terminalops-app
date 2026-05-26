import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import { labelForUnitId } from '@shared/utils/fleet/unit-label';
import type { Expense } from '@shared/models/logistics.models';
import type {
  ReportsFleetMaintCompletedRow,
  ReportsFleetMaintServicedRow,
} from '../models/reports-view.models';
import type { ReportsFilteredBundle } from './reports-bundle-filter';
import { buildFleetMaintenanceCompleted } from './reports-fleet-maintenance-completed';

function formatShortDateLabel(ymd: string): string {
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

function formatPeriodDatesLabel(dates: readonly string[]): string {
  if (dates.length === 0) {
    return '—';
  }
  if (dates.length === 1) {
    return formatShortDateLabel(dates[0]!);
  }
  if (dates.length <= 3) {
    return dates.map((d) => formatShortDateLabel(d)).join(' · ');
  }
  const asc = [...dates].sort();
  return `${formatShortDateLabel(asc[0]!)} – ${formatShortDateLabel(asc[asc.length - 1]!)}`;
}

function collectPeriodDatesForAsset(
  assetId: string,
  target: 'unit' | 'equipment',
  completed: readonly ReportsFleetMaintCompletedRow[],
  maint: readonly Expense[],
): string[] {
  const dates = new Set<string>();
  for (const r of completed) {
    if (r.assetId === assetId && r.targetKind === target && r.date) {
      dates.add(r.date);
    }
  }
  for (const e of maint) {
    if (e.maintenanceTarget !== target) {
      continue;
    }
    const id =
      target === 'unit'
        ? e.relatedUnitId?.trim()
        : e.relatedEquipmentId?.trim();
    if (id === assetId) {
      const ymd = e.incurredAt.trim().slice(0, 10);
      if (ymd) {
        dates.add(ymd);
      }
    }
  }
  return [...dates].sort((a, b) => b.localeCompare(a));
}

type ServicedAgg = {
  label: string;
  targetLabel: 'Unidad' | 'Equipo';
  spend: number;
  services: number;
};

export function buildMaintenanceServicedInPeriod(
  bundle: ReportsFilteredBundle,
  filter: { from: string; to: string },
  maint: readonly Expense[],
): ReportsFleetMaintServicedRow[] {
  const completed = buildFleetMaintenanceCompleted(
    bundle,
    filter.from,
    filter.to,
  );
  const byKey = new Map<string, ServicedAgg & { assetId: string; target: 'unit' | 'equipment' }>();

  for (const e of maint) {
    const target = e.maintenanceTarget;
    if (target !== 'unit' && target !== 'equipment') {
      continue;
    }
    const assetId =
      target === 'unit'
        ? e.relatedUnitId?.trim()
        : e.relatedEquipmentId?.trim();
    if (!assetId) {
      continue;
    }
    const key = `${target}-${assetId}`;
    const label =
      target === 'unit'
        ? labelForUnitId(assetId, bundle.units)
        : (() => {
            const eq = bundle.equipment.find((x) => x.id === assetId);
            return eq ? formatEquipmentOperationalId(eq) : assetId;
          })();
    const row = byKey.get(key) ?? {
      assetId,
      target,
      label,
      targetLabel: target === 'unit' ? 'Unidad' : 'Equipo',
      spend: 0,
      services: 0,
    };
    row.spend += e.amount;
    row.services += 1;
    byKey.set(key, row);
  }

  const rows: ReportsFleetMaintServicedRow[] = [];
  for (const [key, agg] of byKey) {
    if (agg.spend <= 0 && agg.services <= 0) {
      continue;
    }
    const dates = collectPeriodDatesForAsset(
      agg.assetId,
      agg.target,
      completed,
      maint,
    );
    rows.push({
      key,
      label: agg.label,
      targetLabel: agg.targetLabel,
      serviceDatesLabel: formatPeriodDatesLabel(dates),
      periodSpend: Math.round(agg.spend),
      periodServices: agg.services,
    });
  }

  return rows.sort(
    (a, b) =>
      b.periodSpend - a.periodSpend ||
      b.periodServices - a.periodServices ||
      a.label.localeCompare(b.label, 'es'),
  );
}
