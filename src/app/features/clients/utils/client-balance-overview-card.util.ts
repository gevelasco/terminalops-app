import {
  clientBalanceCollectionStatus,
  clientBalanceHighlightedPayment,
  emptyClientBalanceSummary,
  formatClientBalanceMoney,
  type ClientBalanceSummary,
} from '@features/clients/utils/client-balance-summary';
import { deriveClientCommercialHealthFromSummary } from '@features/clients/utils/client-commercial-status.util';
import { clientCommercialHealthLabel } from '@shared/catalogs/client-form-options';
import { clientCommercialPillClass } from '@shared/utils/client-commercial-pill';
import { maneuverCodePrefixFromClientName } from '@shared/utils/maneuver-code.util';
import type { Client } from '@shared/models/client.models';
import type { ToBadgeVariant } from '@shared/ui/to-badge/to-badge.component';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';

export interface ClientBalanceOverviewCardView {
  id: string;
  name: string;
  codePrefix: string;
  maneuverCountLabel: string;
  pendingBalanceLabel: string;
  pendingBalance: number;
  statusLabel: string;
  statusVariant: ToBadgeVariant;
  statusIcon: ToIconName | null;
  commercialStatusLabel: string;
  commercialStatusPillClass: string;
  footerLabel: string;
  footerDateLabel: string;
  footerAmountLabel: string;
}

/** Proyección visual de un `ClientBalanceSummary` ya calculado. */
export function buildClientBalanceOverviewCard(
  client: Client,
  balance: ClientBalanceSummary,
): ClientBalanceOverviewCardView {
  const status = clientBalanceCollectionStatus(balance);
  const payment = clientBalanceHighlightedPayment(balance);
  const commercialHealth = deriveClientCommercialHealthFromSummary(balance);

  return {
    id: client.id,
    name: client.name,
    codePrefix: maneuverCodePrefixFromClientName(client.name),
    maneuverCountLabel: balance.completedCount.toLocaleString('es-MX'),
    pendingBalance: balance.receivable,
    pendingBalanceLabel: formatClientBalanceMoney(balance.receivable),
    statusLabel: status.label,
    statusVariant: status.variant,
    statusIcon: status.icon,
    commercialStatusLabel: clientCommercialHealthLabel(commercialHealth),
    commercialStatusPillClass: clientCommercialPillClass(commercialHealth),
    footerLabel: payment.sectionLabel,
    footerDateLabel: payment.dueLabel,
    footerAmountLabel: payment.amountLabel,
  };
}

export function buildClientBalanceOverviewCards(
  clients: readonly Client[],
  summariesByClientId: Readonly<Record<string, ClientBalanceSummary>>,
): ClientBalanceOverviewCardView[] {
  return clients.map((client) => {
    const balance = summariesByClientId[client.id] ?? emptyClientBalanceSummary();
    return buildClientBalanceOverviewCard(client, balance);
  });
}

export function clientBalanceOverviewMatchesQuery(
  card: ClientBalanceOverviewCardView,
  q: string,
): boolean {
  const haystack = [
    card.id,
    card.name,
    card.codePrefix,
    card.maneuverCountLabel,
    card.pendingBalanceLabel,
    card.statusLabel,
    card.commercialStatusLabel,
    card.footerDateLabel,
    card.footerAmountLabel,
  ]
    .map((v) => String(v ?? '').toLowerCase())
    .join(' ');
  return haystack.includes(q);
}

export function compareClientBalanceOverviewCards(
  a: ClientBalanceOverviewCardView,
  b: ClientBalanceOverviewCardView,
): number {
  if (b.pendingBalance !== a.pendingBalance) {
    return b.pendingBalance - a.pendingBalance;
  }
  return a.name.localeCompare(b.name, 'es');
}
