import { expensePaymentMethodLabel } from '@features/expenses/utils/expense-row-labels';
import type { Trip } from '@shared/models/logistics.models';
import type { ReportsDonutSlice } from '../models/reports-view.models';
import { tripCollectedRevenue } from './reports-trip-helpers';

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#16a34a',
  transfer: '#2563eb',
  check: '#d97706',
  unspecified: '#94a3b8',
};

function paymentMethodKey(t: Trip): string {
  const method = t.paymentMethod?.trim();
  if (method === 'cash' || method === 'transfer' || method === 'check') {
    return method;
  }
  return 'unspecified';
}

/** Montos cobrados confirmados agrupados por forma de pago del cliente. */
export function buildCollectionPaymentDonut(trips: readonly Trip[]): ReportsDonutSlice[] {
  const map = new Map<string, number>();
  for (const t of trips) {
    const amount = tripCollectedRevenue(t);
    if (amount <= 0) {
      continue;
    }
    const key = paymentMethodKey(t);
    map.set(key, (map.get(key) ?? 0) + amount);
  }

  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, value]) => sum + value, 0) || 1;
  let assigned = 0;

  return rows.map(([key, value], index) => {
    const pct =
      index === rows.length - 1
        ? Math.max(0, 100 - assigned)
        : Math.round((value / total) * 100);
    assigned += pct;
    return {
      key,
      label:
        key === 'unspecified'
          ? 'Sin especificar'
          : expensePaymentMethodLabel(key),
      value: Math.round(value),
      pct,
      color: PAYMENT_COLORS[key] ?? '#94a3b8',
    };
  });
}

export function collectionPaymentDonutTotal(
  slices: readonly ReportsDonutSlice[],
): number {
  return slices.reduce((sum, slice) => sum + slice.value, 0);
}
