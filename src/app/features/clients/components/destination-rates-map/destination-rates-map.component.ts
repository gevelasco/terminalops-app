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
import type { DestinationRate } from '@shared/models/destination-rate.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToModuleSkeletonComponent } from '@shared/ui/to-module-skeleton/to-module-skeleton.component';
import { injectIsMobileViewport } from '@shared/utils/viewport';
import { ensureTripsMapEchartsModules } from '@features/trips/utils/trips-map-chart-modules';
import { TRIPS_MAP_GEO_NAME } from '@features/trips/utils/trips-map-echarts-option';
import type { MexicoStatesGeoJson } from '@features/trips/utils/trips-map-state-activity';
import {
  countDestinationRatesWithCoords,
  destinationRatesInState,
} from '@features/clients/utils/destination-rates-map-activity';
import { buildDestinationRatesMapEchartsOption } from '@features/clients/utils/destination-rates-map-echarts-option';
import {
  buildDestinationRateStateById,
  filterDestinationRatesByQuery,
} from '@features/clients/utils/destination-rates-map-search';
import {
  buildDestinationRateTableRows,
  pickStateScopeSurvivorRates,
  type DestinationRateTableRow,
} from '@features/clients/utils/destination-rates-table-rows';
import { SessionService } from '@core/services/state/session';
import { normalizeDestinationRateScope } from '@shared/models/destination-rate-scope';

@Component({
  selector: 'app-destination-rates-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToModuleSkeletonComponent, ToButtonComponent],
  templateUrl: './destination-rates-map.component.html',
  styleUrls: [
    '../../../../shared/ui/to-table/to-table.component.scss',
    './destination-rates-map.component.scss',
  ],
})
export class DestinationRatesMapComponent implements AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(SessionService);
  readonly isMobileViewport = injectIsMobileViewport();

  readonly rateScope = computed(() =>
    normalizeDestinationRateScope(this.session.destinationRateScope()),
  );
  readonly showMunicipalityColumn = computed(
    () => this.rateScope() !== 'state',
  );
  readonly showPostalCodeColumn = computed(
    () => this.rateScope() === 'postal_code',
  );

  @ViewChild('chartHost', { static: true })
  private readonly chartHost!: ElementRef<HTMLDivElement>;

  readonly rates = input.required<readonly DestinationRate[]>();
  readonly loading = input(false);
  /** Búsqueda: CP, estado, municipio, colonia, tipo de tarifa o costo. */
  readonly filterQuery = input('');

  readonly rateSelect = output<string>();

  private readonly geoJsonSignal = signal<MexicoStatesGeoJson | null>(null);

  readonly stateByRateId = computed(() =>
    buildDestinationRateStateById(this.rates(), this.geoJsonSignal()),
  );

  readonly filteredRates = computed(() =>
    filterDestinationRatesByQuery(
      this.rates(),
      this.filterQuery(),
      this.geoJsonSignal(),
      this.stateByRateId(),
    ).filter((rate) => rate.active !== false),
  );

  /** Una tarifa por estado para colorear el mapa (sin perder tipos en la tabla). */
  readonly mapRates = computed(() => {
    const filtered = this.filteredRates();
    if (this.rateScope() === 'state') {
      return pickStateScopeSurvivorRates(filtered, this.stateByRateId());
    }
    return filtered;
  });

  readonly hasActiveFilter = computed(() => this.filterQuery().trim().length > 0);

  readonly coordsMeta = computed(() =>
    countDestinationRatesWithCoords(this.rates()),
  );

  readonly selectedState = signal<string | null>(null);

  /**
   * Móvil: lista a pantalla completa (estado tocado o búsqueda activa).
   * Evita apilar tabla+mapa sin altura/scroll en el viewport.
   */
  readonly mobileStateListMode = computed(
    () =>
      this.isMobileViewport() &&
      (this.selectedState() != null || this.hasActiveFilter()),
  );

  /** Móvil sin lista: solo mapa hasta elegir estado o filtrar. */
  readonly mobileMapOnlyMode = computed(
    () => this.isMobileViewport() && !this.mobileStateListMode(),
  );

  readonly tableSourceRates = computed(() => {
    const filtered = this.filteredRates();
    const stateName = this.selectedState();
    const geo = this.geoJsonSignal();
    if (!stateName || !geo || this.hasActiveFilter()) {
      return filtered;
    }
    return destinationRatesInState(filtered, stateName, geo);
  });

  readonly tableRows = computed(() =>
    buildDestinationRateTableRows(
      this.tableSourceRates(),
      this.stateByRateId(),
      undefined,
      this.rateScope(),
    ),
  );

  readonly geoReady = signal(false);
  readonly geoLoadFailed = signal(false);
  /** Fila bajo el cursor: para resaltar celdas mergeadas (estado/municipio/CP). */
  readonly hoveredRowIndex = signal<number | null>(null);

  private chart: EChartsType | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private geoRegistered = false;
  private geoJson: MexicoStatesGeoJson | null = null;

  constructor() {
    effect(() => {
      this.mapRates();
      if (this.chart && this.geoRegistered) {
        this.renderChart();
      }
    });

    effect(() => {
      const stateName = this.selectedState();
      const geo = this.geoJsonSignal();
      const filtered = this.filteredRates();
      if (!stateName || !geo) {
        return;
      }
      if (destinationRatesInState(filtered, stateName, geo).length === 0) {
        this.selectedState.set(null);
      }
    });

    effect(() => {
      if (!this.mobileStateListMode() && this.chart) {
        queueMicrotask(() => this.chart?.resize());
      }
    });
  }

  showMapOnMobile(): void {
    this.selectedState.set(null);
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

  onTableRowClick(row: DestinationRateTableRow): void {
    this.rateSelect.emit(row.rateId);
  }

  rowAriaLabel(row: DestinationRateTableRow): string {
    if (this.showPostalCodeColumn() && row.postalCode) {
      return `Ver tarifa CP ${row.postalCode}`;
    }
    if (this.showMunicipalityColumn() && row.municipality) {
      return `Ver tarifa ${row.municipality}${row.state ? `, ${row.state}` : ''}`;
    }
    return `Ver tarifa ${row.state || row.maneuver || ''}`.trim();
  }

  onTableRowKeydown(event: KeyboardEvent, row: DestinationRateTableRow): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onTableRowClick(row);
    }
  }

  onTableRowEnter(row: DestinationRateTableRow): void {
    this.hoveredRowIndex.set(row.rowIndex);
  }

  onTableRowLeave(): void {
    this.hoveredRowIndex.set(null);
  }

  isMergeCellHovered(spanStart: number, span: number): boolean {
    const hovered = this.hoveredRowIndex();
    if (hovered == null || span <= 0) {
      return false;
    }
    return hovered >= spanStart && hovered < spanStart + span;
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
    this.chart.setOption(
      buildDestinationRatesMapEchartsOption(this.mapRates(), this.geoJson),
      true,
    );
    this.chart.off('click');
    this.chart.on('click', (event: ECElementEvent) => {
      if (event.componentType === 'geo' && event.name) {
        this.onGeoStateClick(String(event.name));
      }
    });
  }

  private onGeoStateClick(stateName: string): void {
    if (!this.geoJson) {
      return;
    }
    const inState = destinationRatesInState(
      this.filteredRates(),
      stateName,
      this.geoJson,
    );
    if (inState.length === 0) {
      this.selectedState.set(null);
      return;
    }
    this.selectedState.update((current) =>
      current === stateName ? null : stateName,
    );
  }
}
