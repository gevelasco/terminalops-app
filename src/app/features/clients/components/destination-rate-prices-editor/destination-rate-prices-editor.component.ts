import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService } from '@core/notifications/toast.service';
import {
  RoutingApiService,
  type RouteTollPlazaRow,
  type RouteTollsQuery,
} from '@core/services/api/routing';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import {
  parseDestinationRateAxleCount,
} from '@features/clients/utils/destination-rate-axle-count.util';
import {
  appendDestinationRatePriceInputRow,
  canAppendDestinationRatePriceRow,
  createEmptyPriceDraft,
  destinationRatePriceDraftsForSave,
  destinationRatePriceManeuverKey,
  fillEmptyRateMoneyFields,
} from '@features/clients/utils/destination-rate-payload';
import {
  activeTollPlazas,
  tollRoundTripMxnFromPlazas,
} from '@features/clients/utils/destination-rate-toll-plaza.util';
import {
  enrichTollPlazaRowsForMap,
  routeTollPlazasForApi,
} from '@features/clients/utils/destination-rate-route-toll-plazas.util';
import { destinationRateRouteTollContextKey } from '@features/clients/utils/destination-rate-route-waypoints.util';
import { formatMxn } from '@features/reports/utils/reports-money';
import type { DestinationRatePriceDraft } from '@shared/models/destination-rate.models';
import { DESTINATION_RATE_AXLE_OPTIONS } from '@shared/catalogs/client-form-options';
import { formatFuelEstimateMoney } from '@features/trips/utils/trips-fuel-estimate';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent, ToSelectOption } from '@shared/ui/to-select/to-select.component';
import { DestinationRateRouteCustomizeComponent } from '@features/clients/components/destination-rate-route-customize/destination-rate-route-customize.component';
import { DestinationRateRouteMapDialogComponent } from '@features/clients/components/destination-rate-route-map-dialog/destination-rate-route-map-dialog.component';
import type { DestinationRateRouteWaypointDraft } from '@features/clients/utils/destination-rate-route-waypoints.util';
import {
  DestinationRateManeuverComboboxComponent,
  type DestinationRateManeuverValue,
} from './destination-rate-maneuver-combobox.component';
import { COMMERCIAL_HANDSHAKE_ICON_SRC } from '@shared/constants/commercial-handshake-icon';
import { TollPlazaPlaceLabelService } from '@features/clients/services/toll-plaza-place-label.service';
import { formatTollPlazaListLabel } from '@features/clients/utils/destination-rate-toll-plaza-display.util';
import { tollPlazaListLocationSuffix } from '@features/clients/utils/destination-rate-toll-plaza-place.util';
import { take } from 'rxjs/operators';

export type DestinationRateRouteTollContext = Pick<
  RouteTollsQuery,
  | 'originLat'
  | 'originLon'
  | 'destinationLat'
  | 'destinationLon'
  | 'originSearch'
  | 'destinationSearch'
  | 'waypoints'
>;

type TollAxleSnapshot = {
  roundTripMxn: number | null;
  plazas: RouteTollPlazaRow[];
};

@Component({
  selector: 'app-destination-rate-prices-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToInputComponent,
    ToSelectComponent,
    ToButtonComponent,
    ToIconComponent,
    DestinationRateManeuverComboboxComponent,
    DestinationRateRouteCustomizeComponent,
    DestinationRateRouteMapDialogComponent,
  ],
  templateUrl: './destination-rate-prices-editor.component.html',
  styleUrl: './destination-rate-prices-editor.component.scss',
})
export class DestinationRatePricesEditorComponent {
  readonly commercialTariffHandshakeSrc = COMMERCIAL_HANDSHAKE_ICON_SRC;

  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly operationConfigs = inject(OperationConfigurationsFeatureService);
  private readonly routingApi = inject(RoutingApiService);
  private readonly tollPlazaPlaceLabels = inject(TollPlazaPlaceLabelService);

  private lastTollContextKey = '';
  private tollFetchGeneration = 0;
  /** Mientras es true, se muestran casetas guardadas en la tarifa (sin refetch INEGI). */
  private readonly preferPersistedTolls = signal(false);
  private persistedTollsBootstrapped = false;
  private routeMetricsPlazasEmitScheduled = false;

