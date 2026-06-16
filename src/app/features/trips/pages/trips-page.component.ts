import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  model,
  signal,
  OnInit,
} from '@angular/core';
import { ToastService } from '@core/notifications/toast.service';
import {
  maniobraListRowFromTrip,
  maniobraListRowMatchesSearch,
} from '@features/trips/utils/maniobra-list-row';
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
import { TripsMapService } from '@features/trips/services/trips-map.service';
import { TripsMapStateFleetService } from '@features/trips/services/trips-map-state-fleet.service';
import { TripsFeatureService } from '@features/trips/services/trips.service';

export type TripsStatusFilter = TripStatus | 'all';

export type TripsViewMode = 'route' | 'list';

@Component({
  selector: 'app-trips-page',
  standalone: true,
  providers: [TripsFeatureService, TripsMapService, TripsMapStateFleetService, ...TRIP_EVALUATION_PROVIDERS],
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
  protected readonly tripsFeature = inject(TripsFeatureService);
  protected readonly tripsMap = inject(TripsMapService);
  private readonly stateFleet = inject(TripsMapStateFleetService);
  private readonly toast = inject(ToastService);
  readonly loading = this.tripsFeature.loading;

  private mapRefreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopMapRefresh();
      this.tripsFeature.dispose();
      this.tripsMap.dispose();
      this.stateFleet.dispose();
    });

    effect(() => {
      const mode = this.viewMode();
      if (mode === 'route') {
        this.tripsMap.load();
        this.startMapRefresh();
        return;
      }
      this.stopMapRefresh();
      this.stateFleet.clear();
    });
  }

  readonly newTripOpen = signal(false);

  readonly viewMode = signal<TripsViewMode>('route');
  readonly viewSegmentTabs: readonly ToSegmentTab<TripsViewMode>[] = [
    { id: 'route', label: 'Ruta', icon: 'mapSearch', htmlId: 'maniobra-tab-route' },
    { id: 'list', label: 'Lista', icon: 'list', htmlId: 'maniobra-tab-list' },
  ];

  readonly rows = computed(() => {
    const trips = this.tripsFeature.trips();
    return trips.map((t) => maniobraListRowFromTrip(t));
  });

  readonly statusFilter = signal<TripsStatusFilter>('all');

  readonly searchQuery = model('');

  readonly filterTabs: ReadonlyArray<ToFilterTab<TripsStatusFilter>> = [
    { id: 'all', label: 'Todos', icon: 'grid' },
    { id: 'in_transit', label: tripStatusUiLabel('in_transit'), icon: 'truck' },
    { id: 'scheduled', label: tripStatusUiLabel('scheduled'), icon: 'calendar' },
    { id: 'completed', label: tripStatusUiLabel('completed'), icon: 'checkCircle' },
    { id: 'cancelled', label: tripStatusUiLabel('cancelled'), icon: 'cancelCircle' },
  ];

  readonly filteredRows = computed(() => {
    const list = this.rows();
    const f = this.statusFilter();
    const byStatus =
      f === 'all' ? list : list.filter((row) => row['status'] === f);
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) {
      return byStatus;
    }
    return byStatus.filter((row) => maniobraListRowMatchesSearch(row, q));
  });

  readonly filteredMapItems = computed(() => {
    const items = this.tripsMap.items();
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter(
      (item) =>
        item.maneuverCode.toLowerCase().includes(q) ||
        item.origin.label.toLowerCase().includes(q) ||
        item.destination.label.toLowerCase().includes(q),
    );
  });

  readonly columns: ToTableColumn[] = [
    { key: 'code', label: 'Código' },
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
  }

  onStatusFilterSelect(value: TripsStatusFilter): void {
    if (this.viewMode() !== 'list') {
      return;
    }
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
      if (this.viewMode() === 'route') {
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
  }
}
