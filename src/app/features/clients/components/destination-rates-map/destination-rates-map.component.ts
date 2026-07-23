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
import { MexicoPostalCodeService } from '@shared/services/mexico-postal-code.service';
import { ToBadgeComponent } from '@shared/ui/to-badge/to-badge.component';
import { ToKpiCardComponent } from '@shared/ui/to-kpi-card/to-kpi-card.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import { ensureTripsMapEchartsModules } from '@features/trips/utils/trips-map-chart-modules';
import { TRIPS_MAP_GEO_NAME } from '@features/trips/utils/trips-map-echarts-option';
import type { MexicoStatesGeoJson } from '@features/trips/utils/trips-map-state-activity';
import {
  buildDestinationRateRouteCards,
  cityMunicipalityNeedsEnrichment,
  countActiveDestinationRates,
  countDestinationRatesByState,
  countDestinationRatesWithCoords,
  destinationRatesInState,
  resolveRouteCardCityLine,
  type DestinationRateRouteCard,
} from '@features/clients/utils/destination-rates-map-activity';
import { buildDestinationRatesMapEchartsOption } from '@features/clients/utils/destination-rates-map-echarts-option';
import {
  buildDestinationRateStateById,
  filterDestinationRatesByQuery,
} from '@features/clients/utils/destination-rates-map-search';

@Component({
  selector: 'app-destination-rates-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToSkeletonComponent, ToKpiCardComponent, ToBadgeComponent],
  templateUrl: './destination-rates-map.component.html',
  styleUrl: './destination-rates-map.component.scss',
})
export class DestinationRatesMapComponent implements AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sepomex = inject(MexicoPostalCodeService);

  @ViewChild('chartHost', { static: true })
  private readonly chartHost!: ElementRef<HTMLDivElement>;

  readonly rates = input.required<readonly DestinationRate[]>();
  readonly loading = input(false);
  /** Búsqueda: CP, estado, municipio, colonia, tipo de tarifa o costo. */
  readonly filterQuery = input('');

  readonly rateSelect = output<string>();

  private readonly geoJsonSignal = signal<MexicoStatesGeoJson | null>(null);
  /** Municipio resuelto por CP (catálogo postal) para cards con dato incompleto. */
  private readonly municipalityByCp = signal<ReadonlyMap<string, string>>(
    new Map(),
  );
  private readonly municipalityLookupInFlight = new Set<string>();

  readonly stateByRateId = computed(() =>
    buildDestinationRateStateById(this.rates(), this.geoJsonSignal()),
  );

  readonly filteredRates = computed(() =>
    filterDestinationRatesByQuery(
      this.rates(),
      this.filterQuery(),
      this.geoJsonSignal(),
      this.stateByRateId(),
    ),
  );

  readonly hasActiveFilter = computed(() => this.filterQuery().trim().length > 0);

  readonly activeCount = computed(() =>
    countActiveDestinationRates(this.filteredRates()),
  );
  readonly coordsMeta = computed(() =>
    countDestinationRatesWithCoords(this.rates()),
  );
  readonly stateCount = computed(() => {
    const geo = this.geoJsonSignal();
    if (!geo) {
      return 0;
    }
    return countDestinationRatesByState(this.filteredRates(), geo).size;
  });

  readonly selectedState = signal<string | null>(null);

  readonly selectedRouteCards = computed((): readonly DestinationRateRouteCard[] => {
    const geo = this.geoJsonSignal();
    const states = this.stateByRateId();
    const filtered = this.filteredRates();

    if (this.hasActiveFilter()) {
      const stateName = this.selectedState();
      const scoped = stateName
        ? geo
          ? destinationRatesInState(filtered, stateName, geo)
          : filtered.filter((r) => states.get(r.id) === stateName)
        : filtered;
      return buildDestinationRateRouteCards(scoped, states);
    }

    const stateName = this.selectedState();
    if (!stateName || !geo) {
      return [];
    }
    return buildDestinationRateRouteCards(
      destinationRatesInState(filtered, stateName, geo),
      states,
    );
  });

  readonly displayedRouteCards = computed(() => {
    const enrichments = this.municipalityByCp();
    return this.selectedRouteCards().map((card) => ({
      ...card,
      cityMunicipality: resolveRouteCardCityLine(card, enrichments),
    }));
  });

  readonly panelMode = computed((): 'idle' | 'state' | 'search' => {
    if (this.hasActiveFilter()) {
      return 'search';
    }
    return this.selectedState() ? 'state' : 'idle';
  });

  readonly geoReady = signal(false);
  readonly geoLoadFailed = signal(false);

  private chart: EChartsType | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private geoRegistered = false;
  private geoJson: MexicoStatesGeoJson | null = null;

  constructor() {
    effect(() => {
      this.filteredRates();
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
      this.enqueueMunicipalityEnrichment(this.selectedRouteCards());
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

  onRouteCardClick(card: DestinationRateRouteCard): void {
    this.rateSelect.emit(card.rateId);
  }

  private enqueueMunicipalityEnrichment(
    cards: readonly DestinationRateRouteCard[],
  ): void {
    const known = this.municipalityByCp();
    const pending = new Set<string>();
    for (const card of cards) {
      const cp = card.postalCode.trim();
      if (cp.length !== 5) {
        continue;
      }
      if (known.has(cp) || this.municipalityLookupInFlight.has(cp)) {
        continue;
      }
      if (!cityMunicipalityNeedsEnrichment(card.cityMunicipality, card.stateName)) {
        continue;
      }
      pending.add(cp);
    }
    for (const cp of pending) {
      this.lookupMunicipalityForCp(cp);
    }
  }

  private lookupMunicipalityForCp(cp: string): void {
    this.municipalityLookupInFlight.add(cp);
    this.sepomex
      .lookupByPostalCode(cp)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.municipalityLookupInFlight.delete(cp);
          const municipality =
            rows.find((r) => r.municipality.trim())?.municipality.trim() ||
            rows.find((r) => r.city.trim())?.city.trim() ||
            '';
          this.municipalityByCp.update((prev) => {
            const next = new Map(prev);
            next.set(cp, municipality);
            return next;
          });
        },
        error: () => {
          this.municipalityLookupInFlight.delete(cp);
          this.municipalityByCp.update((prev) => {
            const next = new Map(prev);
            next.set(cp, '');
            return next;
          });
        },
      });
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
      buildDestinationRatesMapEchartsOption(this.filteredRates(), this.geoJson),
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
    this.selectedState.set(stateName);
  }
}
