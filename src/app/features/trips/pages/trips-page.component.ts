import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  model,
  OnInit,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import {
  TripsService as TripsApiService,
  type TripsListParams,
  type TripsListResponse,
} from '@services/api/trips';
import { maniobraListRowFromTrip } from '@features/trips/utils/maniobra-list-row';
import {
  debouncedTrimmedSearchQuery,
  EXPENSES_SEARCH_DEBOUNCE_MS,
} from '@features/expenses/utils/expenses-search-query.util';
import { TRIP_EVALUATION_PROVIDERS } from '@shared/services/trip-evaluation.providers';
import { Trip, TripStatus } from '@shared/models/logistics.models';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';
import {
  ToSegmentControlComponent,
  type ToSegmentTab,
} from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToFilterTabsComponent } from '@shared/ui/to-filter-tabs/to-filter-tabs.component';
import type { ToFilterTab } from '@shared/ui/to-filter-tabs/to-filter-tabs.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';
import { TripsDetailDrawerComponent } from '@features/trips/components/trips-detail-drawer/trips-detail-drawer.component';
import { ManiobraRouteMapComponent } from '@features/trips/components/maniobra-route-map/maniobra-route-map.component';
import { TripsNewDrawerComponent } from '@features/trips/components/trips-new-drawer/trips-new-drawer.component';
import { DestinationRatesFeatureService } from '@features/clients/services/destination-rates.service';
import { OperationalCentersFeatureService } from '@features/clients/services/operational-centers.service';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { TripsMapService } from '@features/trips/services/trips-map.service';
import { TripsMapStateFleetService } from '@features/trips/services/trips-map-state-fleet.service';
import { TripsFormCatalogService } from '@features/trips/services/trips-form-catalog.service';
import { TripsFeatureService } from '@features/trips/services/trips.service';
import { OPERATION_CONFIGURATION_PROVIDERS } from '@shared/services/operation-configuration.providers';

export type TripsStatusFilter = TripStatus | 'all';

export type TripsViewMode = 'route' | 'list';

