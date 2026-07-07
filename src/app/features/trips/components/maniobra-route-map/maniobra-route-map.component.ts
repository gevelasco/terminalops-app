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
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { ECElementEvent, EChartsType } from 'echarts/core';
import type { TripMapItem, TripsMapMeta } from '@shared/models/api/api-trips-map.model';
import { FleetOverviewCardComponent } from '@features/fleet/components/fleet-overview-card/fleet-overview-card.component';
import { ToKpiCardComponent } from '@shared/ui/to-kpi-card/to-kpi-card.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import { TripsMapStateFleetService } from '@features/trips/services/trips-map-state-fleet.service';
import { ensureTripsMapEchartsModules } from '@features/trips/utils/trips-map-chart-modules';
import {
  TRIPS_MAP_GEO_NAME,
  buildTripsMapEchartsOption,
  type TripsMapPointDatum,
  type TripsMapRouteDatum,
} from '@features/trips/utils/trips-map-echarts-option';
import {
  countTripsMapActiveDestinationStates,
  tripIdsByDestinationState,
  type MexicoStatesGeoJson,
} from '@features/trips/utils/trips-map-state-activity';
import { countManeuversByDestinationStateBreakdown } from '@features/trips/utils/trips-map-state-tooltip';
import { countTripsMapByStatus } from '@features/trips/utils/trips-map-viewport.util';

@Component({
  selector: 'app-maniobra-route-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToSkeletonComponent, ToKpiCardComponent, FleetOverviewCardComponent],
  templateUrl: './maniobra-route-map.component.html',
  styleUrl: './maniobra-route-map.component.scss',
})
export class ManiobraRouteMapComponent implements AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
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

  constructor() {
    effect(() => {
      this.items();
      if (this.chart && this.geoRegistered) {
        this.renderChart();
      }
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
    const geo = await firstValueFrom(
      this.http
        .get<Record<string, unknown>>('/geo/mexico-states.json')
        .pipe(takeUntilDestroyed(this.destroyRef)),
    );
    ensureTripsMapEchartsModules().registerMap(TRIPS_MAP_GEO_NAME, geo as never);
    this.geoJson = geo as unknown as MexicoStatesGeoJson;
    this.geoJsonSignal.set(this.geoJson);
    this.geoRegistered = true;
  }

  private renderChart(): void {
    if (!this.chart) {
      return;
    }
    this.chart.setOption(buildTripsMapEchartsOption(this.items(), this.geoJson), true);
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
