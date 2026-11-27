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
  type RouteTollContext,
  type RouteTollPlazaRow,
  type TollPlazaSearchHit,
} from '@core/services/api/routing';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { parseDestinationRateAxleCount } from '@features/clients/utils/destination-rate-axle-count.util';
import {
  appendDestinationRatePriceInputRow,
  canAppendDestinationRatePriceRow,
  createEmptyPriceDraft,
  destinationRatePriceDraftsForSave,
  destinationRatePriceManeuverKey,
  fillEmptyRateMoneyFields,
} from '@features/clients/utils/destination-rate-payload';
import { tollRoundTripMxnFromPlazas } from '@features/clients/utils/destination-rate-toll-plaza.util';
import {
  enrichTollPlazaRowsForMap,
  routeTollPlazasForApi,
} from '@features/clients/utils/destination-rate-route-toll-plazas.util';
import { formatMxn } from '@features/reports/utils/reports-money';
import type { DestinationRatePriceDraft } from '@shared/models/destination-rate.models';
import { DESTINATION_RATE_AXLE_OPTIONS } from '@shared/catalogs/client-form-options';
import { formatFuelEstimateMoney } from '@features/trips/utils/trips-fuel-estimate';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToConfirmDialogComponent } from '@shared/ui/to-confirm-dialog/to-confirm-dialog.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent, ToSelectOption } from '@shared/ui/to-select/to-select.component';
import { DestinationRateRouteMapDialogComponent } from '@features/clients/components/destination-rate-route-map-dialog/destination-rate-route-map-dialog.component';
import {
  DestinationRateManeuverComboboxComponent,
  type DestinationRateManeuverValue,
} from './destination-rate-maneuver-combobox.component';
import { DestinationRateTollPlazaComboboxComponent } from './destination-rate-toll-plaza-combobox.component';
import { COMMERCIAL_HANDSHAKE_ICON_SRC } from '@shared/constants/commercial-handshake-icon';
import { TollPlazaPlaceLabelService } from '@features/clients/services/toll-plaza-place-label.service';
import { take } from 'rxjs/operators';

export type DestinationRateRouteTollContext = RouteTollContext;

function costForAxle(
  plaza: RouteTollPlazaRow,
  axle: number,
): number | null {
  const fromMap = plaza.costsByAxle?.[String(axle)];
  if (fromMap != null && Number.isFinite(fromMap)) {
    return fromMap;
  }
  if (plaza.costMxn != null && Number.isFinite(plaza.costMxn)) {
    return plaza.costMxn;
  }
  return null;
}

function withAxleCosts(
  plazas: readonly RouteTollPlazaRow[],
  axle: number,
): RouteTollPlazaRow[] {
  return plazas.map((p, i) => ({
    ...p,
    order: i + 1,
    costMxn: costForAxle(p, axle),
  }));
}

function searchHitToRow(hit: TollPlazaSearchHit, order: number): RouteTollPlazaRow {
  return {
    order,
    plazaKey: hit.plazaKey,
    plazaKeySource: 'catalog',
    name: hit.name,
    section: hit.section,
    costMxn: hit.costMxn,
    costsByAxle: hit.costsByAxle,
    lat: hit.lat,
    lng: hit.lng,
    inegiPoint: hit.inegiPoint,
  };
}

@Component({
  selector: 'app-destination-rate-prices-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToInputComponent,
    ToSelectComponent,
    ToButtonComponent,
    ToIconComponent,
    ToConfirmDialogComponent,
    DestinationRateManeuverComboboxComponent,
    DestinationRateTollPlazaComboboxComponent,
    DestinationRateRouteMapDialogComponent,
  ],
  templateUrl: './destination-rate-prices-editor.component.html',
  styleUrl: './destination-rate-prices-editor.component.scss',
})
export class DestinationRatePricesEditorComponent {
  readonly commercialTariffHandshakeSrc = COMMERCIAL_HANDSHAKE_ICON_SRC;
  readonly axleOptions = DESTINATION_RATE_AXLE_OPTIONS;

  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly operationConfigs = inject(OperationConfigurationsFeatureService);
  private readonly tollPlazaPlaceLabels = inject(TollPlazaPlaceLabelService);

  private persistedTollsBootstrapped = false;
  private routeMetricsPlazasEmitScheduled = false;
  private readonly tollTouchedRowKeys = signal(new Set<string>());

