import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { EChartsType } from 'echarts/core';
import { ensureTripsMapEchartsModules } from '@features/trips/utils/trips-map-chart-modules';
import { TRIPS_MAP_GEO_NAME } from '@features/trips/utils/trips-map-echarts-option';
import type { MexicoStatesGeoJson } from '@features/trips/utils/trips-map-state-activity';
import type { ReportsManiobrasGeoMapTrip } from '@shared/models/api/api-reports-maniobras.model';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import { buildReportsManiobrasGeoMapOption } from '@features/reports/utils/charts/maniobras/reports-maniobras-geo-map-option';

@Component({
  selector: 'app-reports-maniobras-geo-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToSkeletonComponent],
  template: `
    <div class="reports-maniobras-geo-chart">
      @if (geoLoading()) {
        <to-skeleton class="reports-maniobras-geo-chart__skeleton" [lines]="4" />
      } @else if (geoFailed()) {
        <p class="reports-maniobras-geo-chart__empty">No se pudo cargar el mapa.</p>
      }
      <div #chartHost class="reports-maniobras-geo-chart__host"></div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 220px;
    }

    .reports-maniobras-geo-chart {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 220px;
    }

    .reports-maniobras-geo-chart__host {
      width: 100%;
      height: 100%;
      min-height: 220px;
    }

    .reports-maniobras-geo-chart__skeleton {
      position: absolute;
      inset: 0;
      z-index: 1;
      background: var(--to-color-surface);
    }

    .reports-maniobras-geo-chart__empty {
      position: absolute;
      inset: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      font-size: 0.75rem;
      color: var(--to-color-text-muted);
      background: var(--to-color-surface);
    }
  `,
})
export class ReportsManiobrasGeoChartComponent implements AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('chartHost', { static: true })
  private readonly chartHost!: ElementRef<HTMLDivElement>;

  readonly trips = input.required<readonly ReportsManiobrasGeoMapTrip[]>();

  readonly geoLoading = signal(true);
  readonly geoFailed = signal(false);

  private chart: EChartsType | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private geoJson: MexicoStatesGeoJson | null = null;
  private geoRegistered = false;

  constructor() {
    effect(() => {
      this.trips();
      if (this.chart && this.geoRegistered) {
        this.renderChart();
      }
    });
  }

  ngAfterViewInit(): void {
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.chart?.dispose();
    this.chart = null;
  }

  private async bootstrap(): Promise<void> {
    try {
      await this.registerMexicoMap();
      const echarts = ensureTripsMapEchartsModules();
      this.chart = echarts.init(this.chartHost.nativeElement);
      this.renderChart();
      this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
      this.resizeObserver.observe(this.chartHost.nativeElement);
      this.geoLoading.set(false);
    } catch {
      this.geoLoading.set(false);
      this.geoFailed.set(true);
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
    this.geoRegistered = true;
  }

  private renderChart(): void {
    if (!this.chart) {
      return;
    }
    this.chart.setOption(buildReportsManiobrasGeoMapOption(this.trips(), this.geoJson), true);
  }
}
