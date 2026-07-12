import type { ClientCommercialHealth } from '@shared/models/client.models';
import {
  buildClientBalanceSummary,
  type ClientBalanceSummary,
} from '@features/clients/utils/client-balance-summary';
import { localYmd } from '@features/reports/utils/reports-filter';
import type { Expense, Trip } from '@shared/models/logistics.models';

/** Ventana (días) para marcar cartera como «Vence pronto». */
export const CLIENT_COMMERCIAL_DUE_SOON_DAYS = 10;

function addDaysYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localYmd(date);
}

export function isClientCreditDueSoon(
  dueYmd: string,
  asOfYmd: string,
  withinDays = CLIENT_COMMERCIAL_DUE_SOON_DAYS,
): boolean {
  return dueYmd >= asOfYmd && dueYmd <= addDaysYmd(asOfYmd, withinDays);
}

/**
 * Estatus comercial a partir de cartera agregada (maniobras, reportes o API).
 *
 * - Sin actividad operativa: en seguimiento.
 * - Cartera vencida (antes de hoy): vencido.
 * - Próximo vencimiento en ≤ {@link CLIENT_COMMERCIAL_DUE_SOON_DAYS} días: vence pronto.
 * - Resto con saldo al día: vigente.
 */
export function deriveClientCommercialHealthFromCredit(
  receivable: number,
  nextDueYmd: string | null | undefined,
  hasActivity: boolean,
  asOf: Date = new Date(),
): ClientCommercialHealth {
  if (!hasActivity) {
    return 'watch_list';
  }
  if (receivable <= 0) {
    return 'good_standing';
  }
  const asOfYmd = localYmd(asOf);
  const due = nextDueYmd?.trim();
  if (!due) {
    return 'watch_list';
  }
  if (due < asOfYmd) {
    return 'restricted';
  }
  if (isClientCreditDueSoon(due, asOfYmd)) {
    return 'due_soon';
  }
  return 'good_standing';
}

/**
 * Estatus comercial derivado de maniobras y cartera (única fuente de verdad en UI).
 */
export function deriveClientCommercialHealthFromSummary(
  balance: ClientBalanceSummary,
): ClientCommercialHealth {
  return deriveClientCommercialHealthFromCredit(
    balance.receivable,
    balance.nextDueYmd,
    balance.hasTrips,
  );
}

export function deriveClientCommercialHealth(
  clientId: string,
  trips: readonly Trip[],
  expenses: readonly Expense[] = [],
  asOf: Date = new Date(),
): ClientCommercialHealth {
  const balance = buildClientBalanceSummary(clientId, trips, expenses, asOf);
  return deriveClientCommercialHealthFromSummary(balance);
}
