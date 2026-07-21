import { operatorOperationalStatusLabel } from '@shared/catalogs/operator-form-options';
import { companyTenureMonthsDaysLabelEs } from '@features/operators/utils/operator-company-tenure';
import { operatorDaysWithoutManeuver } from '@features/operators/utils/operator-days-without-maneuver';
import {
  operatorHasPhoto,
  operatorPhotoInitials,
} from '@features/operators/utils/operator-photo';
import type { Operator, OperatorOperationalStatus } from '@shared/models/logistics.models';
import { operatorOperationalPillClass } from '@shared/utils/operator-operational-pill';
import { formatTripRouteSummary } from '@features/trips/utils/trip-display-labels';
import type { ToBadgeVariant } from '@shared/ui/to-badge/to-badge.component';

export interface OperatorsOverviewCardView {
  id: string;
  name: string;
  licenseNumber: string;
  licenseExpiresLabel: string;
  maneuverCountLabel: string;
  status: OperatorOperationalStatus;
  statusLabel: string;
  statusPillClass: string;
  photoUrl: string | null;
  photoInitials: string;
  lastManeuverCode: string;
  lastManeuverRoute: string;
  lastManeuverDateLabel: string;
  companyTenureLabel: string;
  owedAmountLabel: string | null;
  nextPayDueLabel: string | null;
  nextPayDueVariant: ToBadgeVariant | null;
  daysWithoutManeuverLabel: string;
}

const mxMoney0 = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

function formatOwedAmount(amount: number | undefined): string | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return mxMoney0.format(amount);
}

function formatIsoDateEs(iso: string): string {
  const t = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return iso || '—';
  }
  const d = new Date(`${t}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(d);
}

function formatIsoDateSlash(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) {
    return ymd || '—';
  }
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function buildOperatorsOverviewCard(operator: Operator): OperatorsOverviewCardView {
  const status = operator.status;
  const last = operator.lastManeuver;
  const route = last ? formatTripRouteSummary(last) : '—';
  const nextPayDueYmd = operator.nextPayDueOn?.trim() || null;

  return {
    id: operator.id,
    name: operator.name,
    licenseNumber: operator.licenseNumber?.trim() || '—',
    licenseExpiresLabel: formatIsoDateEs(operator.licenseExpiresOn),
    maneuverCountLabel: (operator.maneuverCount ?? 0).toLocaleString('es-MX'),
    status,
    statusLabel: operatorOperationalStatusLabel(status),
    statusPillClass: operatorOperationalPillClass(status),
    photoUrl: operatorHasPhoto(operator.photoDataUrl)
      ? (operator.photoDataUrl ?? null)
      : null,
    photoInitials: operatorPhotoInitials(operator.name),
    lastManeuverCode: last?.maneuverCode?.trim() || '—',
    lastManeuverRoute: route,
    lastManeuverDateLabel: last?.occurredOn
      ? formatIsoDateEs(last.occurredOn)
      : '—',
    companyTenureLabel: `${companyTenureMonthsDaysLabelEs(operator.companyHireDate)} en la empresa`,
    owedAmountLabel: formatOwedAmount(operator.owedAmount),
    nextPayDueLabel: nextPayDueYmd ? formatIsoDateSlash(nextPayDueYmd) : null,
    nextPayDueVariant: operator.nextPayDueVariant ?? null,
    daysWithoutManeuverLabel: operatorDaysWithoutManeuver(
      last?.occurredOn,
      operator.companyHireDate,
    ).toLocaleString('es-MX'),
  };
}

export function operatorOverviewMatchesQuery(
  card: OperatorsOverviewCardView,
  q: string,
): boolean {
  const haystack = [
    card.id,
    card.name,
    card.licenseNumber,
    card.licenseExpiresLabel,
    card.maneuverCountLabel,
    card.status,
    card.statusLabel,
    card.lastManeuverCode,
    card.lastManeuverRoute,
    card.lastManeuverDateLabel,
    card.companyTenureLabel,
    card.owedAmountLabel,
    card.nextPayDueLabel,
    card.daysWithoutManeuverLabel,
  ]
    .map((v) => String(v ?? '').toLowerCase())
    .join(' ');
  return haystack.includes(q);
}