  constructor() {
    this.operationConfigs.loadOperationConfigurations();
    effect(() => {
      if (this.viewOnly()) {
        return;
      }
      this.tollPlazaPlaceLabels.preloadMexicoGeo();
    });
    effect(() => {
      const stored = this.routeTollPlazasFromRate();
      if (this.viewOnly() || stored.length === 0 || this.persistedTollsBootstrapped) {
        return;
      }
      this.persistedTollsBootstrapped = true;
      this.preferPersistedTolls.set(true);
      this.seedTollsFromPersisted(stored);
      this.scheduleRouteMetricsPlazasEmit();
    });
    effect(() => {
      const ctx = this.routeTollContext();
      const blocked = this.routeTollBlocked();
      const key = ctx ? destinationRateRouteTollContextKey(ctx) : '';
      if (key !== this.lastTollContextKey) {
        this.lastTollContextKey = key;
        this.tollFetchGeneration += 1;
        this.tollByAxle.set(new Map());
        this.tollLoadingAxles.set(new Set());
        const stored = this.routeTollPlazasFromRate();
        if (this.preferPersistedTolls() && stored.length > 0) {
          this.seedTollsFromPersisted(stored);
        }
      }
      if (blocked || !ctx || this.routeCustomizeOpen() || this.viewOnly()) {
        return;
      }
      if (this.preferPersistedTolls() && this.routeTollPlazasFromRate().length > 0) {
        return;
      }
      this.axleCountsKey();
      this.scheduleTollRefresh();
    });
    effect(() => {
      this.excludedTollPlazaKeys();
      this.recalcAllTollSuggestions();
      this.scheduleRouteMetricsPlazasEmit();
    });
  }

  readonly priceDrafts = model<DestinationRatePriceDraft[]>([createEmptyPriceDraft()]);
  readonly excludedTollPlazaKeys = model<string[]>([]);
  readonly disabled = model(false);
  /** Solo lectura: mismas cards que al guardar, sin formulario. */
  readonly viewOnly = input(false);
  readonly routeTollContext = input<DestinationRateRouteTollContext | null>(null);
  readonly routeTollBlocked = input(false);
  readonly showRouteConfigure = input(false);
  readonly routeConfigureDisabled = input(false);
  readonly routeCustomizeOpen = model(false);
  readonly routeDraftWaypoints = model<DestinationRateRouteWaypointDraft[]>([]);
  readonly routeAppliedWaypoints = model<DestinationRateRouteWaypointDraft[]>([]);
  readonly routeRecalculate = output<void>();
  readonly routeResetSuggested = output<void>();
  readonly routeMapOriginLabel = input('');
  readonly routeMapDestinationLabel = input('');
  /** Casetas en ruta persistidas en la tarifa (visualizar / mapa; sin INEGI). */
  readonly routeTollPlazasFromRate = input<readonly RouteTollPlazaRow[]>([]);
  /** Casetas activas usadas para OSRM / km (ruta definida). */
  readonly routeMetricsPlazasChange = output<readonly RouteTollPlazaRow[]>();

  readonly routeMapOpen = signal(false);

  readonly editingRowKey = signal<string | null>(null);

  readonly axleOptions: ToSelectOption[] = DESTINATION_RATE_AXLE_OPTIONS;

  readonly configurationOptions = computed((): ToSelectOption[] =>
    this.operationConfigs.activeConfigurations().map((c) => ({
      value: c.id,
      label: c.name,
    })),
  );

  readonly allConfigurationNames = computed(() =>
    this.operationConfigs.configurations().map((c) => ({ id: c.id, name: c.name })),
  );

  readonly composerRow = computed((): DestinationRatePriceDraft => {
    const rows = this.priceDrafts();
    return rows[rows.length - 1] ?? createEmptyPriceDraft();
  });

  readonly savedRows = computed((): DestinationRatePriceDraft[] => {
    const rows = this.priceDrafts();
    if (rows.length <= 1) {
      return [];
    }
    return rows.slice(0, -1).filter((r) => destinationRatePriceManeuverKey(r).length > 0);
  });

  readonly displayCardRows = computed((): DestinationRatePriceDraft[] => {
    if (this.viewOnly()) {
      return destinationRatePriceDraftsForSave(this.priceDrafts());
    }
    return this.savedRows();
  });

  readonly canAddRow = computed(
    () => !this.disabled() && canAppendDestinationRatePriceRow([this.composerRow()]),
  );

