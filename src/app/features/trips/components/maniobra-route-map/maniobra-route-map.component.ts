import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import type { ECElementEvent, EChartsType } from 'echarts/core';
import type { TripMapItem, TripsMapMeta } from '@shared/models/api/api-trips-map.model';
import { FleetOverviewCardComponent } from '@features/fleet/components/fleet-overview-card/fleet-overview-card.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToKpiCardComponent } from '@shared/ui/to-kpi-card/to-kpi-card.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import { TripsMapStateFleetService } from '@features/trips/services/trips-map-state-fleet.service';
import { OsrmDrivingRouteService } from '@shared/services/osrm-driving-route.service';
import { ensureTripsMapEchartsModules } from '@features/trips/utils/trips-map-chart-modules';
import {
  TRIPS_MAP_GEO_NAME,
  buildTripsMapEchartsOption,
  type TripMapRouteGeometryById,
  type TripsMapPointDatum,
  type TripsMapRouteDatum,
} from '@features/trips/utils/trips-map-echarts-option';
import { uniqueTripMapRoutePairs } from '@features/trips/utils/trips-map-route-geometry';
import {
  countTripsMapActiveDestinationStates,
  tripIdsByDestinationState,
  type MexicoStatesGeoJson,
} from '@features/trips/utils/trips-map-state-activity';
import {
  countManeuversByDestinationStateBreakdown,
} from '@features/trips/utils/trips-map-state-tooltip';
import { countTripsMapByStatus } from '@features/trips/utils/trips-map-viewport.util';
import {
  EMPTY_MEXICO_HIGHWAYS,
  parseMexicoHighwaysJson,
  type MexicoHighwaysJson,
} from '@features/trips/utils/trips-map-highways.util';

