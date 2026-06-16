import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  model,
  OnInit,
  signal,
} from '@angular/core';
import { ClientsDetailDrawerComponent } from '@features/clients/components/clients-detail-drawer/clients-detail-drawer.component';
import { ClientsNewDrawerComponent } from '@features/clients/components/clients-new-drawer/clients-new-drawer.component';
import { DestinationRatesDetailDrawerComponent } from '@features/clients/components/destination-rates-detail-drawer/destination-rates-detail-drawer.component';
import { DestinationRatesNewDrawerComponent } from '@features/clients/components/destination-rates-new-drawer/destination-rates-new-drawer.component';
import { ClientsFeatureService } from '@features/clients/services/clients.service';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { OperationalCentersFeatureService } from '@features/clients/services/operational-centers.service';
import { formatDestinationRateEstimatedTimeDisplay } from '@features/clients/utils/destination-rate-estimated-time';
import {
  formatDestinationRateDestinationCell,
  formatDestinationRateOriginCell,
} from '@features/clients/utils/destination-rate-payload';
import { OperationConfigurationResolverService } from '@shared/services/operation-configuration-resolver.service';
import { operationConfigRateTableBadgeClass } from '@shared/utils/operation-configuration-display.utils';
import { OPERATION_CONFIGURATION_PROVIDERS } from '@shared/services/operation-configuration.providers';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { clientCommercialHealthLabel } from '@shared/catalogs/client-form-options';
import type { Client } from '@shared/models/client.models';
import type { DestinationRate } from '@shared/models/destination-rate.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import {
  ToSegmentControlComponent,
  type ToSegmentTab,
} from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
  type ToTableOperationTypeBadge,
} from '@shared/ui/to-table/to-table.component';

export type ClientsPageTab = 'clients' | 'destination-rates';

