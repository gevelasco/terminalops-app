import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  model,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, firstValueFrom, map } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { ClientsBalanceOverviewComponent } from '@features/clients/components/clients-balance-overview/clients-balance-overview.component';
import { ClientsDetailDrawerComponent } from '@features/clients/components/clients-detail-drawer/clients-detail-drawer.component';
import { ClientsNewDrawerComponent } from '@features/clients/components/clients-new-drawer/clients-new-drawer.component';
import { DestinationRatesDetailDrawerComponent } from '@features/clients/components/destination-rates-detail-drawer/destination-rates-detail-drawer.component';
import { DestinationRatesMapComponent } from '@features/clients/components/destination-rates-map/destination-rates-map.component';
import { DestinationRatesNewDrawerComponent } from '@features/clients/components/destination-rates-new-drawer/destination-rates-new-drawer.component';
import { ClientsFeatureService } from '@features/clients/services/clients.service';
import { ClientsBalanceContextService } from '@features/clients/services/clients-balance-context.service';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { OperationalCentersFeatureService } from '@features/clients/services/operational-centers.service';
import { OPERATION_CONFIGURATION_PROVIDERS } from '@shared/services/operation-configuration.providers';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import {
  buildClientBalanceOverviewCards,
  clientBalanceOverviewMatchesQuery,
  compareClientBalanceOverviewCards,
} from '@features/clients/utils/client-balance-overview-card.util';
import {
  buildDestinationRateCatalogExportRows,
  buildDestinationRatesCatalogCsv,
  downloadDestinationRatesCatalogCsv,
} from '@features/clients/utils/destination-rates-export-csv';
import {
  buildDestinationRateStateById,
  filterDestinationRatesByQuery,
} from '@features/clients/utils/destination-rates-map-search';
import type { MexicoStatesGeoJson } from '@features/trips/utils/trips-map-state-activity';
import { SessionService } from '@core/services/state/session';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import type { Client } from '@shared/models/client.models';
import type { DestinationRate } from '@shared/models/destination-rate.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import {
  ToSegmentControlComponent,
  type ToSegmentTab,
} from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';

export type ClientsPageTab = 'clients' | 'destination-rates';

const COMERCIAL_TABS = new Set<ClientsPageTab>(['clients', 'destination-rates']);

function resolveComercialTab(raw: string | null | undefined): ClientsPageTab {
  const tab = raw?.trim() as ClientsPageTab | undefined;
  return tab && COMERCIAL_TABS.has(tab) ? tab : 'clients';
}

/** Espera tras dejar de escribir antes de filtrar el listado. */
const CLIENTS_SEARCH_DEBOUNCE_MS = 1000;