@Component({
  selector: 'app-trips-page',
  standalone: true,
  providers: [
    TripsFeatureService,
    TripsMapService,
    TripsMapStateFleetService,
    TripsFormCatalogService,
    DestinationRatesFeatureService,
    OperationalCentersFeatureService,
    ...OPERATION_CONFIGURATION_PROVIDERS,
    ...TRIP_EVALUATION_PROVIDERS,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'maniobra-page-host',
  },
  imports: [
    ToPageHeaderComponent,
    ToTableComponent,
    ToSkeletonComponent,
    ToButtonComponent,
    ToInputComponent,
    ToFilterTabsComponent,
    ToSegmentControlComponent,
    TripsNewDrawerComponent,
    TripsDetailDrawerComponent,
    ManiobraRouteMapComponent,
  ],
  templateUrl: './trips-page.component.html',
  styleUrl: './trips-page.component.scss',
})
export class TripsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripsApi = inject(TripsApiService);
  protected readonly tripsFeature = inject(TripsFeatureService);
  protected readonly tripsMap = inject(TripsMapService);
  private readonly stateFleet = inject(TripsMapStateFleetService);
  private readonly formCatalog = inject(TripsFormCatalogService);
  private readonly destinationRates = inject(DestinationRatesFeatureService);
  private readonly operationalCenters = inject(OperationalCentersFeatureService);
  private readonly operationConfigs = inject(OperationConfigurationsFeatureService);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  private readonly searchField = viewChild<ToInputComponent>('searchField');
  private readonly searchKeepFocus = signal(false);

  private mapRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private listWasLoading = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopMapRefresh();
      this.tripsFeature.dispose();
      this.tripsMap.dispose();
      this.stateFleet.dispose();
      this.formCatalog.dispose();
      this.destinationRates.dispose();
      this.operationalCenters.dispose();
      this.operationConfigs.dispose();
    });

    debouncedTrimmedSearchQuery(
      toObservable(this.searchInput),
      EXPENSES_SEARCH_DEBOUNCE_MS,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.searchQuery.set(q));

    effect(() => {
      const mode = this.viewMode();
      const overlayOpen =
        this.newTripOpen() || this.tripsFeature.selectedTripId() != null;
      if (mode === 'route' && !overlayOpen) {
        this.tripsMap.resumeAfterOverlay();
        this.startMapRefresh();
        return;
      }
      this.stopMapRefresh();
      if (mode !== 'route') {
        this.stateFleet.clear();
      }
    });

    effect(() => {
      this.statusFilter();
      this.searchQuery();
      this.pageSize();
      untracked(() => this.pageIndex.set(0));
    });

    effect(() => {
      this.tripsFeature.listEpoch();
      untracked(() => {
        if (this.viewMode() === 'list') {
          void this.listResource.reload();
        }
      });
    });

    effect(() => {
      const loading = this.listResource.isLoading();
      this.listResource.value();
      const wasLoading = this.listWasLoading;
      this.listWasLoading = loading;
      if (loading || !this.searchKeepFocus() || !wasLoading) {
        return;
      }
      untracked(() => {
        requestAnimationFrame(() => {
          this.searchField()?.focus();
        });
      });
    });
  }

  readonly newTripOpen = signal(false);
  readonly canWriteTrips = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.TRIPS),
  );

  readonly viewMode = signal<TripsViewMode>('route');
  readonly viewSegmentTabs: readonly ToSegmentTab<TripsViewMode>[] = [
    { id: 'route', label: 'Ruta', icon: 'mapSearch', htmlId: 'maniobra-tab-route' },
    { id: 'list', label: 'Lista', icon: 'list', htmlId: 'maniobra-tab-list' },
  ];

  readonly statusFilter = signal<TripsStatusFilter>('all');

  readonly searchInput = model('');
  readonly searchQuery = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(15);
  readonly pageSizeOptions = [10, 15, 25, 50, 100] as const;

  readonly searchPending = computed(
    () => this.searchInput().trim() !== this.searchQuery(),
  );

  readonly listReloading = computed(
    () => this.listResource.isLoading() && this.listResource.hasValue(),
  );

  readonly listBusy = computed(
    () => this.searchPending() || this.listReloading(),
  );

  readonly listParams = computed((): TripsListParams => {
    const status = this.statusFilter();
    return {
      page: this.pageIndex() + 1,
      limit: this.pageSize(),
      ...(this.searchQuery() ? { q: this.searchQuery() } : {}),
      ...(status !== 'all' ? { status } : {}),
    };
  });

  private readonly listResource = resource<TripsListResponse, TripsListParams | undefined>({
    request: () => (this.viewMode() === 'list' ? this.listParams() : undefined),
    loader: async ({ request }): Promise<TripsListResponse> => {
      if (!request) {
        return {
          items: [],
          total: 0,
          page: 1,
          limit: this.pageSize(),
        };
      }
      const params = request;
      return firstValueFrom(
        this.tripsApi.getTripsPage(params).pipe(
          catchError(() =>
            of({
              items: [] as Trip[],
              total: 0,
              page: params.page ?? 1,
              limit: params.limit ?? 15,
            } satisfies TripsListResponse),
          ),
        ),
      );
    },
  });

  readonly initialListLoading = computed(
    () => !this.listResource.hasValue() && this.listResource.isLoading(),
  );

  readonly listTotal = computed(() => this.listResource.value()?.total ?? 0);
  readonly listTrips = computed(() => this.listResource.value()?.items ?? []);

  readonly tableRows = computed(() =>
    this.listTrips().map((t) => maniobraListRowFromTrip(t)),
  );

  readonly hasListRows = computed(() => this.tableRows().length > 0);

  readonly showEmptyHint = computed(
    () =>
      !this.initialListLoading() &&
      this.listResource.hasValue() &&
      !this.hasListRows(),
  );

  readonly filterTabs: ReadonlyArray<ToFilterTab<TripsStatusFilter>> = [
    { id: 'all', label: 'Todos', icon: 'grid' },
    { id: 'in_transit', label: tripStatusUiLabel('in_transit'), icon: 'truck' },
    { id: 'scheduled', label: tripStatusUiLabel('scheduled'), icon: 'calendar' },
    { id: 'completed', label: tripStatusUiLabel('completed'), icon: 'checkCircle' },
    { id: 'cancelled', label: tripStatusUiLabel('cancelled'), icon: 'cancelCircle' },
  ];

  readonly columns: ToTableColumn[] = [
    { key: 'code', label: 'Código', cell: 'nowrap' },
    { key: 'route', label: 'Ruta' },
    { key: 'clientName', label: 'Cliente' },
    { key: 'operatorName', label: 'Operador' },
    { key: 'unitId', label: 'Unidad', cell: 'muted-badge' },
    { key: 'status', label: 'Estado', cell: 'maniobra-status' },
    { key: 'departureAt', label: 'Salida', cell: 'datetime-stacked' },
    { key: 'arrivedAt', label: 'Llegada', cell: 'datetime-stacked' },
    { key: 'operationType', label: 'Configuración', cell: 'operation-type' },
    { key: 'hasIncident', label: 'Incidente', cell: 'incident-dot' },
  ];

  ngOnInit(): void {
    this.tripsFeature.loadTrips();
    this.openTripFromQuery(this.route.snapshot.queryParamMap.get('tripId'));
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const tripId = params.get('tripId');
        if (tripId) {
          this.openTripFromQuery(tripId);
        }
      });
  }

  onSearchFocusIn(): void {
    this.searchKeepFocus.set(true);
  }

  onSearchFocusOut(ev: FocusEvent): void {
    if (this.listReloading() || this.searchPending()) {
      return;
    }
    const related = ev.relatedTarget;
    const host = ev.currentTarget;
    if (related instanceof Node && host instanceof Node && host.contains(related)) {
      return;
    }
    this.searchKeepFocus.set(false);
  }

  private openTripFromQuery(tripId: string | null): void {
    const id = tripId?.trim();
    if (!id) {
      return;
    }
    this.viewMode.set('list');
    this.tripsFeature.selectTrip(id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tripId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onStatusFilterSelect(value: TripsStatusFilter): void {
    if (value === this.statusFilter()) {
      return;
    }
    this.pageIndex.set(0);
    this.statusFilter.set(value);
  }

  onTripRowClick(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    if (!id) {
      return;
    }
    this.tripsFeature.selectTrip(id);
  }

  onMapTripSelect(tripId: string): void {
    this.tripsFeature.selectTrip(tripId);
  }

  private startMapRefresh(): void {
    if (this.mapRefreshTimer != null) {
      return;
    }
    this.mapRefreshTimer = setInterval(() => {
      const overlayOpen =
        this.newTripOpen() || this.tripsFeature.selectedTripId() != null;
      if (this.viewMode() === 'route' && !overlayOpen) {
        this.tripsMap.refresh({ silent: true });
      }
    }, 90_000);
  }

  private stopMapRefresh(): void {
    if (this.mapRefreshTimer == null) {
      return;
    }
    clearInterval(this.mapRefreshTimer);
    this.mapRefreshTimer = null;
  }

  onDetailDismiss(): void {
    this.tripsFeature.clearSelection();
  }

  onTripCreated(_trip: Trip): void {
    this.toast.show('Maniobra programada.', 'success');
    this.newTripOpen.set(false);
    void this.listResource.reload();
  }
}
