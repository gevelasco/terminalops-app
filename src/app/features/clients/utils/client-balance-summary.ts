import { localYmd } from '@features/reports/utils/reports-filter';

export type ClientPaymentDueBadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

export interface ClientManeuverStatusCounts {
  completed: number;
  inTransit: number;
  scheduled: number;
  cancelled: number;
  total: number;
}

export interface ClientUpcomingPaymentRow {
  tripId: string;
  maneuverCode: string;
  dueYmd: string;
  dueLabel: string;
  amount: number;
  badgeVariant: ClientPaymentDueBadgeVariant;
  statusHint: string;
}

export interface ClientPaymentHistoryRow {
  tripId: string;
  maneuverCode: string;
  dueYmd: string;
  dueLabel: string;
  collectedYmd: string;
  collectedLabel: string;
  amount: number;
  delayDays: number;
}

export interface ClientBalanceSummary {
  hasTrips: boolean;
  hasBillable: boolean;
  statusCounts: ClientManeuverStatusCounts;
  completedCount: number;
  totalKm: number;
  collected: number;
  receivable: number;
  totalRevenue: number;
  directCost: number;
  margin: number;
  marginPct: number;
  /** Vencimiento más cercano entre maniobras por cobrar. */
  nextDueYmd: string | null;
  nextDueLabel: string;
  nextDueBadgeVariant: ClientPaymentDueBadgeVariant;
  upcomingPayments: ClientUpcomingPaymentRow[];
  paymentHistory: ClientPaymentHistoryRow[];
  avgDelayDays: number | null;
  volumeMonthsWindow: number;
  volumeBillableCount: number;
  volumeAllCount: number;
  volumeManeuversPerMonth: number;
  volumeBilledPerMonth: number;
  volumeOperationalPerMonth: number;
  volumeProfitPerMonth: number;
  period?: ClientBalancePeriodSummary;
}

export interface ClientBalancePeriodSummary {
  from: string;
  to: string;
  paymentHistory: ClientPaymentHistoryRow[];
  statusCounts: ClientManeuverStatusCounts;
  completedCount: number;
  totalKm: number;
  volumeMonthsWindow: number;
  volumeBillableCount: number;
  volumeAllCount: number;
  volumeManeuversPerMonth: number;
  volumeBilledPerMonth: number;
  volumeOperationalPerMonth: number;
  volumeProfitPerMonth: number;
}

/** Resumen vacío para clientes sin maniobras (p. ej. overview API). */
export function emptyClientBalanceSummary(): ClientBalanceSummary {
  return {
    hasTrips: false,
    hasBillable: false,
    statusCounts: {
      completed: 0,
      inTransit: 0,
      scheduled: 0,
      cancelled: 0,
      total: 0,
    },
    completedCount: 0,
    totalKm: 0,
    collected: 0,
    receivable: 0,
    totalRevenue: 0,
    directCost: 0,
    margin: 0,
    marginPct: 0,
    nextDueYmd: null,
    nextDueLabel: '—',
    nextDueBadgeVariant: 'neutral',
    upcomingPayments: [],
    paymentHistory: [],
    avgDelayDays: null,
    volumeMonthsWindow: 0,
    volumeBillableCount: 0,
    volumeAllCount: 0,
    volumeManeuversPerMonth: 0,
    volumeBilledPerMonth: 0,
    volumeOperationalPerMonth: 0,
    volumeProfitPerMonth: 0,
  };
}

const mxMoney0 = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

function compactDateLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return ymd;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
  }).format(d);
}

function daysOverdue(dueYmd: string, asOfYmd: string): number {
  const due = new Date(`${dueYmd}T12:00:00`);
  const asOf = new Date(`${asOfYmd}T12:00:00`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(asOf.getTime())) {
    return 0;
  }
  const diff = Math.floor((asOf.getTime() - due.getTime()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

/** Formato monetario compartido para balance de cliente (cards y drawer). */
export function formatClientBalanceMoney(value: number): string {
  return mxMoney0.format(value);
}

export interface ClientBalanceCollectionStatus {
  label: string;
  variant: ClientPaymentDueBadgeVariant;
  icon: 'warning' | 'cancelCircle' | null;
}

/** Etiqueta de cobranza derivada del resumen (cards de balance). */
export function clientBalanceCollectionStatus(
  balance: ClientBalanceSummary,
  asOf: Date = new Date(),
): ClientBalanceCollectionStatus {
  const pendingCount = balance.upcomingPayments.length;
  if (balance.receivable <= 0 || pendingCount === 0) {
    return { label: 'Vigente', variant: 'success', icon: null };
  }

  const overdue = balance.upcomingPayments.filter(
    (row) => row.badgeVariant === 'danger',
  );
  if (overdue.length > 0) {
    const days = daysOverdue(overdue[0].dueYmd, localYmd(asOf));
    return {
      label: days > 0 ? `Pago vencido (${days} días)` : 'Pago vencido',
      variant: 'danger',
      icon: 'cancelCircle',
    };
  }

  const noun = pendingCount === 1 ? 'maniobra' : 'maniobras';
  return {
    label: `${pendingCount} ${noun} por cobrar`,
    variant: 'warning',
    icon: 'warning',
  };
}

export interface ClientBalanceHighlightedPayment {
  sectionLabel: string;
  dueLabel: string;
  amountLabel: string;
  overdue: boolean;
}

/** Próximo cobro o vencimiento más urgente (primer `upcomingPayments`). */
export function clientBalanceHighlightedPayment(
  balance: ClientBalanceSummary,
): ClientBalanceHighlightedPayment {
  const next = balance.upcomingPayments[0];
  if (!next) {
    return {
      sectionLabel: 'Próximo pago',
      dueLabel: '—',
      amountLabel: '—',
      overdue: false,
    };
  }

  const overdue = next.badgeVariant === 'danger';
  return {
    sectionLabel: overdue ? 'Fecha vencimiento' : 'Próximo pago',
    dueLabel: compactDateLabel(next.dueYmd),
    amountLabel: formatClientBalanceMoney(next.amount),
    overdue,
  };
}
