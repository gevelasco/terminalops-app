import type { Expense, ExpenseKind, Trip } from '@shared/models/logistics.models';
import type { ReportsDonutSlice } from '../models/reports-view.models';
import { sumTripDirectCost } from './reports-trip-helpers';

export type ReportsExpenseCategoryId =
  | 'operacion'
  | 'administracion'
  | 'mantenimiento'
  | 'verificacion'
  | 'seguros';

const CATEGORY_LABELS: Record<ReportsExpenseCategoryId, string> = {
  operacion: 'Operación',
  administracion: 'Administración',
  mantenimiento: 'Mantenimiento',
  verificacion: 'Verificaciones',
  seguros: 'Seguros',
};

const CATEGORY_COLORS: Record<ReportsExpenseCategoryId, string> = {
  operacion: '#3b82f6',
  administracion: '#6366f1',
  mantenimiento: '#8b5cf6',
  verificacion: '#a855f7',
  seguros: '#d946ef',
};

const CATEGORY_ORDER: ReportsExpenseCategoryId[] = [
  'operacion',
  'administracion',
  'mantenimiento',
  'verificacion',
  'seguros',
];

function expenseCategoryForKind(kind: ExpenseKind): ReportsExpenseCategoryId {
  switch (kind) {
    case 'fuel':
    case 'tolls':
    case 'per_diem':
    case 'lodging':
    case 'operator_payment':
    case 'operator_commission':
    case 'trip':
      return 'operacion';
    case 'maintenance':
    case 'repair':
    case 'tires':
      return 'mantenimiento';
    case 'verification':
      return 'verificacion';
    case 'insurance':
      return 'seguros';
    case 'gps':
    case 'unit_rent':
    case 'equipment_rent':
    case 'trailer_admin_payout':
    case 'unit_purchase':
    case 'equipment_purchase':
    case 'other':
      return 'administracion';
    default:
      return 'administracion';
  }
}

/** Gastos del periodo agrupados por área (operación, administración, etc.). */
export function buildExpenseCategoryDonut(
  trips: readonly Trip[],
  expenses: readonly Expense[],
): ReportsDonutSlice[] {
  const totals = new Map<ReportsExpenseCategoryId, number>();

  for (const id of CATEGORY_ORDER) {
    totals.set(id, 0);
  }

  totals.set('operacion', sumTripDirectCost(trips));

  for (const e of expenses) {
    if (e.currency !== 'MXN') {
      continue;
    }
    const cat = expenseCategoryForKind(e.kind);
    totals.set(cat, (totals.get(cat) ?? 0) + e.amount);
  }

  const rows = CATEGORY_ORDER.map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    amount: Math.round(totals.get(id) ?? 0),
  })).filter((r) => r.amount > 0);

  if (rows.length === 0) {
    return [];
  }

  const total = rows.reduce((a, r) => a + r.amount, 0) || 1;
  let assigned = 0;

  return rows.map((r, index) => {
    const pct =
      index === rows.length - 1
        ? Math.max(0, 100 - assigned)
        : Math.round((r.amount / total) * 100);
    assigned += pct;
    return {
      key: r.id,
      label: r.label,
      value: r.amount,
      pct,
      color: CATEGORY_COLORS[r.id],
    };
  });
}

/**
 * Arco superior visible en `.reports-semi-donut`: mismo origen que la dona completa
 * (`from -90deg`, izquierda → arriba → derecha) pero solo el 50% del círculo.
 */
export function semiDonutConicGradient(slices: readonly ReportsDonutSlice[]): string {
  const track = 'color-mix(in srgb, var(--to-color-border) 40%, var(--to-color-surface))';
  if (slices.length === 0) {
    return `conic-gradient(from -90deg, ${track} 0% 50%)`;
  }
  let acc = 0;
  const stops: string[] = [];
  for (const s of slices) {
    const span = s.pct / 2;
    const end = acc + span;
    stops.push(`${s.color} ${acc}% ${end}%`);
    acc = end;
  }
  if (acc < 50) {
    stops.push(`${track} ${acc}% 50%`);
  }
  return `conic-gradient(from -90deg, ${stops.join(', ')})`;
}

export function expenseCategoryDonutTotal(
  slices: readonly ReportsDonutSlice[],
): number {
  return slices.reduce((sum, slice) => sum + slice.value, 0);
}
