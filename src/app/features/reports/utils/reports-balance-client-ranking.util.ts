import { clientCommercialHealthLabel } from '@shared/catalogs/client-form-options';
import { deriveClientCommercialHealthFromCredit } from '@features/clients/utils/client-commercial-status.util';
import type { ClientCommercialHealth } from '@shared/models/client.models';
import type {
  ReportsBalanceCreditByClient,
  ReportsBalanceIncomeByClient,
} from '@shared/models/api/api-reports-balance.model';

function formatDueLabel(ymd: string | null | undefined): string {
  if (!ymd?.trim()) {
    return '—';
  }
  const date = new Date(`${ymd.trim()}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export interface ReportsBalancePortfolioRow {
  clientName: string;
  totalSales: number;
  collected: number;
  receivable: number;
  nextDueLabel: string;
  commercialHealth: ClientCommercialHealth;
  commercialHealthLabel: string;
}

export interface ReportsBalancePortfolioTotals {
  totalSales: number;
  collected: number;
  receivable: number;
}

export interface ReportsBalancePortfolioTable {
  rows: ReportsBalancePortfolioRow[];
  totals: ReportsBalancePortfolioTotals;
}

/**
 * Cartera completa por cliente: venta total (cobrado + por cobrar), cobrado,
 * por cobrar, próximo vencimiento y estatus. Fusiona ingresos y cartera sin
 * llamadas extra al API e incluye totales por columna.
 */
export function buildReportsBalancePortfolioTable(
  incomeByClient: readonly ReportsBalanceIncomeByClient[],
  creditByClient: readonly ReportsBalanceCreditByClient[],
  asOf = new Date(),
): ReportsBalancePortfolioTable {
  const byName = new Map<string, ReportsBalancePortfolioRow>();

  const ensure = (rawName: string): ReportsBalancePortfolioRow => {
    const name = rawName.trim() || 'Sin cliente';
    let row = byName.get(name);
    if (!row) {
      row = {
        clientName: name,
        totalSales: 0,
        collected: 0,
        receivable: 0,
        nextDueLabel: '—',
        commercialHealth: 'good_standing',
        commercialHealthLabel: clientCommercialHealthLabel('good_standing'),
      };
      byName.set(name, row);
    }
    return row;
  };

  for (const income of incomeByClient) {
    ensure(income.clientName).collected = income.amount;
  }

  for (const credit of creditByClient) {
    const row = ensure(credit.clientName);
    row.receivable = credit.amount;
    row.nextDueLabel = formatDueLabel(credit.nextDueDate);
  }

  const nextDueByClient = new Map<string, string | null>();
  for (const credit of creditByClient) {
    nextDueByClient.set(credit.clientName.trim() || 'Sin cliente', credit.nextDueDate);
  }

  const rows = [...byName.values()]
    .map((row) => {
      const totalSales = row.collected + row.receivable;
      const health = deriveClientCommercialHealthFromCredit(
        row.receivable,
        nextDueByClient.get(row.clientName) ?? null,
        totalSales > 0,
        asOf,
      );
      return {
        ...row,
        totalSales,
        commercialHealth: health,
        commercialHealthLabel: clientCommercialHealthLabel(health),
      };
    })
    .filter((row) => row.totalSales > 0)
    .sort(
      (a, b) =>
        b.totalSales - a.totalSales ||
        a.clientName.localeCompare(b.clientName, 'es'),
    );

  const totals = rows.reduce<ReportsBalancePortfolioTotals>(
    (acc, row) => {
      acc.totalSales += row.totalSales;
      acc.collected += row.collected;
      acc.receivable += row.receivable;
      return acc;
    },
    { totalSales: 0, collected: 0, receivable: 0 },
  );

  return { rows, totals };
}