  /** Casetas armadas manualmente (orden = ruta). */
  private readonly manualTollPlazas = signal<RouteTollPlazaRow[]>([]);
  readonly deleteTypeConfirmOpen = signal(false);
  readonly pendingDeleteRowKey = signal<string | null>(null);

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
      if (stored.length === 0 || this.persistedTollsBootstrapped) {
        return;
      }
      this.persistedTollsBootstrapped = true;
      this.seedManualPlazasFromPersisted(stored);
    });
  }

  readonly priceDrafts = model<DestinationRatePriceDraft[]>([createEmptyPriceDraft()]);
  readonly disabled = model(false);
  readonly viewOnly = input(false);
  readonly routeTollContext = input<DestinationRateRouteTollContext | null>(null);
  readonly routeTollBlocked = input(false);
  readonly routeMapOriginLabel = input('');
  readonly routeMapDestinationLabel = input('');
  readonly routeTollPlazasFromRate = input<readonly RouteTollPlazaRow[]>([]);
  readonly routeMetricsPlazasChange = output<readonly RouteTollPlazaRow[]>();

  readonly routeMapOpen = signal(false);
  readonly editingRowKey = signal<string | null>(null);

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

  readonly displayCardRows = computed(() => {
    if (this.viewOnly()) {
      return destinationRatePriceDraftsForSave(this.priceDrafts());
    }
    return this.savedRows();
  });

  readonly isEditingType = computed(() => this.editingRowKey() != null);

  readonly canAddRow = computed(
    () => !this.disabled() && canAppendDestinationRatePriceRow([this.composerRow()]),
  );

  readonly pendingDeleteLabel = computed(() => {
    const key = this.pendingDeleteRowKey();
    if (!key) {
      return '';
    }
    const row = this.savedRows().find((r) => r.rowKey === key);
    return row ? this.maneuverLabel(row) : '';
  });

  /**
   * Bloquea guardar la tarifa si hay un tipo en edición sin actualizar/cancelar.
   * @returns true si se puede continuar con el save.
   */
  assertReadyToPersist(): boolean {
    if (!this.editingRowKey()) {
      return true;
    }
    this.toast.show(
      'Primero debes terminar la actualización de ese tipo o cancelarla para poder guardar.',
      'warning',
    );
    return false;
  }

  readonly composerAxleCount = computed(() =>
    parseDestinationRateAxleCount(this.composerRow().axleCount),
  );

  readonly selectedPlazaKeys = computed(() =>
    this.manualTollPlazas().map((p) => p.plazaKey),
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

  tollPlazasForComposer(): RouteTollPlazaRow[] {
    return this.tollPlazasForRow(this.composerRow());
  }

  tollPlazasForRow(row: DestinationRatePriceDraft): RouteTollPlazaRow[] {
    if (this.viewOnly()) {
      return enrichTollPlazaRowsForMap(this.routeTollPlazasFromRate());
    }
    const axle = parseDestinationRateAxleCount(row.axleCount);
    return withAxleCosts(this.manualTollPlazas(), axle);
  }

  routeTollPlazasForPersist(): RouteTollPlazaRow[] | undefined {
    const axle = parseDestinationRateAxleCount(this.composerRow().axleCount);
    const active = withAxleCosts(this.manualTollPlazas(), axle);
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
    return `${amount} casetas`;
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

  onTollPlazaPicked(hit: TollPlazaSearchHit): void {
    if (this.disabled() || this.viewOnly()) {
      return;
    }
    const key = hit.plazaKey.trim();
    if (!key || this.manualTollPlazas().some((p) => p.plazaKey === key)) {
      return;
    }
    const next = [...this.manualTollPlazas(), searchHitToRow(hit, 0)];
    this.setManualPlazas(next);
    this.syncTollAmountToComposer(true);
  }

  removeTollPlaza(plazaKey: string): void {
    const key = plazaKey.trim();
    if (!key) {
      return;
    }
    this.setManualPlazas(this.manualTollPlazas().filter((p) => p.plazaKey !== key));
    this.syncTollAmountToComposer(true);
  }

  /**
   * Tras cambiar destino/origen: limpia plazas de ruta.
   * Conserva el monto de casetas del compositor si el usuario lo escribió a mano,
   * y nunca toca las cards ya agregadas.
   */
  resetRouteDerivedState(): void {
    this.persistedTollsBootstrapped = false;
    this.manualTollPlazas.set([]);
    this.routeMapOpen.set(false);
    const composerKey = this.composerRowKey();
    const keepComposerToll = this.tollTouchedRowKeys().has(composerKey);
    this.tollTouchedRowKeys.set(keepComposerToll ? new Set([composerKey]) : new Set());
    if (!keepComposerToll) {
      this.priceDrafts.update((rows) => {
        if (rows.length === 0) {
          return rows;
        }
        const last = rows.length - 1;
        return rows.map((row, i) =>
          i === last ? { ...row, estimatedTollAmount: '' } : row,
        );
      });
    }
    this.scheduleRouteMetricsPlazasEmit();
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

  /** Abandona la edición y deja el compositor listo para un tipo nuevo. */
  cancelEdit(): void {
    if (this.disabled() || !this.editingRowKey()) {
      return;
    }
    this.finishComposerReset(this.composerRowKey());
  }

  editSavedRow(rowKey: string): void {
    if (this.disabled()) {
      return;
    }
    if (this.editingRowKey() && this.editingRowKey() !== rowKey) {
      this.toast.show(
        'Primero debes terminar la actualización de ese tipo o cancelarla.',
        'warning',
      );
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
    this.syncTollAmountToComposer(false);
  }

  requestDeleteSavedRow(rowKey: string): void {
    if (this.disabled()) {
      return;
    }
    if (this.editingRowKey()) {
      this.toast.show(
        'Primero debes terminar la actualización de ese tipo o cancelarla.',
        'warning',
      );
      return;
    }
    if (!this.savedRows().some((r) => r.rowKey === rowKey)) {
      return;
    }
    this.pendingDeleteRowKey.set(rowKey);
    this.deleteTypeConfirmOpen.set(true);
  }

  closeDeleteTypeConfirm(): void {
    this.deleteTypeConfirmOpen.set(false);
    this.pendingDeleteRowKey.set(null);
  }

  confirmDeleteSavedRow(): void {
    const rowKey = this.pendingDeleteRowKey();
    this.closeDeleteTypeConfirm();
    if (!rowKey || this.disabled()) {
      return;
    }
    this.priceDrafts.update((rows) => rows.filter((r) => r.rowKey !== rowKey));
    if (this.editingRowKey() === rowKey) {
      this.finishComposerReset(this.composerRowKey());
    }
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
    this.setManualPlazas([...this.manualTollPlazas()]);
    if (!this.tollTouchedRowKeys().has(rowKey)) {
      this.syncTollAmountToComposer(false);
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

  private setManualPlazas(plazas: readonly RouteTollPlazaRow[]): void {
    const axle = this.composerAxleCount();
    this.manualTollPlazas.set(withAxleCosts(plazas, axle));
    this.scheduleRouteMetricsPlazasEmit();
  }

  private seedManualPlazasFromPersisted(stored: readonly RouteTollPlazaRow[]): void {
    this.tollPlazaPlaceLabels
      .enrichPlazas(stored)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((enriched) => {
        this.setManualPlazas(enriched);
        this.syncTollAmountToComposer(false);
      });
  }

  private syncTollAmountToComposer(force: boolean): void {
    const axle = this.composerAxleCount();
    const plazas = withAxleCosts(this.manualTollPlazas(), axle);
    const amount = tollRoundTripMxnFromPlazas(plazas, new Set());
    if (amount == null || amount <= 0) {
      if (force && plazas.length === 0) {
        const composerKey = this.composerRowKey();
        if (!this.tollTouchedRowKeys().has(composerKey)) {
          this.priceDrafts.update((rows) =>
            rows.map((row) =>
              row.rowKey === composerKey ? { ...row, estimatedTollAmount: '' } : row,
            ),
          );
        }
      }
      return;
    }
    const label = formatFuelEstimateMoney(amount);
    const composerKey = this.composerRowKey();
    if (!force && this.tollTouchedRowKeys().has(composerKey)) {
      return;
    }
    if (force) {
      this.tollTouchedRowKeys.update((set) => {
        const next = new Set(set);
        next.delete(composerKey);
        return next;
      });
    }
    this.priceDrafts.update((rows) =>
      rows.map((row) =>
        row.rowKey === composerKey && row.estimatedTollAmount.trim() !== label
          ? { ...row, estimatedTollAmount: label }
          : row,
      ),
    );
  }

  private scheduleRouteMetricsPlazasEmit(): void {
    if (this.viewOnly()) {
      return;
    }
    if (this.routeMetricsPlazasEmitScheduled) {
      return;
    }
    this.routeMetricsPlazasEmitScheduled = true;
    queueMicrotask(() => {
      this.routeMetricsPlazasEmitScheduled = false;
      if (this.viewOnly()) {
        return;
      }
      this.routeMetricsPlazasChange.emit(this.tollPlazasForComposer());
    });
  }
}