  readonly tollsSectionLoading = computed(() => {
    if (this.routeCustomizeOpen()) {
      return false;
    }
    const axle = parseDestinationRateAxleCount(this.composerRow().axleCount);
    return this.tollLoadingAxles().has(axle);
  });

  /** Lista visible cuando hay ruta y datos INEGI (no depende del tipo de maniobra). */
  readonly showComposerTolls = computed(() => {
    if (this.routeCustomizeOpen()) {
      return false;
    }
    if (this.routeTollBlocked() || !this.routeTollContext()) {
      return false;
    }
    return (
      this.tollPlazasForComposer().length > 0 || this.composerTollsLoading()
    );
  });

  readonly composerTollsLoading = computed(() => {
    const axle = parseDestinationRateAxleCount(this.composerRow().axleCount);
    return this.tollLoadingAxles().has(axle);
  });

  private readonly tollByAxle = signal(new Map<number, TollAxleSnapshot>());
  private readonly tollLoadingAxles = signal(new Set<number>());
  private readonly tollTouchedRowKeys = signal(new Set<string>());
  private tollRefreshScheduled = false;
  private tollRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly axleCountsKey = computed(() =>
    this.priceDrafts()
      .map((r) => parseDestinationRateAxleCount(r.axleCount))
      .sort((a, b) => a - b)
      .join(','),
  );

  composerRowKey(): string {
    return this.composerRow().rowKey;
  }

  isCardSelected(rowKey: string): boolean {
    return this.editingRowKey() === rowKey;
  }

  maneuverLabel(row: DestinationRatePriceDraft): string {
    const custom = row.operationConfigurationName.trim();
    if (custom) {
      return custom;
    }
    const id = row.operationConfigurationId.trim();
    if (!id) {
      return 'Nuevo tipo de maniobra';
    }
    const match = this.allConfigurationNames().find((c) => c.id === id);
    return match?.name ?? 'Tipo de maniobra';
  }

