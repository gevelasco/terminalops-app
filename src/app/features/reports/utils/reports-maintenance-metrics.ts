import { expenseKindLabel } from '@features/expenses/utils/expense-row-labels';
import { labelForUnitId } from '@app/sim-db/utils/unit-label';
import { formatEquipmentOperationalId } from '@app/sim-db/utils/fleet-id-builders';
import type { ReportsFilter, ReportsKpiCard, ReportsMaintenanceTabView } from '../models/reports-view.models';
import type { ReportsFilteredBundle } from './reports-bundle-filter';
import { amountBarSlices } from './reports-chart-mappers';
import { formatMxn } from './reports-money';

export function buildMaintenanceTabView(
  bundle: ReportsFilteredBundle,
  filter: ReportsFilter,
): ReportsMaintenanceTabView {
  const maint = bundle.expenses.filter((e) => e.kind === 'maintenance' && e.currency === 'MXN');
  const total = maint.reduce((a, e) => a + e.amount, 0);
  const unitCount = new Set(
    maint.map((e) => e.relatedUnitId).filter(Boolean),
  ).size;
  const eqCount = new Set(
    maint.map((e) => e.relatedEquipmentId).filter(Boolean),
  ).size;

  const kpis: ReportsKpiCard[] = [
    {
      id: 'spend',
      title: 'Gasto mantenimiento',
      titleIcon: 'revenue',
      value: formatMxn(total),
      legend: `${maint.length} registros`,
    },
    {
      id: 'units',
      title: 'Unidades con servicio',
      titleIcon: 'units',
      value: String(unitCount),
    },
    {
      id: 'eq',
      title: 'Equipos con servicio',
      titleIcon: 'equipment',
      value: String(eqCount),
    },
  ];

  const unitAmt = maint
    .filter((e) => e.maintenanceTarget === 'unit')
    .reduce((a, e) => a + e.amount, 0);
  const eqAmt = maint
    .filter((e) => e.maintenanceTarget === 'equipment')
    .reduce((a, e) => a + e.amount, 0);
  const byTarget = amountBarSlices(
    [
      { label: 'Unidad tractora', amount: unitAmt },
      { label: 'Remolque / equipo', amount: eqAmt },
    ].filter((r) => r.amount > 0),
    'reports-chart-bar__fill--maint',
  );

  const spendByMonth = buildMaintDailySeries(maint, filter.from, filter.to);

  const table = [...maint]
    .sort((a, b) => b.incurredAt.localeCompare(a.incurredAt))
    .slice(0, 40)
    .map((e) => ({
      date: e.incurredAt.slice(0, 10),
      target:
        e.maintenanceTarget === 'equipment'
          ? 'Remolque'
          : e.maintenanceTarget === 'unit'
            ? 'Tractora'
            : '—',
      unitOrEquipment: resolveMaintAsset(e, bundle),
      amount: e.amount,
      description: e.description?.trim() || expenseKindLabel(e.kind),
    }));

  return { kpis, spendByMonth, byTarget, table };
}

function resolveMaintAsset(
  e: ReportsFilteredBundle['expenses'][number],
  bundle: ReportsFilteredBundle,
): string {
  if (e.maintenanceTarget === 'unit' && e.relatedUnitId) {
    return labelForUnitId(e.relatedUnitId, bundle.units);
  }
  if (e.maintenanceTarget === 'equipment' && e.relatedEquipmentId) {
    const eq = bundle.equipment.find((x) => x.id === e.relatedEquipmentId);
    return eq ? formatEquipmentOperationalId(eq) : e.relatedEquipmentId;
  }
  return '—';
}

function buildMaintDailySeries(
  maint: ReportsFilteredBundle['expenses'],
  from: string,
  to: string,
): { label: string; value: number }[] {
  const a = new Date(from + 'T12:00:00');
  const b = new Date(to + 'T12:00:00');
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return [];
  }
  const fmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
  const out: { label: string; value: number }[] = [];
  const cur = new Date(a);
  let i = 0;
  while (cur.getTime() <= b.getTime() && i < 14) {
    const key = cur.toISOString().slice(0, 10);
    const sum = maint
      .filter((e) => e.incurredAt.slice(0, 10) === key)
      .reduce((s, e) => s + e.amount, 0);
    out.push({ label: fmt.format(cur), value: Math.round(sum) });
    cur.setDate(cur.getDate() + 1);
    i += 1;
  }
  return out;
}