@Component({
  selector: 'app-clients-page',
  standalone: true,
  host: {
    class: 'clients-page-host',
  },
  providers: [
    ClientsFeatureService,
    ClientsBalanceContextService,
    DestinationRatesFeatureService,
    OperationalCentersFeatureService,
    ...OPERATION_CONFIGURATION_PROVIDERS,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToPageHeaderComponent,
    ToInputComponent,
    ToSkeletonComponent,
    ToButtonComponent,
    ToIconComponent,
    ToSegmentControlComponent,
    ClientsNewDrawerComponent,
    ClientsDetailDrawerComponent,
    ClientsBalanceOverviewComponent,
    DestinationRatesNewDrawerComponent,
    DestinationRatesDetailDrawerComponent,
    DestinationRatesMapComponent,
  ],
  templateUrl: './clients-page.component.html',
  styleUrl: './clients-page.component.scss',
})
export class ClientsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  protected readonly clientsFeature = inject(ClientsFeatureService);
  protected readonly ratesFeature = inject(DestinationRatesFeatureService);
  private readonly operationConfigsFeature = inject(
    OperationConfigurationsFeatureService,
  );
  private readonly balanceContext = inject(ClientsBalanceContextService);
  private readonly session = inject(SessionService);

  private mexicoGeoJson: MexicoStatesGeoJson | null = null;
  private mexicoGeoLoad: Promise<MexicoStatesGeoJson | null> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clientsFeature.dispose();
      this.ratesFeature.dispose();
      this.operationConfigsFeature.dispose();
      this.balanceContext.dispose();
    });

    toObservable(this.searchInput)
      .pipe(
        debounceTime(CLIENTS_SEARCH_DEBOUNCE_MS),
        map((q) => q.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((q) => this.searchQuery.set(q));

    effect(() => {
      const id = this.pendingClientId();
      if (!id || this.clientsFeature.loading()) {
        return;
      }
      this.clientsFeature.selectClient(id);
      if (this.clientsFeature.selectedClient()) {
        this.pendingClientId.set(null);
      }
    });

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.applyComercialTabFromRoute(params.get('comercialTab'));
      });
  }

  private readonly pendingClientId = signal<string | null>(null);

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

  readonly loading = computed(
    () =>
      this.clientsFeature.loading() || this.balanceContext.overviewLoading(),
  );

  readonly searchInput = model('');
  protected readonly searchQuery = signal('');
  readonly ratesExporting = signal(false);

  readonly searchPending = computed(
    () => this.searchInput().trim() !== this.searchQuery(),
  );

  readonly newClientOpen = signal(false);
  readonly newRateOpen = signal(false);
  readonly canWriteCommercial = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.CLIENTS),
  );

  readonly balanceOverviewCards = computed(() =>
    buildClientBalanceOverviewCards(
      this.clientsFeature.clients(),
      this.balanceContext.overviewByClientId(),
    ).sort(compareClientBalanceOverviewCards),
  );

  readonly displayedBalanceCards = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.balanceOverviewCards();
    if (!q) {
      return all;
    }
    return all.filter((card) => clientBalanceOverviewMatchesQuery(card, q));
  });

  readonly hasBalanceCards = computed(
    () => this.displayedBalanceCards().length > 0,
  );

  readonly showClientsEmptyHint = computed(
    () => !this.loading() && !this.hasBalanceCards(),
  );

  ngOnInit(): void {
    this.applyComercialTabFromRoute(
      this.route.snapshot.paramMap.get('comercialTab'),
    );
    this.openClientFromQuery(this.route.snapshot.queryParamMap.get('clientId'));
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.openClientFromQuery(params.get('clientId'));
      });
  }

  private applyComercialTabFromRoute(rawTab: string | null): void {
    const tab = resolveComercialTab(rawTab);
    if (rawTab != null && rawTab.trim() !== tab) {
      void this.router.navigate(['/comercial', tab], {
        replaceUrl: true,
        queryParamsHandling: 'preserve',
      });
      return;
    }
    if (this.pageTab() === tab) {
      if (tab === 'clients') {
        this.ensureClientsTabLoaded();
      } else {
        this.ensureDestinationRatesTabLoaded();
      }
      return;
    }
    this.pageTab.set(tab);
    this.searchInput.set('');
    this.searchQuery.set('');
    this.clientsFeature.clearSelection();
    this.ratesFeature.clearSelection();
    if (tab === 'clients') {
      this.ensureClientsTabLoaded();
    } else {
      this.ensureDestinationRatesTabLoaded();
    }
  }

  private openClientFromQuery(clientId: string | null): void {
    const id = clientId?.trim();
    if (!id) {
      return;
    }
    if (this.pageTab() !== 'clients') {
      void this.router.navigate(['/comercial/clients'], {
        queryParams: { clientId: id },
        replaceUrl: true,
      });
      return;
    }
    this.ensureClientsTabLoaded();
    this.pendingClientId.set(id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { clientId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Clientes: catálogo + overview de cartera. */
  private ensureClientsTabLoaded(): void {
    this.clientsFeature.loadClients();
    this.balanceContext.ensureOverviewLoaded();
  }

  /** Lazy: tarifas + catálogo operativo al entrar por primera vez a Tarifas. */
  private ensureDestinationRatesTabLoaded(): void {
    this.ratesFeature.loadDestinationRates();
    this.operationConfigsFeature.loadOperationConfigurations();
  }

  onPageTabSelect(tab: ClientsPageTab): void {
    if (this.pageTab() === tab) {
      return;
    }
    void this.router.navigate(['/comercial', tab], {
      queryParamsHandling: 'preserve',
    });
  }

  onBalanceCardSelect(clientId: string): void {
    this.openClientDrawer(clientId);
  }

  private openClientDrawer(clientId: string): void {
    this.balanceContext.ensureClientBalanceLoaded(clientId);
    this.clientsFeature.selectClient(clientId);
  }

  onClientDetailDismiss(): void {
    this.clientsFeature.clearSelection();
  }

  onRateDetailDismiss(): void {
    this.ratesFeature.clearSelection();
  }

  onMapRateSelect(rateId: string): void {
    this.ratesFeature.selectRate(rateId);
  }

  onClientCreated(_c: Client): void {
    this.newClientOpen.set(false);
    this.balanceContext.invalidateBalances();
    this.balanceContext.ensureOverviewLoaded();
  }

  onRateCreated(_r: DestinationRate): void {
    this.newRateOpen.set(false);
  }

  onOpenExistingRate(rate: DestinationRate): void {
    this.newRateOpen.set(false);
    this.ratesFeature.selectRate(rate.id, rate);
  }

  exportRatesCatalog(): void {
    void this.runRatesCatalogExport();
  }

  private async runRatesCatalogExport(): Promise<void> {
    if (this.ratesExporting()) {
      return;
    }
    const allRates = this.ratesFeature.rates();
    if (allRates.length === 0) {
      this.toast.show('No hay tarifas para exportar.', 'warning');
      return;
    }

    this.ratesExporting.set(true);
    try {
      const geo = await this.ensureMexicoGeoJson();
      const stateByAll = buildDestinationRateStateById(allRates, geo);
      const filtered = filterDestinationRatesByQuery(
        allRates,
        this.searchInput(),
        geo,
        stateByAll,
      );
      if (filtered.length === 0) {
        this.toast.show(
          'No hay tarifas para exportar con los filtros actuales.',
          'warning',
        );
        return;
      }

      const stateById = buildDestinationRateStateById(filtered, geo);
      const rows = buildDestinationRateCatalogExportRows(filtered, stateById);
      const csv = buildDestinationRatesCatalogCsv(rows);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadDestinationRatesCatalogCsv(csv, `tarifas_catalogo_${stamp}.csv`);
      this.toast.show(`Exportadas ${rows.length} filas de tarifas.`, 'success');
    } catch {
      this.toast.show('No se pudo exportar el catálogo de tarifas.', 'error');
    } finally {
      this.ratesExporting.set(false);
    }
  }

  private async ensureMexicoGeoJson(): Promise<MexicoStatesGeoJson | null> {
    if (this.mexicoGeoJson) {
      return this.mexicoGeoJson;
    }
    if (!this.mexicoGeoLoad) {
      this.mexicoGeoLoad = firstValueFrom(
        this.http.get<MexicoStatesGeoJson>('/geo/mexico-states.json'),
      )
        .then((geo) => {
          this.mexicoGeoJson = geo;
          return geo;
        })
        .catch(() => null);
    }
    return this.mexicoGeoLoad;
  }
}