  displayMoney(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) {
      return '—';
    }
    if (trimmed.startsWith('$')) {
      return trimmed;
    }
    const n = Number(trimmed.replace(/,/g, ''));
    if (Number.isFinite(n)) {
      return formatMxn(n);
    }
    return trimmed;
  }

  formatPlazaCost(costMxn: number | null): string {
    if (costMxn == null || !Number.isFinite(costMxn)) {
      return '—';
    }
    return formatMxn(costMxn);
  }

  tollPlazaListLabel(plaza: RouteTollPlazaRow): string {
    return formatTollPlazaListLabel(plaza);
  }

  tollPlazaListLocation(plaza: RouteTollPlazaRow): string {
    return tollPlazaListLocationSuffix(plaza);
  }

  tollPlazasForComposer(): RouteTollPlazaRow[] {
    return this.tollPlazasForRow(this.composerRow());
  }

  tollPlazasForRow(row: DestinationRatePriceDraft): RouteTollPlazaRow[] {
    if (this.viewOnly()) {
      return activeTollPlazas(
        enrichTollPlazaRowsForMap(this.routeTollPlazasFromRate()),
        new Set(this.excludedTollPlazaKeys()),
      );
    }
    const axle = parseDestinationRateAxleCount(row.axleCount);
    const plazas = this.tollPlazaPlaceLabels.withStateFromGeo(
      this.tollByAxle().get(axle)?.plazas ?? [],
    );
    return activeTollPlazas(plazas, new Set(this.excludedTollPlazaKeys()));
  }

  /** Snapshot para persistir con la tarifa (ejes del compositor). */
  /** Casetas activas en ruta al guardar la tarifa. */
  routeTollPlazasForPersist(): RouteTollPlazaRow[] | undefined {
    const axle = parseDestinationRateAxleCount(this.composerRow().axleCount);
    const plazas = this.tollByAxle().get(axle)?.plazas ?? [];
    const active = activeTollPlazas(plazas, new Set(this.excludedTollPlazaKeys()));
    if (active.length === 0) {
      return undefined;
    }
    return routeTollPlazasForApi(active);
  }

  axleCardLabel(row: DestinationRatePriceDraft): string {
    const n = row.axleCount?.trim() || '5';
    return `${n} ejes`;
  }

  tollCardLabel(row: DestinationRatePriceDraft): string {
    const count = this.tollPlazasForRow(row).length;
    const amount = this.displayMoney(row.estimatedTollAmount);
    if (count > 0) {
      const label = count === 1 ? 'caseta' : 'casetas';
      return `${count} ${label}, ${amount}`;
    }
    return amount;
  }

  excludeTollPlaza(plazaKey: string): void {
    const key = plazaKey.trim();
    if (!key || this.excludedTollPlazaKeys().includes(key)) {
      return;
    }
    const rowKey = this.composerRowKey();
    this.excludedTollPlazaKeys.update((keys) => [...keys, key]);
    this.tollTouchedRowKeys.update((set) => {
      const next = new Set(set);
      next.delete(rowKey);
      return next;
    });
    this.recalcAllTollSuggestions();
    this.scheduleRouteMetricsPlazasEmit();
  }

  availableOptionsForComposer(): ToSelectOption[] {
    const editing = this.editingRowKey();
    const used = new Set(
      this.savedRows()
        .filter((item) => item.rowKey !== editing)
        .map((item) => item.operationConfigurationId.trim())
        .filter((id) => id.length > 0),
    );
    const composer = this.composerRow();
    return this.configurationOptions().filter(
      (opt) =>
        opt.value === composer.operationConfigurationId || !used.has(String(opt.value)),
    );
  }

  openRouteConfigure(): void {
    if (this.routeConfigureDisabled()) {
      return;
    }
    this.routeMapOpen.set(false);
    this.preferPersistedTolls.set(false);
    this.tollFetchGeneration += 1;
    this.tollLoadingAxles.set(new Set());
    this.routeCustomizeOpen.set(true);
  }

  onRouteCustomizeRecalculate(): void {
    this.routeRecalculate.emit();
    this.preferPersistedTolls.set(false);
    this.routeCustomizeOpen.set(false);
    this.scheduleTollRefresh();
    this.scheduleRouteMetricsPlazasEmit();
  }

  onRouteCustomizeResetSuggested(): void {
    this.routeResetSuggested.emit();
    this.preferPersistedTolls.set(false);
    this.routeCustomizeOpen.set(false);
    this.scheduleTollRefresh();
  }

  addRow(): void {
    if (this.disabled()) {
      return;
    }
    const editing = this.editingRowKey();
    const rows = this.priceDrafts();
    const composer = rows[rows.length - 1]!;

    if (editing) {
      const filled = fillEmptyRateMoneyFields(composer);
      if (!filled.ok) {
        this.toast.show(filled.message, 'warning');
        return;
      }
      const composerKey = composer.rowKey;
      this.priceDrafts.set(
        rows.map((r) => (r.rowKey === editing ? { ...filled.row, rowKey: editing } : r)),
      );
      this.finishComposerReset(composerKey);
      return;
    }

    const result = appendDestinationRatePriceInputRow(rows);
    if (!result.ok) {
      this.toast.show(result.message, 'warning');
      return;
    }
    const previousComposerKey = composer.rowKey;
    this.priceDrafts.set(result.rows);
    this.editingRowKey.set(null);
    this.tollTouchedRowKeys.update((set) => {
      const next = new Set(set);
      next.delete(previousComposerKey);
      next.delete(this.composerRowKey());
      return next;
    });
  }

  editSavedRow(rowKey: string): void {
    if (this.disabled()) {
      return;
    }
    const row = this.savedRows().find((r) => r.rowKey === rowKey);
    if (!row) {
      return;
    }
    this.editingRowKey.set(rowKey);
    const composerKey = this.composerRowKey();
    this.priceDrafts.update((all) => {
      const next = [...all];
      const tail = next[next.length - 1]!;
      next[next.length - 1] = {
        ...tail,
        operationConfigurationId: row.operationConfigurationId,
        operationConfigurationName: row.operationConfigurationName,
        clientCharge: row.clientCharge,
        operatorPaymentEstimate: row.operatorPaymentEstimate,
        estimatedTollAmount: row.estimatedTollAmount,
        axleCount: row.axleCount,
        perDiemAmount: row.perDiemAmount,
        notes: row.notes,
      };
      return next;
    });
    this.tollTouchedRowKeys.update((set) => {
      const next = new Set(set);
      next.delete(composerKey);
      return next;
    });
    this.scheduleTollRefresh();
  }

  onManeuverChange(rowKey: string, value: DestinationRateManeuverValue): void {
    this.priceDrafts.update((rows) =>
      rows.map((row) =>
        row.rowKey === rowKey
          ? {
              ...row,
              operationConfigurationId: value.operationConfigurationId,
              operationConfigurationName: value.operationConfigurationName,
            }
          : row,
      ),
    );
  }

  updateField(
    rowKey: string,
    field: 'clientCharge' | 'operatorPaymentEstimate' | 'estimatedTollAmount' | 'perDiemAmount',
    value: string,
  ): void {
    if (field === 'estimatedTollAmount') {
      this.tollTouchedRowKeys.update((set) => new Set(set).add(rowKey));
    }
    this.priceDrafts.update((rows) =>
      rows.map((row) => (row.rowKey === rowKey ? { ...row, [field]: value } : row)),
    );
  }

  onAxleCountChange(rowKey: string, value: string): void {
    this.priceDrafts.update((rows) =>
      rows.map((row) =>
        row.rowKey === rowKey ? { ...row, axleCount: value.trim() || '5' } : row,
      ),
    );
    if (!this.tollTouchedRowKeys().has(rowKey)) {
      this.scheduleTollRefresh();
    }
  }

  private finishComposerReset(previousComposerKey: string): void {
    this.editingRowKey.set(null);
    this.priceDrafts.update((rows) => {
      const next = [...rows];
      next[next.length - 1] = createEmptyPriceDraft();
      return next;
    });
    this.tollTouchedRowKeys.update((set) => {
      const next = new Set(set);
      next.delete(previousComposerKey);
      next.delete(this.composerRowKey());
      return next;
    });
  }

  private scheduleTollRefresh(): void {
    if (this.tollRefreshTimer != null) {
      clearTimeout(this.tollRefreshTimer);
    }
    this.tollRefreshScheduled = true;
    this.tollRefreshTimer = setTimeout(() => {
      this.tollRefreshTimer = null;
      this.tollRefreshScheduled = false;
      this.refreshTollsForCurrentRows();
    }, 280);
  }

  private scheduleRouteMetricsPlazasEmit(): void {
    if (this.viewOnly() || this.routeCustomizeOpen()) {
      return;
    }
    if (this.routeMetricsPlazasEmitScheduled) {
      return;
    }
    this.routeMetricsPlazasEmitScheduled = true;
    queueMicrotask(() => {
      this.routeMetricsPlazasEmitScheduled = false;
      if (this.viewOnly() || this.routeCustomizeOpen()) {
        return;
      }
      this.routeMetricsPlazasChange.emit(this.tollPlazasForComposer());
    });
  }

  private enrichAxlePlazasInPlace(axle: number, plazas: readonly RouteTollPlazaRow[]): void {
    this.tollPlazaPlaceLabels
      .enrichPlazas(plazas)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((enriched) => {
        const snap = this.tollByAxle().get(axle);
        if (!snap) {
          return;
        }
        this.tollByAxle.update((map) => {
          const next = new Map(map);
          next.set(axle, { ...snap, plazas: enriched });
          return next;
        });
      });
  }

  private seedTollsFromPersisted(stored: readonly RouteTollPlazaRow[]): void {
    this.tollPlazaPlaceLabels
      .enrichPlazas(stored)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((enriched) => this.applyPersistedTollsSnapshot(enriched));
  }

  private applyPersistedTollsSnapshot(stored: readonly RouteTollPlazaRow[]): void {
    const excluded = new Set(this.excludedTollPlazaKeys());
    const roundTrip = tollRoundTripMxnFromPlazas(stored, excluded);
    const axles = new Set(
      this.priceDrafts().map((r) => parseDestinationRateAxleCount(r.axleCount)),
    );
    this.tollByAxle.update((map) => {
      const next = new Map(map);
      for (const axle of axles) {
        next.set(axle, {
          roundTripMxn: roundTrip,
          plazas: [...stored],
        });
      }
      return next;
    });
    this.scheduleRouteMetricsPlazasEmit();
  }

  private refreshTollsForCurrentRows(): void {
    const ctx = this.routeTollContext();
    if (!ctx || this.routeTollBlocked() || this.disabled() || this.routeCustomizeOpen()) {
      this.tollLoadingAxles.set(new Set());
      return;
    }
    if (this.preferPersistedTolls() && this.routeTollPlazasFromRate().length > 0) {
      this.seedTollsFromPersisted(this.routeTollPlazasFromRate());
      return;
    }
    const generation = this.tollFetchGeneration;
    const composerAxle = parseDestinationRateAxleCount(this.composerRow().axleCount);
    const allAxles = new Set(
      this.priceDrafts().map((r) => parseDestinationRateAxleCount(r.axleCount)),
    );
  const priorityAxles = [composerAxle];
  const backgroundAxles = [...allAxles].filter((a) => a !== composerAxle);

    for (const axle of priorityAxles) {
      this.fetchTollsForAxle(axle, ctx, generation);
    }
    if (backgroundAxles.length > 0) {
      queueMicrotask(() => {
        if (generation !== this.tollFetchGeneration) {
          return;
        }
        for (const axle of backgroundAxles) {
          this.fetchTollsForAxle(axle, ctx, generation);
        }
      });
    }
  }

  private fetchTollsForAxle(
    axle: number,
    ctx: DestinationRateRouteTollContext,
    generation: number,
  ): void {
    const cached = this.tollByAxle().get(axle);
    if (cached && !this.tollLoadingAxles().has(axle)) {
      this.applyTollSuggestionsForAxle(axle);
      return;
    }
    if (this.tollLoadingAxles().has(axle)) {
      return;
    }
    this.tollLoadingAxles.update((set) => new Set(set).add(axle));
    this.routingApi
      .tollPlazasForRoute({
        ...ctx,
        axleCount: axle,
        excludePlazaKeys: this.excludedTollPlazaKeys(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (generation !== this.tollFetchGeneration) {
            return;
          }
          const plazas = res.plazas ?? [];
          this.tollPlazaPlaceLabels
            .enrichPlazas(plazas)
            .pipe(take(1), takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (enriched) => {
                if (generation !== this.tollFetchGeneration) {
                  return;
                }
                this.tollByAxle.update((map) => {
                  const next = new Map(map);
                  next.set(axle, {
                    roundTripMxn: res.totalRoundTripMxn,
                    plazas: enriched,
                  });
                  return next;
                });
                this.tollLoadingAxles.update((set) => {
                  const next = new Set(set);
                  next.delete(axle);
                  return next;
                });
                this.applyTollSuggestionsForAxle(axle);
                this.scheduleRouteMetricsPlazasEmit();
              },
              error: () => {
                if (generation !== this.tollFetchGeneration) {
                  return;
                }
                this.tollByAxle.update((map) => {
                  const next = new Map(map);
                  next.set(axle, {
                    roundTripMxn: res.totalRoundTripMxn,
                    plazas,
                  });
                  return next;
                });
                this.tollLoadingAxles.update((set) => {
                  const next = new Set(set);
                  next.delete(axle);
                  return next;
                });
                this.applyTollSuggestionsForAxle(axle);
                this.scheduleRouteMetricsPlazasEmit();
              },
            });
        },
        error: () => {
          if (generation !== this.tollFetchGeneration) {
            return;
          }
          this.tollLoadingAxles.update((set) => {
            const next = new Set(set);
            next.delete(axle);
            return next;
          });
          this.tollByAxle.update((map) => {
            const next = new Map(map);
            next.set(axle, { roundTripMxn: null, plazas: [] });
            return next;
          });
        },
      });
  }

  private recalcAllTollSuggestions(): void {
    const axles = new Set(
      this.priceDrafts().map((r) => parseDestinationRateAxleCount(r.axleCount)),
    );
    for (const axle of axles) {
      this.applyTollSuggestionsForAxle(axle);
    }
  }

  private applyTollSuggestionsForAxle(axle: number): void {
    const snap = this.tollByAxle().get(axle);
    if (!snap) {
      return;
    }
    const excluded = new Set(this.excludedTollPlazaKeys());
    const amount =
      tollRoundTripMxnFromPlazas(snap.plazas, excluded) ?? snap.roundTripMxn;
    if (amount == null || amount <= 0) {
      return;
    }
    const label = formatFuelEstimateMoney(amount);
    const touched = this.tollTouchedRowKeys();
    const composerKey = this.composerRowKey();
    let changed = false;
    const nextRows = this.priceDrafts().map((row) => {
      if (row.rowKey !== composerKey) {
        return row;
      }
      if (parseDestinationRateAxleCount(row.axleCount) !== axle) {
        return row;
      }
      if (touched.has(row.rowKey)) {
        return row;
      }
      if (row.estimatedTollAmount.trim() === label) {
        return row;
      }
      changed = true;
      return { ...row, estimatedTollAmount: label };
    });
    if (changed) {
      this.priceDrafts.set(nextRows);
    }
  }
}