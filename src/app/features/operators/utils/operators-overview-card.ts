import { operatorOperationalStatusLabel } from '@shared/catalogs/operator-form-options';
import { companyTenureMonthsDaysLabelEs } from '@features/operators/utils/operator-company-tenure';
import { operatorDaysWithoutManeuver } from '@features/operators/utils/operator-days-without-maneuver';
import { operatorPhotoInitials } from '@features/operators/utils/operator-photo';
import type {
  Operator,
  OperatorLastManeuver,
  OperatorOperationalStatus,
} from '@shared/models/logistics.models';
import { operatorOperationalPillClass } from '@shared/utils/operator-operational-pill';
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
  maneuverPanelLabel: string;
  lastManeuverCode: string;
  lastManeuverRoute: string;
  maneuverMetaLabel: string;
  /** Código operativo de unidad cuando está en servicio. */
  activeUnitCodeBadge: string | null;
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

function formatOperatorLastManeuverRoute(
  last: OperatorLastManeuver | undefined,
): string {
  if (!last) {
    return '—';
  }
  const origin = last.origin?.trim() || '';
  const destination = last.destination?.trim() || '';
  if (!origin && !destination) {
    return '—';
  }
  if (!origin) {
    return destination;
  }
  if (!destination) {
    return origin;
  }
  return `${origin} → ${destination}`;
}

function formatManeuverRouteFromParts(
  origin: string | undefined,
  destination: string | undefined,
): string {
  if (!origin?.trim() && !destination?.trim()) {
    return '—';
  }
  return formatOperatorLastManeuverRoute({
    maneuverCode: '',
    origin,
    destination,
  });
}

export function buildOperatorsOverviewCard(operator: Operator): OperatorsOverviewCardView {
  const status = operator.status;
  const last = operator.lastManeuver;
  const onActiveService = status === 'in_use' && operator.activeService != null;
  const active = onActiveService ? operator.activeService : undefined;
  const route = onActiveService
    ? formatManeuverRouteFromParts(active?.origin, active?.destination)
    : formatOperatorLastManeuverRoute(last);
  const maneuverCode = onActiveService
    ? active?.maneuverCode?.trim() || '—'
    : last?.maneuverCode?.trim() || '—';
  const unitCode = active?.unitCode?.trim() || '';
  const maneuverMetaLabel = onActiveService
    ? unitCode || '—'
    : last?.occurredOn
      ? formatIsoDateEs(last.occurredOn)
      : '—';
  const activeUnitCodeBadge =
    onActiveService && unitCode && unitCode !== '—' ? unitCode : null;
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
    // Las cards siempre muestran iniciales; la foto solo vive en el drawer.
    photoUrl: null,
    photoInitials: operatorPhotoInitials(operator.name),
    maneuverPanelLabel: onActiveService ? 'En servicio ahora' : 'Última maniobra',
    lastManeuverCode: maneuverCode,
    lastManeuverRoute: route,
    maneuverMetaLabel,
    activeUnitCodeBadge,
    companyTenureLabel: `${companyTenureMonthsDaysLabelEs(operator.companyHireDate)} en la empresa`,
    owedAmountLabel: formatOwedAmount(operator.owedAmount),
    nextPayDueLabel: nextPayDueYmd ? formatIsoDateSlash(nextPayDueYmd) : null,
    nextPayDueVariant: operator.nextPayDueVariant ?? null,
    daysWithoutManeuverLabel: operatorDaysWithoutManeuver(
      last?.occurredOn,
      status,
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
    card.maneuverMetaLabel,
    card.maneuverPanelLabel,
    card.companyTenureLabel,
    card.owedAmountLabel,
    card.nextPayDueLabel,
    card.daysWithoutManeuverLabel,
  ]
    .map((v) => String(v ?? '').toLowerCase())
    .join(' ');
  return haystack.includes(q);
}