@Component({
  selector: 'app-maniobra-route-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToSkeletonComponent,
    ToKpiCardComponent,
    ToButtonComponent,
    ToIconComponent,
    FleetOverviewCardComponent,
  ],
  templateUrl: './maniobra-route-map.component.html',
  styleUrl: './maniobra-route-map.component.scss',
})
export class ManiobraRouteMapComponent implements AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly osrm = inject(OsrmDrivingRouteService);
  protected readonly stateFleet = inject(TripsMapStateFleetService);

  @ViewChild('chartHost', { static: true })
  private readonly chartHost!: ElementRef<HTMLDivElement>;

  readonly items = input.required<readonly TripMapItem[]>();
  readonly meta = input<TripsMapMeta | null>(null);
  readonly loading = input(false);
  readonly error = input(false);

  readonly tripSelect = output<string>();

  readonly statusCounts = computed(() => countTripsMapByStatus(this.items()));
  readonly activeStateCount = computed(() =>
    countTripsMapActiveDestinationStates(this.items(), this.geoJsonSignal()),
  );
  readonly geoReady = signal(false);
  readonly geoLoadFailed = signal(false);

  private chart: EChartsType | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private geoRegistered = false;
  private geoJson: MexicoStatesGeoJson | null = null;
  private readonly geoJsonSignal = signal<MexicoStatesGeoJson | null>(null);
  private highways: MexicoHighwaysJson = EMPTY_MEXICO_HIGHWAYS;
  private readonly routeGeometries = signal<TripMapRouteGeometryById>(
    new Map(),
  );

  constructor() {
    effect(() => {
      this.items();
      this.routeGeometries();
      if (this.chart && this.geoRegistered) {
        this.renderChart();
      }
    });

    effect((onCleanup) => {
      const items = this.items();
      const pairs = uniqueTripMapRoutePairs(items);
      const activeIds = new Set(items.map((item) => item.id));
      untracked(() => this.pruneRouteGeometries(activeIds));
      if (pairs.length === 0) {
        return;
      }

      const subs: Subscription[] = [];
      for (const pair of pairs) {
        const sub = this.osrm.drivingRoute(pair.from, pair.to).subscribe((route) => {
          const coords = route?.coordinates;
          if (!coords || coords.length < 2) {
            return;
          }
          this.routeGeometries.update((prev) => {
            const next = new Map(prev);
            for (const tripId of pair.tripIds) {
              next.set(tripId, coords);
            }
            return next;
          });
        });
        subs.push(sub);
      }

      onCleanup(() => {
        for (const sub of subs) {
          sub.unsubscribe();
        }
      });
    });
  }

  private pruneRouteGeometries(activeIds: ReadonlySet<string>): void {
    this.routeGeometries.update((prev) => {
      let stale = false;
      for (const id of prev.keys()) {
        if (!activeIds.has(id)) {
          stale = true;
          break;
        }
      }
      if (!stale) {
        return prev;
      }
      const next = new Map<string, ReadonlyArray<readonly [number, number]>>();
      for (const [id, coords] of prev) {
        if (activeIds.has(id)) {
          next.set(id, coords);
        }
      }
      return next;
    });
  }

  ngAfterViewInit(): void {
    void this.bootstrapChart();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.chart?.dispose();
    this.chart = null;
  }

  private async bootstrapChart(): Promise<void> {
    try {
      await this.registerMexicoMap();
      const echarts = ensureTripsMapEchartsModules();
      this.chart = echarts.init(this.chartHost.nativeElement);
      this.renderChart();
      this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
      this.resizeObserver.observe(this.chartHost.nativeElement);
      this.geoReady.set(true);
    } catch {
      this.geoLoadFailed.set(true);
    }
  }

  private async registerMexicoMap(): Promise<void> {
    const [geo, highwaysRaw] = await Promise.all([
      firstValueFrom(
        this.http
          .get<Record<string, unknown>>('/geo/mexico-states.json')
          .pipe(takeUntilDestroyed(this.destroyRef)),
      ),
      firstValueFrom(
        this.http
          .get<unknown>('/geo/mexico-highways.json')
          .pipe(takeUntilDestroyed(this.destroyRef)),
      ).catch(() => null),
    ]);
    ensureTripsMapEchartsModules().registerMap(TRIPS_MAP_GEO_NAME, geo as never);
    this.geoJson = geo as unknown as MexicoStatesGeoJson;
    this.geoJsonSignal.set(this.geoJson);
    this.highways = parseMexicoHighwaysJson(highwaysRaw);
    this.geoRegistered = true;
  }

  private renderChart(): void {
    if (!this.chart) {
      return;
    }
    this.chart.setOption(
      buildTripsMapEchartsOption(
        this.items(),
        this.geoJson,
        this.routeGeometries(),
        this.highways,
      ),
      true,
    );
    this.chart.off('click');
    this.chart.on('click', (event: ECElementEvent) => {
      if (this.isDestinationPoint(event.data)) {
        return;
      }

      if (event.componentType === 'geo' && event.name) {
        this.onGeoStateClick(String(event.name));
        return;
      }

      const tripId = this.extractTripId(event.data);
      if (tripId) {
        this.tripSelect.emit(tripId);
      }
    });
  }

  private onGeoStateClick(stateName: string): void {
    if (!this.geoJson) {
      return;
    }

    const breakdown = countManeuversByDestinationStateBreakdown(
      this.items(),
      this.geoJson,
    ).get(stateName);
    if (!breakdown || breakdown.total <= 0) {
      this.stateFleet.clear();
      return;
    }

    const tripIds = tripIdsByDestinationState(this.items(), stateName, this.geoJson);
    if (tripIds.length === 0) {
      this.stateFleet.clear();
      return;
    }

    this.stateFleet.loadForState(stateName, tripIds);
  }

  private isDestinationPoint(data: unknown): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }
    return (data as TripsMapPointDatum).kind === 'destination';
  }

  private extractTripId(data: unknown): string | null {
    if (!data || typeof data !== 'object') {
      return null;
    }
    const tripId = (data as TripsMapRouteDatum | TripsMapPointDatum).tripId;
    return tripId?.trim() ? tripId : null;
  }
}
