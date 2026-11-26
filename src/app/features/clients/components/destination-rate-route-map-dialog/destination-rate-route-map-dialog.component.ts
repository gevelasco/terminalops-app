import { NgTemplateOutlet } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { EChartsType } from 'echarts/core';
import type { RouteTollContext, RouteTollPlazaRow } from '@core/services/api/routing';

type DestinationRateRouteTollContext = Pick<
  RouteTollContext,
  | 'originLat'
  | 'originLon'
  | 'destinationLat'
  | 'destinationLon'
  | 'waypoints'
>;
import { buildDestinationRateRouteMapDrivingPoints } from '@features/clients/utils/destination-rate-route-map-driving-points.util';
import { buildDestinationRateRouteMapMarkers } from '@features/clients/utils/destination-rate-route-map-markers.util';
import { buildDestinationRateRouteMapEchartsOption } from '@features/clients/utils/destination-rate-route-map-echarts.util';
import { computeRouteMapViewport } from '@features/clients/utils/destination-rate-route-map-viewport.util';
import { ensureTripsMapEchartsModules } from '@features/trips/utils/trips-map-chart-modules';
import { TRIPS_MAP_GEO_NAME } from '@features/trips/utils/trips-map-echarts-option';
import { OsrmDrivingRouteService, type LatLon } from '@shared/services/osrm-driving-route.service';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToModuleSkeletonComponent } from '@shared/ui/to-module-skeleton/to-module-skeleton.component';