function formatRelationshipDateEs(ymd: string | undefined): string {
  const t = (ymd ?? '').trim();
  if (!t) {
    return '—';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return t;
  }
  const d = new Date(`${t}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return t;
  }
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(d);
}

@Component({
  selector: 'app-clients-page',
  standalone: true,
  providers: [
    ClientsFeatureService,
    DestinationRatesFeatureService,
    OperationalCentersFeatureService,
    ...OPERATION_CONFIGURATION_PROVIDERS,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToPageHeaderComponent,
    ToInputComponent,
    ToTableComponent,
    ToSkeletonComponent,
    ToButtonComponent,
    ToSegmentControlComponent,
    ClientsNewDrawerComponent,
    ClientsDetailDrawerComponent,
    DestinationRatesNewDrawerComponent,
    DestinationRatesDetailDrawerComponent,
  ],
  templateUrl: './clients-page.component.html',
  styleUrl: './clients-page.component.scss',
})
export class ClientsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly clientsFeature = inject(ClientsFeatureService);
  protected readonly ratesFeature = inject(DestinationRatesFeatureService);
  protected readonly centersFeature = inject(OperationalCentersFeatureService);
  private readonly operationConfigsFeature = inject(OperationConfigurationsFeatureService);
  private readonly opResolver = inject(OperationConfigurationResolverService);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clientsFeature.dispose();
      this.ratesFeature.dispose();
      this.centersFeature.dispose();
      this.operationConfigsFeature.dispose();
    });
  }

  readonly pageTab = signal<ClientsPageTab>('clients');
  readonly viewSegmentTabs: readonly ToSegmentTab<ClientsPageTab>[] = [
    {
      id: 'clients',
      label: 'Clientes',
      icon: 'client',
      htmlId: 'clients-tab-clients',
    },
    {
      id: 'destination-rates',
      label: 'Tarifas',
      icon: 'sell',
      htmlId: 'clients-tab-destination-rates',
    },
  ];

  readonly loading = computed(() =>
    this.pageTab() === 'clients'
      ? this.clientsFeature.loading()
      : this.ratesFeature.loading() || this.operationConfigsFeature.loading(),
  );

  readonly clientRows = computed(() =>
    this.clientsFeature
      .clients()
      .map((c) => ClientsPageComponent.mapClientRow(c)),
  );
  readonly rateRows = computed(() =>
    this.ratesFeature.rates().map((r) => this.mapRateRow(r)),
  );

  readonly searchQuery = model('');
  readonly newClientOpen = signal(false);
  readonly newRateOpen = signal(false);

  readonly clientColumns: ToTableColumn[] = [
    { key: 'name', label: 'Cliente' },
    { key: 'rfc', label: 'RFC', cell: 'muted-badge' },
    {
      key: 'relationshipLabel',
      label: 'Sociedad desde',
    },
    {
      key: 'commercialHealth',
      label: 'Estatus',
      cell: 'client-health-pill',
    },
    { key: 'maneuverCount', label: 'Maniobras' },
  ];

  readonly rateColumns: ToTableColumn[] = [
    { key: 'originSummary', label: 'Origen', cell: 'datetime-stacked' },
    { key: 'destinationSummary', label: 'Destino', cell: 'datetime-stacked' },
    { key: 'operationTypeBadges', label: 'Tipos de Maniobra', cell: 'operation-type-badges' },
    { key: 'estimatedArrivalTime', label: 'Tiempo ida' },
    { key: 'estimatedReturnTime', label: 'Tiempo completo' },
    { key: 'rateAvailability', label: 'Estatus', cell: 'rate-availability-pill' },
    { key: 'maneuverCount', label: 'Maniobras' },
  ];

  readonly displayedClientRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.clientRows();
    if (!q) {
      return all;
    }
    return all.filter((row) =>
      ClientsPageComponent.clientRowMatchesQuery(row, q),
    );
  });

  readonly displayedRateRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.rateRows();
    if (!q) {
      return all;
    }
    return all.filter((row) =>
      ClientsPageComponent.rateRowMatchesQuery(row, q),
    );
  });

  ngOnInit(): void {
    this.clientsFeature.loadClients();
    this.centersFeature.loadOperationalCenters();
  }

  /** Lazy: tarifas + catálogo operativo solo al entrar por primera vez a la tab Tarifas. */
  private ensureDestinationRatesTabLoaded(): void {
    this.centersFeature.loadOperationalCenters();
    this.ratesFeature.loadDestinationRates();
    this.operationConfigsFeature.loadOperationConfigurations();
  }

  onPageTabSelect(tab: ClientsPageTab): void {
    this.pageTab.set(tab);
    this.searchQuery.set('');
    if (tab === 'clients') {
      this.ratesFeature.clearSelection();
    } else {
      this.clientsFeature.clearSelection();
      this.ensureDestinationRatesTabLoaded();
    }
  }

  onClientRowClick(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    if (!id) {
      return;
    }
    this.clientsFeature.selectClient(id);
  }

  onRateRowClick(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    if (!id) {
      return;
    }
    this.ratesFeature.selectRate(id);
  }

  onClientDetailDismiss(): void {
    this.clientsFeature.clearSelection();
  }

  onRateDetailDismiss(): void {
    this.ratesFeature.clearSelection();
  }

  onClientCreated(_c: Client): void {
    this.newClientOpen.set(false);
  }

  onRateCreated(_r: DestinationRate): void {
    this.newRateOpen.set(false);
  }

  onOpenExistingRate(rate: DestinationRate): void {
    this.newRateOpen.set(false);
    this.ratesFeature.selectRate(rate.id, rate);
  }

  private static clientRowMatchesQuery(
    row: Record<string, unknown>,
    q: string,
  ): boolean {
    const healthCode = row['commercialHealth'];
    const healthLabel =
      typeof healthCode === 'string'
        ? clientCommercialHealthLabel(healthCode).toLowerCase()
        : '';
    const haystack = [
      row['id'],
      row['name'],
      row['rfc'],
      row['relationshipLabel'],
      healthCode,
      healthLabel,
      row['maneuverCount'],
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');
    return haystack.includes(q);
  }

  private static rateRowMatchesQuery(
    row: Record<string, unknown>,
    q: string,
  ): boolean {
    const originHaystack = ClientsPageComponent.stackedCellHaystack(row['originSummary']);
    const destinationHaystack = ClientsPageComponent.stackedCellHaystack(
      row['destinationSummary'],
    );
    const badgesHaystack = ClientsPageComponent.operationTypeBadgesHaystack(
      row['operationTypeBadges'],
    );
    const haystack = [
      row['id'],
      originHaystack,
      destinationHaystack,
      badgesHaystack,
      row['maneuverCount'],
      row['estimatedArrivalTime'],
      row['estimatedReturnTime'],
      row['rateAvailability'],
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');
    return haystack.includes(q);
  }

  private static mapClientRow(c: Client): Record<string, unknown> {
    return {
      id: c.id,
      name: c.name,
      rfc: c.rfc?.trim() || '—',
      relationshipLabel: formatRelationshipDateEs(c.relationshipStartedOn),
      commercialHealth:
        (c.payment?.commercialHealth as string | undefined) ?? 'not_evaluated',
      maneuverCount: String(c.maneuverCount ?? 0),
    };
  }

  private mapRateRow(r: DestinationRate): Record<string, unknown> {
    const seen = new Set<string>();
    const operationTypeBadges: ToTableOperationTypeBadge[] = [];
    for (const price of r.prices) {
      const ctx = this.opResolver.contextFromRatePrice(price);
      const label = this.opResolver.resolveLabel(ctx);
      if (label === 'Configuración desconocida') {
        continue;
      }
      const dedupeKey = ctx.operationConfigurationId?.trim() || label.toLowerCase();
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      operationTypeBadges.push({
        label,
        badgeClass: operationConfigRateTableBadgeClass(label, ctx.code),
      });
    }
    return {
      id: r.id,
      originSummary: formatDestinationRateOriginCell(r),
      destinationSummary: formatDestinationRateDestinationCell(r),
      operationTypeBadges,
      estimatedArrivalTime: formatDestinationRateEstimatedTimeDisplay(
        r.estimatedArrivalTimeValue,
        r.estimatedTimeUnit,
      ),
      estimatedReturnTime: formatDestinationRateEstimatedTimeDisplay(
        r.estimatedReturnTimeValue,
        r.estimatedTimeUnit,
      ),
      maneuverCount: String(r.maneuverCount ?? 0),
      rateAvailability: r.active ? 'available' : 'inactive',
    };
  }

  private static operationTypeBadgesHaystack(value: unknown): string {
    if (!Array.isArray(value)) {
      return '';
    }
    return value
      .map((item) =>
        item != null && typeof item === 'object'
          ? String((item as ToTableOperationTypeBadge).label ?? '')
          : '',
      )
      .join(' ');
  }

  private static stackedCellHaystack(value: unknown): string {
    if (value != null && typeof value === 'object') {
      return [
        (value as { date?: unknown }).date,
        (value as { time?: unknown }).time,
      ]
        .map((v) => String(v ?? ''))
        .join(' ');
    }
    return String(value ?? '');
  }
}
