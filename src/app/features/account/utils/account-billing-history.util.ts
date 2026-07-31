import type { CompanyAccount } from '@core/services/api/company-users';
import {
  normalizeSubscriptionPlanId,
  planDisplayName,
} from '@shared/billing/subscription-plans';

export type AccountBillingStatus =
  | 'paid'
  | 'complimentary'
  | 'pending'
  | 'failed'
  | 'refunded';

export type AccountBillingEntry = {
  id: string;
  /** Periodo cubierto, ej. «Jul 2026». */
  periodLabel: string;
  paidAt: string | null;
  paidAtLabel: string;
  description: string;
  amount: number;
  currency: string;
  amountLabel: string;
  status: AccountBillingStatus;
  statusLabel: string;
  statusTone: 'success' | 'warning' | 'danger' | 'neutral' | 'beta';
};

const STATUS_LABEL: Record<AccountBillingStatus, string> = {
  paid: 'Pagado',
  complimentary: 'Cortesía',
  pending: 'Pendiente',
  failed: 'Fallido',
  refunded: 'Reembolsado',
};

const STATUS_TONE: Record<
  AccountBillingStatus,
  AccountBillingEntry['statusTone']
> = {
  paid: 'success',
  complimentary: 'beta',
  pending: 'warning',
  failed: 'danger',
  refunded: 'neutral',
};

function formatMoney(amount: number, currency = 'MXN'): string {
  const money = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${money} ${currency}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatPeriodFromParts(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex, 1, 12, 0, 0, 0);
  const label = new Intl.DateTimeFormat('es-MX', {
    month: 'short',
    year: 'numeric',
  }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatPeriod(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return formatPeriodFromParts(d.getFullYear(), d.getMonth());
}

function normalizeStatus(raw: unknown): AccountBillingStatus {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (
    key === 'paid' ||
    key === 'pagado' ||
    key === 'succeeded' ||
    key === 'complimentary' ||
    key === 'free' ||
    key === 'beta' ||
    key === 'cortesia' ||
    key === 'cortesía'
  ) {
    return 'paid';
  }
  if (key === 'pending' || key === 'pendiente') {
    return 'pending';
  }
  if (key === 'failed' || key === 'fallido') {
    return 'failed';
  }
  if (key === 'refunded' || key === 'reembolsado') {
    return 'refunded';
  }
  return 'paid';
}

function mapApiBillingRow(
  row: Record<string, unknown>,
  index: number,
): AccountBillingEntry {
  const amount = Number(row['amount'] ?? row['total'] ?? 0) || 0;
  const currency = String(row['currency'] ?? 'MXN');
  const paidAt =
    row['paidAt'] != null || row['paid_at'] != null || row['date'] != null
      ? String(row['paidAt'] ?? row['paid_at'] ?? row['date'])
      : null;
  const periodStart =
    row['periodStart'] != null || row['period_start'] != null
      ? String(row['periodStart'] ?? row['period_start'])
      : paidAt;
  const periodLabel =
    row['periodLabel'] != null || row['period'] != null
      ? String(row['periodLabel'] ?? row['period'])
      : formatPeriod(periodStart);
  const status = normalizeStatus(row['status']);
  const description =
    String(row['description'] ?? row['concept'] ?? '').trim() ||
    `Suscripción · ${periodLabel}`;

  return {
    id: String(row['id'] ?? `billing-${index}`),
    periodLabel,
    paidAt,
    paidAtLabel: formatDate(paidAt),
    description,
    amount,
    currency,
    amountLabel: formatMoney(amount, currency),
    status,
    statusLabel: STATUS_LABEL[status],
    statusTone: STATUS_TONE[status],
  };
}

function parseAccountDate(iso: string | null | undefined): Date | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Un cargo por mes calendario desde el alta de la cuenta hasta hoy
 * (o hasta la vigencia, si es anterior).
 */
export function buildBetaMonthlyBillingEntries(
  account: CompanyAccount,
  now = new Date(),
): AccountBillingEntry[] {
  const planName = planDisplayName(
    normalizeSubscriptionPlanId(account.subscriptionPlan),
  );
  const start = parseAccountDate(account.createdAt) ?? now;
  const endsAt = parseAccountDate(account.subscriptionEndsAt);
  const end =
    endsAt && endsAt.getTime() < now.getTime() ? endsAt : now;

  let cursorYear = start.getFullYear();
  let cursorMonth = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();

  const rows: AccountBillingEntry[] = [];

  while (
    cursorYear < endYear ||
    (cursorYear === endYear && cursorMonth <= endMonth)
  ) {
    const periodLabel = formatPeriodFromParts(cursorYear, cursorMonth);
    const isFirstMonth =
      cursorYear === start.getFullYear() && cursorMonth === start.getMonth();
    const paidDay = isFirstMonth ? start.getDate() : 1;
    const paidAtDate = new Date(cursorYear, cursorMonth, paidDay, 12, 0, 0, 0);
    const paidAt = paidAtDate.toISOString();
    const yyyy = String(cursorYear);
    const mm = String(cursorMonth + 1).padStart(2, '0');

    rows.push({
      id: `beta-${yyyy}-${mm}`,
      periodLabel,
      paidAt,
      paidAtLabel: formatDate(paidAt),
      description: `Plan ${planName} · Beta`,
      amount: 0,
      currency: 'MXN',
      amountLabel: formatMoney(0, 'MXN'),
      status: 'paid',
      statusLabel: STATUS_LABEL.paid,
      statusTone: STATUS_TONE.paid,
    });

    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }

    // Safety: avoid runaway loops if dates are odd.
    if (rows.length > 240) {
      break;
    }
  }

  return rows.sort((a, b) => {
    const aTime = a.paidAt ? new Date(a.paidAt).getTime() : 0;
    const bTime = b.paidAt ? new Date(b.paidAt).getTime() : 0;
    return bTime - aTime;
  });
}

/**
 * Historial de pagos de suscripción.
 * Si el API envía `billingHistory` / `subscriptionPayments`, se usa;
 * si no, se generan meses desde el alta (Beta a $0.00 MXN).
 */
export function buildAccountBillingHistory(
  account: CompanyAccount,
  now = new Date(),
): AccountBillingEntry[] {
  const rawList = account.billingHistory;

  if (Array.isArray(rawList) && rawList.length > 0) {
    return rawList
      .map((row, index) => mapApiBillingRow(row ?? {}, index))
      .sort((a, b) => {
        const aTime = a.paidAt ? new Date(a.paidAt).getTime() : 0;
        const bTime = b.paidAt ? new Date(b.paidAt).getTime() : 0;
        return bTime - aTime;
      });
  }

  return buildBetaMonthlyBillingEntries(account, now);
}
