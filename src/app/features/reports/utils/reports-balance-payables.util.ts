import type {
  ExpenseCalendarItem,
  ExpenseCalendarProjectedRow,
} from '@core/services/api/expenses';
import type { Expense } from '@shared/models/logistics.models';

export type PayableItemStatus = 'paid' | 'pending' | 'overdue';

export interface ReportsPayableRow {
  description: string;
  amount: number;
  beneficiary: string | null;
  installmentLabel: string;
  dueDate: string;
  status: PayableItemStatus;
}

export interface ReportsPayableTotals {
  amount: number;
  count: number;
}

const PAYABLE_SOURCES = new Set([
  'insurance',
  'gps',
  'tenure_payment',
]);

function parseMoney(raw: string | number | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  return Number(String(raw ?? '').replace(/,/g, '')) || 0;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function trimLabel(value?: string | null): string {
  return value?.trim() ?? '';
}

function projectedAssetLabel(proj: ExpenseCalendarProjectedRow): string {
  return (
    trimLabel(proj.relatedUnitLabel) ||
    trimLabel(proj.relatedEquipmentLabel) ||
    trimLabel(proj.fleetRelationLabel)
  );
}

function projectedDescription(proj: ExpenseCalendarProjectedRow): string {
  const asset = projectedAssetLabel(proj);
  switch (proj.source) {
    case 'insurance':
      return asset ? `Seguro — ${asset}` : 'Seguro';
    case 'gps':
      return asset ? `GPS — ${asset}` : 'GPS';
    case 'tenure_payment':
      return asset ? `Cuota financiamiento — ${asset}` : 'Cuota financiamiento';
    default:
      return proj.conceptLabel || 'Pago programado';
  }
}

function parseInstallmentFromHint(hint: string): string {
  const m = /\((?:.*?)(\d+)\/(\d+)\)/.exec(hint);
  return m ? `${m[1]}/${m[2]}` : '1/1';
}

export function buildReportsPayableTable(
  calendarItems: readonly ExpenseCalendarItem[],
  from: string,
  to: string,
): { rows: ReportsPayableRow[]; totals: ReportsPayableTotals } {
  const today = todayYmd();
  const rows: ReportsPayableRow[] = [];

  for (const item of calendarItems) {
    if (item.entryType === 'projected' && item.projected) {
      const proj = item.projected;
      if (!PAYABLE_SOURCES.has(proj.source)) continue;
      if (proj.nature !== 'scheduled') continue;

      const dueDate = (proj.dueDate || item.dateYmd || '').trim();
      if (!dueDate || dueDate < from || dueDate > to) continue;

      rows.push({
        description: projectedDescription(proj),
        amount: parseMoney(item.amount),
        beneficiary: proj.vendor?.trim() || null,
        installmentLabel: parseInstallmentFromHint(proj.hint),
        dueDate,
        status: dueDate < today ? 'overdue' : 'pending',
      });
    }

    if (item.entryType === 'actual' && item.expense) {
      const exp = item.expense as Expense;
      if (!exp.kind) continue;

      if (PAYABLE_SOURCES.has(exp.kind)) {
        const dateYmd = item.dateYmd?.trim() ?? '';
        if (!dateYmd || dateYmd < from || dateYmd > to) continue;

        let status: PayableItemStatus;
        if (exp.paidAt != null) {
          status = 'paid';
        } else if (dateYmd < today) {
          status = 'overdue';
        } else {
          status = 'pending';
        }

        rows.push({
          description: exp.description?.trim() || exp.kind,
          amount: parseMoney(item.amount),
          beneficiary: exp.vendor?.trim() || null,
          installmentLabel: parseInstallmentFromHint(exp.description ?? ''),
          dueDate: dateYmd,
          status,
        });
        continue;
      }

      const isCreditExpense =
        exp.paymentMethod === 'credit' ||
        exp.paymentMethod === 'credit_card' ||
        exp.paymentMethod === 'card';
      if (isCreditExpense) {
        const dateYmd = item.dateYmd?.trim() ?? '';
        if (!dateYmd || dateYmd < from || dateYmd > to) continue;
        rows.push({
          description: exp.category?.trim() || exp.description?.trim() || 'Gasto a crédito',
          amount: parseMoney(item.amount),
          beneficiary: exp.vendor?.trim() || null,
          installmentLabel: '1/1',
          dueDate: dateYmd,
          status: 'paid',
        });
      }
    }
  }

  rows.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.description.localeCompare(b.description, 'es'),
  );

  const totals: ReportsPayableTotals = {
    amount: rows.reduce((sum, r) => sum + r.amount, 0),
    count: rows.length,
  };

  return { rows, totals };
}