@Component({
  selector: 'app-destination-rate-route-map-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ToButtonComponent, ToIconComponent, ToModuleSkeletonComponent],
  templateUrl: './destination-rate-route-map-dialog.component.html',
  styleUrl: './destination-rate-route-map-dialog.component.scss',
})
export class DestinationRateRouteMapDialogComponent implements AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly osrm = inject(OsrmDrivingRouteService);

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly chartHost = viewChild<ElementRef<HTMLDivElement>>('chartHost');

  private chart: EChartsType | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private geoRegistered = false;
  private closingFromParent = false;
  private lastTollPlazasSig = '';

  readonly open = input(false);
  /** Incrustado en el editor (sin modal). */
  readonly inline = input(false);
  /** Visualizar tarifa: solo mapa, sin leyendas ni título interno. */
  readonly rateViewLayout = input(false);
  readonly routeContext = input<DestinationRateRouteTollContext | null>(null);
  readonly tollPlazas = input<readonly RouteTollPlazaRow[]>([]);
  readonly originLabel = input('');
  readonly destinationLabel = input('');

  readonly dismiss = output<void>();

  readonly mapLoading = signal(false);
  readonly mapError = signal(false);
  readonly routeLine = signal<Array<[number, number]>>([]);

  constructor() {
    effect(() => {
      const plazas = this.tollPlazas();
      const sig = this.tollPlazasSignature(plazas);
      if (this.inline()) {
        if (!this.open() || !this.routeContext()) {
          this.lastTollPlazasSig = '';
          return;
        }
        if (!this.chart) {
          return;
        }
        if (sig === this.lastTollPlazasSig && this.routeLine().length >= 2) {
          queueMicrotask(() => this.renderChart());
          return;
        }
        this.lastTollPlazasSig = sig;
        void this.loadMapData();
        return;
      }
      const el = this.dialogRef()?.nativeElement;
      if (!el) {
        return;
      }
      if (this.open()) {
        if (!el.open) {
          queueMicrotask(() => {
            if (this.open() && !el.open) {
              el.showModal();
            }
          });
        }
        void this.loadMapData();
        return;
      }
      if (el.open) {
        this.closingFromParent = true;
        el.close();
        this.closingFromParent = false;
      }
    });
  }

  ngAfterViewInit(): void {
    void this.ensureChartReady().then(() => {
      if (this.open() && this.routeContext()) {
        void this.loadMapData();
      } else if (this.routeLine().length >= 2) {
        this.renderChart();
      }
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.dispose();
    this.chart = null;
  }

  onDialogCancel(ev: Event): void {
    ev.preventDefault();
    this.dismiss.emit();
  }

  onDialogClose(): void {
    if (!this.closingFromParent && this.open()) {
      this.dismiss.emit();
    }
  }

  onCloseClick(): void {
    this.dismiss.emit();
  }

  private tollPlazasSignature(plazas: readonly RouteTollPlazaRow[]): string {
    return plazas
      .map((p) => `${p.order}:${p.plazaKey}:${p.inegiPoint ?? ''}`)
      .join('|');
  }

  private async ensureChartReady(): Promise<void> {
    if (this.chart) {
      return;
    }
    const initialized = await this.bootstrapChart();
    if (initialized || this.chart) {
      return;
    }
    await new Promise<void>((resolve) => {
      afterNextRender(
        () => {
          void this.bootstrapChart().finally(() => resolve());
        },
        { injector: this.injector },
      );
    });
  }

  private async bootstrapChart(): Promise<boolean> {
    try {
      await this.ensureMexicoMap();
      const host = this.chartHost()?.nativeElement;
      if (!host) {
        return false;
      }
      if (this.chart) {
        return true;
      }
      const echarts = ensureTripsMapEchartsModules();
      this.chart = echarts.init(host);
      this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
      this.resizeObserver.observe(host);
      return true;
    } catch {
      this.mapError.set(true);
      return false;
    }
  }

  private async ensureMexicoMap(): Promise<void> {
    if (this.geoRegistered) {
      return;
    }
    const geo = await firstValueFrom(
      this.http
        .get<Record<string, unknown>>('/geo/mexico-states.json')
        .pipe(takeUntilDestroyed(this.destroyRef)),
    );
    ensureTripsMapEchartsModules().registerMap(TRIPS_MAP_GEO_NAME, geo as never);
    this.geoRegistered = true;
  }

  private async loadMapData(): Promise<void> {
    const ctx = this.routeContext();
    if (!ctx || !this.open()) {
      return;
    }
    this.mapLoading.set(true);
    this.mapError.set(false);
    try {
      await this.ensureMexicoMap();
      const points = buildDestinationRateRouteMapDrivingPoints({
        ctx,
        plazas: this.tollPlazas(),
      });
      const route = await firstValueFrom(this.osrm.drivingRouteThrough(points));
      const coords = route?.coordinates ?? [];
      const fallback: Array<[number, number]> = points.map((p) => [p.lon, p.lat]);
      const line = coords.length >= 2 ? coords.map(([lng, lat]) => [lng, lat] as [number, number]) : fallback;
      this.routeLine.set(line);
      await this.ensureChartReady();
    } catch {
      this.mapError.set(true);
    } finally {
      this.mapLoading.set(false);
    }
    if (!this.mapError() && this.routeLine().length >= 2) {
      queueMicrotask(() => {
        this.renderChart();
        this.chart?.resize();
      });
    }
  }

  private renderChart(): void {
    if (!this.chart) {
      return;
    }
    const ctx = this.routeContext();
    if (!ctx) {
      return;
    }
    const markers = buildDestinationRateRouteMapMarkers({
      ctx,
      plazas: this.tollPlazas(),
      originLabel: this.originLabel(),
      destinationLabel: this.destinationLabel(),
    });
    const line = this.routeLine();
    const viewportCoords = [
      ...markers.map((m) => ({ lng: m.lng, lat: m.lat })),
      ...line.map(([lng, lat]) => ({ lng, lat })),
    ];
    const viewport = computeRouteMapViewport(viewportCoords);
    this.chart.setOption(
      buildDestinationRateRouteMapEchartsOption({
        viewport,
        routeLine: line,
        markers,
      }),
      true,
    );
    queueMicrotask(() => this.chart?.resize());
  }
}