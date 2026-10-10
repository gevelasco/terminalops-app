import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map, of, switchMap, type Observable, type Subscription } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { ExpensesService, type ExpenseWritePayload } from '@core/services/api/expenses';
import { UnitsService as UnitsApiService } from '@core/services/api/units';
import {
  confirmFleetCoverageSchedulePayment,
  resolveFleetCoverageConfirmDueDate,
  subscribeFleetCoverageExpensesPage,
} from '@features/fleet/utils/fleet-coverage-payment.util';
import { SessionService } from '@core/services/state/session';
import { PlanEntitlementService } from '@shared/billing/plan-entitlement.service';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { EquipmentFeatureService } from '@features/fleet/services/equipment.service';
import { FleetFeatureService } from '@features/fleet/services/fleet.service';
import { UnitsFeatureService } from '@features/fleet/services/units.service';
import {
  companyMaintenancePolicyFromSession,
} from '@shared/models/company-operational-settings.models';
import type { EquipmentPersistDraft } from '@shared/utils/fleet/equipment-api-payload';
import {
  resolveEquipmentPersistDraft,
  resolveUnitPersistDraft,
} from '@shared/utils/fleet/fleet-persist-draft';
import type { UnitPersistDraft } from '@shared/utils/fleet/unit-api-payload';
import {
  trackFileEntry,
  trackMaintenanceEntry,
  trackStringEntry,
} from '@features/fleet/utils/list-trackers';
import {
  canConfirmInsurancePayment,
  insurancePaymentConfirmHint,
  nextInsurancePaymentDate,
} from '@features/fleet/utils/fleet-insurance-payment.util';
import {
  buildInsurancePaymentSchedule,
  insurancePolicyYearBounds,
  isAnnualInsuranceCadence,
  showInsurancePaymentSchedule,
} from '@features/fleet/utils/fleet-insurance-schedule.util';
import { coverageNextPaymentLabel } from '@features/fleet/utils/fleet-ledger-coverage-schedule.util';
import {
  buildGpsPaymentSchedule,
  gpsServiceYearBounds,
  isAnnualGpsCadence,
  showGpsPaymentSchedule,
} from '@features/fleet/utils/fleet-gps-schedule.util';
import {
  canConfirmGpsPayment,
  gpsFleetFormHasContent,
  gpsFleetMetaIsActive,
  gpsPaymentConfirmHint,
  nextGpsPaymentDate,
} from '@features/fleet/utils/fleet-gps-payment.util';
import {
  buildTenurePaymentSchedule,
  showTenurePaymentSchedule,
  tenurePaymentBounds,
} from '@features/fleet/utils/fleet-tenure-schedule.util';
import { fleetUnitDetailSegmentTabs } from '@app/features/fleet/utils/fleet-unit-detail-segment-tabs';
import { formatFleetStoredKmLabel } from '@features/fleet/utils/fleet-stored-km.util';
import {
  attachFleetMaintenanceDocNamesToNewestEntry,
  isSubstantiveMaintenanceEntry,
} from '@features/fleet/utils/fleet-maintenance-entry.util';
import {
  buildFleetMaintenanceExpensePayload,
  FLEET_MAINTENANCE_LEDGER_ERROR,
} from '@features/fleet/utils/fleet-maintenance-expense.util';
import {
  fleetMaintenanceKmRemainingFromCounterInput,
  fleetMaintenanceResetsKmCounter,
  formatMaintenanceKmCounterLabel,
  formatMaintenanceKmRemainingLabel,
  parseMaintenanceKmCounter,
  parseMaintenanceKmCounterInput,
} from '@features/fleet/utils/fleet-maintenance-km.util';
import { applySyncedFleetDocuments } from '@features/fleet/utils/fleet-synced-documents.util';
import { FLEET_UNIT_DETAIL_TAB_SYMBOLS } from '@app/features/fleet/utils/fleet-unit-detail-tab-symbols';
import { deriveFleetBrandAbbr } from '@shared/utils/fleet/derive-fleet-brand-abbr';
import { fleetBrandDisplayName } from '@shared/utils/fleet/fleet-brand-display';
import { registerFleetVersionResetOnBrandChange } from '@shared/utils/fleet/fleet-brand-version-link';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';
import {
  FleetRenewalBucket,
  fleetGpsRenewal,
  fleetInsuranceRenewal,
  fleetMaintenanceKmRemaining,
  fleetMaintenanceRenewal,
  formatFleetYmdMx,
  nextCycleFormatted,
  nextGpsTableDate,
  nextInsuranceTableDate,
  nextMaintenanceTableDate,
  complianceRenewalBucket,
} from '@app/features/fleet/utils/fleet-unit-table-row';
import {
  fleetModelTwoYearExemptionEndYmd,
  isWithinFleetModelTwoYearExemption,
} from '@features/fleet/utils/fleet-verification-exemption.util';
import {
  fleetDrawerTodayIso,
  fleetModelYearErrorMessage,
  fleetValueFromLabel,
  parseFleetModelYear,
  parseFleetOptionalAmount,
  parseFleetOptionalPositiveInt,
  registerFleetHitchSlotSync,
} from '@app/features/fleet/utils/fleet-drawer-form.utils';
import {
  formatGroupedNumber,
  formatMoneyInputValue,
} from '@shared/utils/format-grouped-number';
import { formatUnitTrailerOperationalId } from '@shared/utils/fleet/unit-label';
import {
  trailerTenureModeLabel,
  trailerTenureModeOrDefault,
} from '@shared/utils/fleet/trailer-tenure-mode';
import {
  equipmentHitchAddActionLabel,
  equipmentSelectableForUnitHitch,
  hitchPositionForNewEquipmentOnUnit,
  UNIT_HITCH_NOT_TRACTOR_MESSAGE,
  unitCanHitchEquipment,
  unitHasHitchSlot,
  validateEquipmentHitchAssignment,
} from '@shared/utils/fleet/equipment-hitch-assignment';
import {
  equipmentPromoteToLeadPersistDraft,
  equipmentUnhitchPersistDraft,
  rearEquipmentToPromoteOnLeadUnhitch,
  unhitchingLeadRequiresRearPromotion,
} from '@shared/utils/fleet/equipment-hitch-position';
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import { resourceIdsEqual } from '@shared/utils/resource-id';
import {
  equipmentAssignedToUnit,
  resolveHitchedEquipmentForUnit,
  equipmentTypeDisplayLabel,
  equipmentHitchPositionDisplayLabel,
  unitConvoyFromEquipment,
} from '@app/features/fleet/utils/unit-hitched-equipment';
import {
  Expense,
  ExpenseVerificationScope,
  Equipment,
  FleetDocumentKind,
  FleetStoredDocument,
  MaintenanceEntry,
  TrailerTenureMode,
  Unit,
  UnitFleetMeta,
} from '@shared/models/logistics.models';
import {
  FLEET_PAYMENT_CADENCE_OPTIONS,
  FLEET_SERVICE_MODALITY_OPTIONS,
  FLEET_TRANSPORT_TYPE_OPTIONS,
  FLEET_TRANSMISSION_SPEED_OPTIONS,
  FLEET_TRANSMISSION_TYPE_OPTIONS,
  FLEET_RESOURCE_VISIBILITY_OPTIONS,
  FLEET_MAINTENANCE_TYPE_OPTIONS,
} from '@shared/catalogs/fleet-form-options';
import { EXPENSE_PAYMENT_METHOD_OPTIONS } from '@shared/catalogs/expense-form-options';
import { expensePaymentMethodLabel } from '@features/expenses/utils/expense-row-labels';
import { isAdminRole } from '@shared/utils/access-control';
import { parseHttpApiErrorMessage } from '@shared/utils/http-api-error';
import { FLEET_DELETE_ON_ROUTE_TOOLTIP } from '@features/fleet/utils/fleet-resource-delete';
import {
  fleetMaintenanceAction,
  fleetMaintenanceActionLabel,
} from '@features/fleet/utils/fleet-maintenance-toggle';
import { fleetResourceActiveLabel } from '@shared/utils/fleet-resource-active';
import { FleetUnitDetailDomain } from '@features/fleet/services/domain/fleet-unit-detail.domain';
import { FLEET_OPERATION_RESOLVER } from '@features/fleet/utils/fleet-operation-resolver';
import type {
  FleetUnitDetailDrawerHostCallbacks,
  FleetUnitDetailDrawerHostLayout,
  UnitDetailDrawerTab,
  UnitEditingSection,
} from '@features/fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer.types';
import type { FleetPersistOptions } from '@features/fleet/components/fleet-detail-drawer.types';

export type {
  FleetUnitDetailDrawerHostCallbacks,
  FleetUnitDetailDrawerHostLayout,
  UnitDetailDrawerTab,
} from '@features/fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer.types';

const VERIF_MO = 6;

/** Guardados de coberturas / verificaciones: PATCH + upsert en memoria; sin refetch masivo de flota. */
const COB_SECTION_PERSIST_OPTIONS: FleetPersistOptions = {
  skipListRefresh: true,
  skipFleetRefresh: true,
};

/** Tenencia: PATCH + `syncedDocuments` para archivos de propiedad (sin GET extra). */
const TENURE_SECTION_PERSIST_OPTIONS: FleetPersistOptions = {
  ...COB_SECTION_PERSIST_OPTIONS,
};

@Injectable()
export class FleetUnitDetailDrawerFacade {
  readonly toast = inject(ToastService);
  readonly session = inject(SessionService);
  private readonly planEntitlements = inject(PlanEntitlementService);
  readonly destroyRef = inject(DestroyRef);
  private readonly unitsFeature = inject(UnitsFeatureService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly equipmentFeature = inject(EquipmentFeatureService);
  private readonly fleetFeature = inject(FleetFeatureService);
  private readonly expensesApi = inject(ExpensesService);
  private readonly domain = inject(FleetUnitDetailDomain);
  private readonly opResolver = FLEET_OPERATION_RESOLVER;

  private dismissCallback: (() => void) | null = null;
  private viewHitchedEquipmentCallback: ((equipment: Equipment) => void) | null = null;

  private readonly unitSource = signal<Unit | null>(null);
  private readonly onRouteSource = signal(false);
  private readonly hitchedEquipmentSource = signal<Equipment[]>([]);
  private readonly equipmentCatalogSource = signal<Equipment[]>([]);

  readonly unit = computed(() => this.unitSource()!);
  readonly onRoute = computed(() => this.onRouteSource());
  readonly hitchedEquipment = computed(() => this.hitchedEquipmentSource());
  readonly equipmentCatalog = computed(() => this.equipmentCatalogSource());

  readonly verifCycleMo = VERIF_MO;
  readonly formatYmd = formatFleetYmdMx;
  readonly trackFileEntry = trackFileEntry;
  readonly trackStringEntry = trackStringEntry;
  readonly trackMaintenanceEntry = trackMaintenanceEntry;
  readonly detailSegmentTabs = fleetUnitDetailSegmentTabs('fleet-udv');
  readonly detailTabSymbols = FLEET_UNIT_DETAIL_TAB_SYMBOLS;

  readonly drawerLoading = signal(false);
  readonly saving = signal(false);
  private readonly insurancePaymentExpenses = signal<Expense[]>([]);
  private insurancePaymentExpensesLoadId = 0;
  private readonly gpsPaymentExpenses = signal<Expense[]>([]);
  private gpsPaymentExpensesLoadId = 0;
  private readonly tenurePaymentExpenses = signal<Expense[]>([]);
  private tenurePaymentExpensesLoadId = 0;
  readonly deleteConfirmOpen = signal(false);
  readonly deleteSubmitting = signal(false);
  readonly maintenanceSubmitting = signal(false);

  readonly canDeleteUnit = computed(() => isAdminRole(this.session.role()));
  readonly canWriteFleet = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.FLEET),
  );
  readonly deleteBlockedByRoute = computed(() => this.onRoute());
  readonly deleteBlockedTooltip = () => FLEET_DELETE_ON_ROUTE_TOOLTIP;

  readonly maintenanceAction = computed(() =>
    fleetMaintenanceAction({
      status: this.effUnit().status,
      onRoute: this.onRoute(),
      isActive: this.effUnit().isActive,
    }),
  );

  readonly showsMaintenanceAction = computed(
    () => this.canWriteFleet() && this.maintenanceAction() != null,
  );

  readonly maintenanceActionLabel = computed(() =>
    fleetMaintenanceActionLabel(this.maintenanceAction()),
  );

  readonly companyMaintPolicy = computed(() =>
    companyMaintenancePolicyFromSession({
      maintenanceKmControlEnabled: this.planEntitlements.effectiveMaintenanceKmEnabled(),
      maintenanceKmIntervalDefault: this.session.maintenanceKmIntervalDefault(),
      maintenanceDateControlEnabled:
        this.planEntitlements.effectiveMaintenanceDateEnabled(),
      maintenanceDatePeriodDefault: this.session.maintenanceDatePeriodDefault(),
    }),
  );

  readonly companyKmMaintControlActive = computed(
    () => this.companyMaintPolicy().kmControlEnabled,
  );

  readonly companyDateMaintControlActive = computed(
    () => this.companyMaintPolicy().dateControlEnabled,
  );

  readonly showInsurancePaymentScheduleTable = computed(() =>
    showInsurancePaymentSchedule(this.meta()?.insurancePaymentCadence),
  );

  readonly isAnnualInsurancePolicy = computed(() =>
    isAnnualInsuranceCadence(this.meta()?.insurancePaymentCadence),
  );

  readonly insurancePaymentSchedule = computed(() =>
    buildInsurancePaymentSchedule({
      meta: this.meta(),
      expenses: this.insurancePaymentExpenses(),
      today: new Date(this.today),
    }),
  );

  readonly showGpsPaymentScheduleTable = computed(() => showGpsPaymentSchedule(this.meta()));

  readonly isAnnualGpsPolicy = computed(() =>
    isAnnualGpsCadence(this.meta()?.gpsPaymentCadence),
  );

  readonly gpsPaymentSchedule = computed(() =>
    buildGpsPaymentSchedule({
      meta: this.meta(),
      expenses: this.gpsPaymentExpenses(),
      today: new Date(this.today),
    }),
  );

  readonly showTenurePaymentScheduleTable = computed(() =>
    showTenurePaymentSchedule(this.meta()),
  );

  readonly tenurePaymentSchedule = computed(() =>
    buildTenurePaymentSchedule({
      meta: this.meta(),
      expenses: this.tenurePaymentExpenses(),
      today: new Date(this.today),
    }),
  );

  readonly unitOverride = signal<Partial<Unit>>({});
  readonly metaOverride = signal<Partial<UnitFleetMeta>>({});
  readonly localMaintEntries = signal<MaintenanceEntry[]>([]);

  readonly effUnit = computed<Unit>(() => {
    const base = this.unit();
    const u = this.unitOverride();
    const m = this.metaOverride();
    return {
      ...base,
      ...u,
      fleetMeta: { ...(base.fleetMeta ?? {}), ...m },
    };
  });

  readonly editingSection = signal<UnitEditingSection>(null);
  readonly detailTab = signal<UnitDetailDrawerTab>('mant');

  bindHostCallbacks(callbacks: FleetUnitDetailDrawerHostCallbacks): void {
    this.dismissCallback = callbacks.dismiss;
    this.viewHitchedEquipmentCallback = callbacks.viewHitchedEquipment;
  }

  /** Carga detalle completo al abrir; el listado solo trae summary. */
  bindHostUnit(unit: Unit): void {
    const prevUnitId = this.unitSource()?.id ?? '';
    const nextUnitId = unit.id;
    const unitIdChanged = prevUnitId !== nextUnitId;

    if (unitIdChanged) {
      this.equipmentFeature.loadEquipment();
      const listRow =
        this.unitsFeature.units().find((u) => u.id === nextUnitId) ?? unit;
      this.unitSource.set(listRow);
      this.unitOverride.set({});
      this.metaOverride.set({});
      this.insurancePaymentExpenses.set([]);
      this.gpsPaymentExpenses.set([]);
      this.tenurePaymentExpenses.set([]);
      this.editingSection.set(null);
      this.drawerLoading.set(true);
      if (prevUnitId) {
        this.cancelHitchForms();
      }
      this.unitsFeature
        .fetchUnitDetail(nextUnitId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (detail) => {
            if (this.unitSource()?.id !== nextUnitId) {
              return;
            }
            if (detail) {
              this.unitSource.set(detail);
              this.syncCatalogFromFeature();
            }
            this.drawerLoading.set(false);
          },
          error: () => {
            if (this.unitSource()?.id === nextUnitId) {
              this.drawerLoading.set(false);
            }
          },
        });
      return;
    }

    this.syncHostUnitFromFeatureList(nextUnitId);
  }

  private syncHostUnitFromFeatureList(unitId: string): void {
    if (this.editingSection() !== null) {
      const incoming = this.unitsFeature.selectedUnit();
      if (incoming) {
        this.applyHostUnitSnapshotWhenRicher(incoming);
      }
      return;
    }
    // Listado slim: no sobrescribir detalle ya hidratado.
    const current = this.unitSource();
    if (current?.id === unitId && this.unitHasRichDetailSnapshot(current)) {
      return;
    }
    const resolved = this.unitsFeature.units().find((u) => u.id === unitId);
    if (!resolved || !current) {
      return;
    }
    const resolvedMeta = JSON.stringify(resolved.fleetMeta ?? {});
    const currentMeta = JSON.stringify(current.fleetMeta ?? {});
    if (resolvedMeta !== currentMeta) {
      const hitched = resolveHitchedEquipmentForUnit(
        unitId,
        this.equipmentFeature.equipment(),
        current.hitchedEquipment?.length
          ? current.hitchedEquipment
          : resolved.hitchedEquipment,
        { catalogAuthoritative: this.equipmentFeature.hydrated() },
      );
      this.unitSource.set(
        this.domain.mergeUnitListRowIntoDetail(current, resolved, hitched),
      );
      this.metaOverride.set({});
    }
  }

  private unitHasRichDetailSnapshot(unit: Unit): boolean {
    if ((unit.hitchedEquipment?.length ?? 0) > 0) {
      return true;
    }
    return this.unitHasDetailHistory(unit);
  }

  private unitHasDetailHistory(unit: Unit): boolean {
    const meta = unit.fleetMeta;
    return !!(
      meta?.maintenanceEntries?.length ||
      meta?.verificationEntries?.length ||
      meta?.fleetDocuments?.length ||
      meta?.documentMaintenanceNames?.length ||
      meta?.documentVerificationNames?.length ||
      meta?.documentPolicyNames?.length ||
      meta?.documentOwnershipNames?.length ||
      meta?.trailerTenureMode !== undefined
    );
  }

  private syncCatalogFromFeature(): void {
    const unit = this.unitsFeature.selectedUnit();
    if (!unit) {
      return;
    }
    const catalog = this.equipmentFeature.equipment();
    const catalogAuthoritative = this.equipmentFeature.hydrated();
    this.equipmentCatalogSource.set([...catalog]);
    const source = this.unitSource() ?? unit;
    const hitched = resolveHitchedEquipmentForUnit(
      source.id || unit.id,
      catalog,
      source.hitchedEquipment,
      { catalogAuthoritative },
    );
    this.hitchedEquipmentSource.set(hitched);
    const current = this.unitSource();
    if (current && catalogAuthoritative) {
      const prevLen = current.hitchedEquipment?.length ?? 0;
      if (prevLen !== hitched.length) {
        this.unitSource.set({
          ...current,
          hitchedEquipment: hitched.length > 0 ? hitched : undefined,
        });
      }
    }
  }

  private applyHostUnitSnapshotWhenRicher(incoming: Unit): void {
    const current = this.unitSource();
    if (!current) {
      return;
    }
    const next = this.domain.applyHostUnitSnapshotWhenRicher(current, incoming);
    if (next) {
      this.unitSource.set(next);
    }
  }

  requestFocusDetailTab(tab: UnitDetailDrawerTab): void {
    this.focusDetailTab(tab);
  }

  syncHostLayout(layout: FleetUnitDetailDrawerHostLayout): void {
    this.onRouteSource.set(layout.onRoute);
    this.syncCatalogFromFeature();
    if (layout.onRoute && this.editingSection() === 'hitch') {
      this.cancelEditHitchAdd();
    }
  }

  selectDetailTab(tab: UnitDetailDrawerTab): void {
    this.focusDetailTab(tab);
  }

  private focusDetailTab(tab: UnitDetailDrawerTab): void {
    if (this.detailTab() === tab) {
      return;
    }
    this.cancelEdit();
    this.addingMaint.set(false);
    this.resetNewMaintForm();
    this.detailTab.set(tab);
  }

  cancelEdit(): void {
    this.clearStagedDocUploads();
    this.cancelHitchForms();
    this.verifClearConfirmScope.set(null);
    this.editingSection.set(null);
  }

  private clearStagedDocUploads(): void {
    this.editOwnershipNewFiles.set([]);
    this.editPolicyNewFiles.set([]);
    this.editVerifNewFiles.set([]);
  }

  resetOnUnitIdentityChange(): void {
    this.unitOverride.set({});
    this.metaOverride.set({});
    this.editingSection.set(null);
    this.localMaintEntries.set([]);
  }

  requestDismiss(): void {
    this.dismissCallback?.();
  }

  openDeleteConfirm(): void {
    if (!this.canDeleteUnit() || this.deleteBlockedByRoute() || this.deleteSubmitting()) {
      return;
    }
    this.deleteConfirmOpen.set(true);
  }

  closeDeleteConfirm(): void {
    if (this.deleteSubmitting()) {
      return;
    }
    this.deleteConfirmOpen.set(false);
  }

  confirmDeleteUnit(): void {
    if (!this.canDeleteUnit() || this.deleteBlockedByRoute() || this.deleteSubmitting()) {
      return;
    }
    const unit = this.effUnit();
    const label = this.trailerOperationalId();
    this.deleteSubmitting.set(true);
    this.unitsFeature
      .deleteUnit(unit.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleteSubmitting.set(false);
          this.deleteConfirmOpen.set(false);
          this.fleetFeature.refreshFleetModule();
          this.toast.show(`Unidad ${label} dada de baja.`, 'success');
          this.requestDismiss();
        },
        error: (err: unknown) => {
          this.deleteSubmitting.set(false);
          const detail = parseHttpApiErrorMessage(err)?.trim() ?? '';
          this.toast.show(
            detail || 'No se pudo dar de baja la unidad. Inténtalo de nuevo.',
            'error',
          );
        },
      });
  }

  submitMaintenanceAction(): void {
    if (!this.canWriteFleet()) {
      return;
    }
    const action = this.maintenanceAction();
    if (!action || this.maintenanceSubmitting()) {
      return;
    }
    const unit = this.effUnit();
    const label = this.trailerOperationalId();
    this.maintenanceSubmitting.set(true);
    this.unitsFeature
      .setUnitMaintenance(unit.id, action)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.maintenanceSubmitting.set(false);
          this.unitSource.set(saved);
          this.unitOverride.set({});
          this.fleetFeature.refreshFleetModule();
          this.toast.show(
            action === 'start'
              ? `Unidad ${label} en mantenimiento; no estará disponible para maniobras.`
              : `Unidad ${label} disponible de nuevo para operación.`,
            'success',
          );
        },
        error: (err: unknown) => {
          this.maintenanceSubmitting.set(false);
          const detail = parseHttpApiErrorMessage(err)?.trim() ?? '';
          this.toast.show(
            detail || 'No se pudo actualizar el estado de mantenimiento.',
            'error',
          );
        },
      });
  }

  requestViewHitchedEquipment(equipment: Equipment): void {
    this.viewHitchedEquipmentCallback?.(equipment);
  }

  meta(): UnitFleetMeta | undefined {
    return this.effUnit().fleetMeta;
  }

  isEditing(section: NonNullable<UnitEditingSection>): boolean {
    return this.editingSection() === section;
  }

  showSectionEdit(section: NonNullable<UnitEditingSection>): boolean {
    return this.canWriteFleet() && !this.isEditing(section);
  }

  persistCurrentUnit(
    successMessage: string,
    draft?: UnitPersistDraft,
    options?: FleetPersistOptions,
  ): void {
    if (this.saving()) {
      return;
    }
    const localMaint = this.localMaintEntries();
    const unitToSend = this.domain.unitForPersist(this.effUnit(), localMaint, draft);
    const effectiveDraft = resolveUnitPersistDraft(draft, unitToSend, localMaint.length > 0);
    this.saving.set(true);
    this.unitsFeature
      .updateUnit(unitToSend, effectiveDraft, { skipListRefresh: options?.skipListRefresh })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          const next = options?.syncedDocuments
            ? applySyncedFleetDocuments(saved, this.unitSource(), options.syncedDocuments)
            : saved;
          this.unitSource.set(next);
          this.unitOverride.set({});
          this.metaOverride.set({});
          this.localMaintEntries.set([]);
          this.syncCatalogFromFeature();
          if (!options?.skipFleetRefresh) {
            this.fleetFeature.refreshFleetModule({
              skipUnits: options?.skipListRefresh !== true,
            });
          }
          this.toast.show(successMessage, 'success');
          this.editingSection.set(null);
          options?.onSuccess?.();
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudo guardar en el servidor.', 'error');
        },
      });
  }

  persistEquipment(
    successMessage: string,
    equipment: Equipment,
    draft: EquipmentPersistDraft,
    onSuccess?: () => void,
  ): void {
    if (this.saving()) {
      return;
    }
    const effectiveDraft = resolveEquipmentPersistDraft(draft, equipment, false);
    this.saving.set(true);
    this.equipmentFeature
      .updateEquipment(equipment, effectiveDraft, { skipListRefresh: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.syncCatalogFromFeature();
          this.fleetFeature.refreshFleetModule();
          this.toast.show(successMessage, 'success');
          onSuccess?.();
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudo actualizar el equipo.', 'error');
        },
      });
  }

  readonly convoySummary = computed(() =>
    unitConvoyFromEquipment(this.hitchedEquipment(), this.opResolver),
  );

  readonly hitchedEquipmentRows = computed(() => {
    const list = this.hitchedEquipment();
    const total = list.length;
    return list.map((eq, index) => ({
      equipment: eq,
      positionLabel: equipmentHitchPositionDisplayLabel(eq, index, total),
      typeLabel: equipmentTypeDisplayLabel(eq),
      operationalId: formatEquipmentOperationalId(eq),
      plate: eq.plate?.trim() || '—',
    }));
  });

  readonly unitAllowsHitch = computed(() => unitCanHitchEquipment(this.effUnit()));

  readonly canAddHitch = computed(
    () =>
      this.unitAllowsHitch() &&
      !this.onRoute() &&
      (!this.equipmentFeature.hydrated() ||
        unitHasHitchSlot(this.equipmentCatalog(), this.unit().id)),
  );

  private readonly hitchBlockedMessage =
    'No puede enganchar ni desenganchar equipos mientras la unidad está en curso.';

  private hitchBlocked(): boolean {
    if (!this.unitAllowsHitch()) {
      this.toast.show(UNIT_HITCH_NOT_TRACTOR_MESSAGE, 'warning');
      return true;
    }
    if (!this.onRoute()) {
      return false;
    }
    this.toast.show(this.hitchBlockedMessage, 'warning');
    return true;
  }

  readonly hitchSelectableEquipment = computed(() =>
    equipmentSelectableForUnitHitch(this.equipmentCatalog(), this.unit().id).filter(
      (e) => !resourceIdsEqual(e.unitId, this.unit().id),
    ),
  );

  readonly hitchAddEquipmentId = signal('');
  readonly hitchAddIsSecondTrailer = signal(false);
  readonly hitchLeadUnhitchConfirmOpen = signal(false);
  private readonly pendingUnhitchEquipment = signal<Equipment | null>(null);

  readonly hitchLeadUnhitchRearLabel = computed(() => {
    const pending = this.pendingUnhitchEquipment();
    if (!pending) {
      return '';
    }
    const rear = rearEquipmentToPromoteOnLeadUnhitch(
      this.hitchWorkingCatalog(),
      pending,
    );
    return rear ? formatEquipmentOperationalId(rear) : '';
  });

  private hitchWorkingCatalog(): readonly Equipment[] {
    if (this.equipmentFeature.hydrated()) {
      return this.equipmentCatalog();
    }
    return this.hitchedEquipment();
  }

  private unitTractorLabel(): string {
    return formatUnitTrailerOperationalId(this.effUnit());
  }

  readonly hitchAddActionLabel = computed(() =>
    equipmentHitchAddActionLabel(this.equipmentCatalog(), this.unit().id),
  );

  readonly hitchAddValidation = computed(() =>
    validateEquipmentHitchAssignment({
      unitId: this.unit().id,
      catalog: this.equipmentCatalog(),
      isSecondTrailer: this.hitchAddIsSecondTrailer(),
      unitLabel: this.unitTractorLabel(),
    }),
  );

  cancelHitchForms(): void {
    this.hitchAddEquipmentId.set('');
    this.hitchAddIsSecondTrailer.set(false);
  }

  startEditHitchAdd(): void {
    if (!this.canWriteFleet() || this.hitchBlocked()) {
      return;
    }
    this.equipmentFeature.loadEquipment();
    this.hitchAddEquipmentId.set('');
    this.detailTab.set('ficha');
    this.editingSection.set('hitch');
  }

  cancelEditHitchAdd(): void {
    this.hitchAddEquipmentId.set('');
    this.hitchAddIsSecondTrailer.set(false);
    this.editingSection.set(null);
  }

  saveHitchAdd(): void {
    if (!this.canWriteFleet() || this.hitchBlocked()) {
      return;
    }
    const equipmentId = this.hitchAddEquipmentId().trim();
    if (!equipmentId) {
      this.toast.show('Seleccione un equipo para enganchar.', 'warning');
      return;
    }
    const validation = this.hitchAddValidation();
    if (!validation.canSave) {
      this.toast.show(
        validation.blockMessage ?? validation.infoMessage ?? 'Revise el enganche.',
        'warning',
      );
      return;
    }
    const equipment = this.equipmentCatalog().find((e) =>
      resourceIdsEqual(e.id, equipmentId),
    );
    if (!equipment) {
      this.toast.show('Equipo no encontrado.', 'warning');
      return;
    }
    const draft: EquipmentPersistDraft = {
      equipment: {
        unitId: this.unit().id,
        hitchPosition: hitchPositionForNewEquipmentOnUnit(
          this.equipmentCatalog(),
          this.unit().id,
          equipment.id,
        ),
      },
    };
    this.persistEquipment('Equipo enganchado.', equipment, draft, () => {
      this.cancelEditHitchAdd();
    });
  }

  unhitchEquipment(equipment: Equipment): void {
    if (!this.canWriteFleet() || this.hitchBlocked()) {
      return;
    }
    if (unhitchingLeadRequiresRearPromotion(this.hitchWorkingCatalog(), equipment)) {
      this.pendingUnhitchEquipment.set(equipment);
      this.hitchLeadUnhitchConfirmOpen.set(true);
      return;
    }
    this.commitUnhitchEquipment(equipment);
  }

  confirmUnhitchLeadEquipment(): void {
    const equipment = this.pendingUnhitchEquipment();
    this.hitchLeadUnhitchConfirmOpen.set(false);
    this.pendingUnhitchEquipment.set(null);
    if (!equipment) {
      return;
    }
    this.commitUnhitchEquipment(equipment);
  }

  cancelUnhitchLeadEquipment(): void {
    this.hitchLeadUnhitchConfirmOpen.set(false);
    this.pendingUnhitchEquipment.set(null);
  }

  private commitUnhitchEquipment(equipment: Equipment): void {
    const rearToPromote = rearEquipmentToPromoteOnLeadUnhitch(
      this.hitchWorkingCatalog(),
      equipment,
    );
    const unhitchDraft: EquipmentPersistDraft = {
      equipment: equipmentUnhitchPersistDraft(),
    };
    if (!rearToPromote) {
      this.persistEquipment('Equipo desenganchado.', equipment, unhitchDraft, () => {
        /* noop */
      });
      return;
    }

    if (this.saving()) {
      return;
    }
    const promoteDraft: EquipmentPersistDraft = {
      equipment: equipmentPromoteToLeadPersistDraft(),
    };
    const effectiveUnhitch = resolveEquipmentPersistDraft(unhitchDraft, equipment, false);
    const effectivePromote = resolveEquipmentPersistDraft(
      promoteDraft,
      rearToPromote,
      false,
    );
    // Primero desenganchar el 1.er; si se promueve el 2.do antes, el backend rechaza otro lead.
    this.saving.set(true);
    this.equipmentFeature
      .updateEquipment(equipment, effectiveUnhitch, { skipListRefresh: true })
      .pipe(
        switchMap(() =>
          this.equipmentFeature.updateEquipment(rearToPromote, effectivePromote, {
            skipListRefresh: true,
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.syncCatalogFromFeature();
          this.fleetFeature.refreshFleetModule();
          this.toast.show('Equipo desenganchado.', 'success');
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudo actualizar el equipo.', 'error');
        },
      });
  }


  readonly cadenceOptions = FLEET_PAYMENT_CADENCE_OPTIONS;
  readonly insurancePaymentMethodOptions = EXPENSE_PAYMENT_METHOD_OPTIONS.filter(
    (o) => o.value !== '',
  );
  readonly today = fleetDrawerTodayIso();

  insurancePaymentMethodLabel(code?: string): string {
    return expensePaymentMethodLabel(code);
  }

  readonly editPhysVerifDate = signal('');
  readonly editPhysVerifCost = signal('');
  readonly editEmisVerifDate = signal('');
  readonly editEmisVerifCost = signal('');
  readonly editDoubleVerifDate = signal('');
  readonly editDoubleVerifCost = signal('');
  readonly verifClearConfirmScope = signal<ExpenseVerificationScope | null>(null);

  hasVerifDate(iso: string | undefined): boolean {
    return Boolean(iso?.trim());
  }

  physEmisExemptionActive(): boolean {
    return isWithinFleetModelTwoYearExemption(this.effUnit().trailerYear);
  }

  physEmisExemptionEndLabel(): string {
    const end = fleetModelTwoYearExemptionEndYmd(this.effUnit().trailerYear);
    return end ? formatFleetYmdMx(end) : '—';
  }

  physEmisExemptionMessage(): string {
    const year = (this.effUnit().trailerYear ?? '').trim();
    const why = year ? ` Motivo: modelo ${year}.` : '';
    return `Físico-mecánica y emisiones: no aplican el ciclo de 6 meses durante 2 años.${why} El seguimiento rige a partir del ${this.physEmisExemptionEndLabel()} y el primer gasto queda programado en el ledger.`;
  }

  physVerifInputsDisabled(): boolean {
    return this.physEmisExemptionActive();
  }

  emissionsVerifInputsDisabled(): boolean {
    return this.physEmisExemptionActive();
  }

  verifNextLabel(iso: string | undefined, exempt: boolean): string {
    if (iso?.trim()) {
      return this.nextMx(iso, this.verifCycleMo);
    }
    return exempt ? this.physEmisExemptionEndLabel() : '—';
  }

  verifRenewalBucket(iso: string | undefined, exempt: boolean): FleetRenewalBucket {
    if (exempt && !iso?.trim()) {
      return 'ok';
    }
    return this.renewalBucketFor(iso);
  }

  requestClearVerification(scope: ExpenseVerificationScope): void {
    if (!this.canWriteFleet() || this.saving()) {
      return;
    }
    this.verifClearConfirmScope.set(scope);
  }

  closeClearVerificationConfirm(): void {
    this.verifClearConfirmScope.set(null);
  }

  verifClearConfirmName(): string {
    switch (this.verifClearConfirmScope()) {
      case 'phys_mech':
        return 'físico-mecánica';
      case 'emissions':
        return 'emisiones';
      case 'double_articulated':
        return 'doble articulado';
      default:
        return 'esta verificación';
    }
  }

  confirmClearVerification(): void {
    const scope = this.verifClearConfirmScope();
    if (!scope || this.saving()) {
      return;
    }
    this.verifClearConfirmScope.set(null);
    const fleetMeta: Partial<UnitFleetMeta> = {
      clearedVerificationScopes: [scope],
    };
    if (scope === 'double_articulated') {
      fleetMeta.verificationDoubleArticulatedApplies = false;
    }
    this.persistCurrentUnit('Verificación eliminada.', { fleetMeta }, COB_SECTION_PERSIST_OPTIONS);
  }

  // -- Seguro: form signals --
  readonly editInsCarrierName = signal('');
  readonly editInsPolicyNumber = signal('');
  readonly editInsContractDate = signal('');
  readonly editInsCadence = signal('');
  readonly editInsPaymentMethod = signal('');
  readonly editInsCost = signal('');
  /** Póliza y comprobantes (copia editable al abrir seguro). */
  readonly editPolicyDocs = signal<FleetStoredDocument[]>([]);
  readonly editPolicyNewFiles = signal<File[]>([]);
  /** Documentos de verificación (copia editable). */
  readonly editVerifDocs = signal<FleetStoredDocument[]>([]);
  readonly editVerifNewFiles = signal<File[]>([]);

  startEditInsurance(): void {
    this.requestFocusDetailTab('cob');
    this.clearStagedDocUploads();
    const m = this.meta() ?? {};
    this.editInsCarrierName.set(m.insuranceCarrierName?.trim() || '');
    this.editInsPolicyNumber.set(m.insurancePolicyNumber?.trim() || '');
    this.editInsContractDate.set(m.insuranceContractDate ?? '');
    this.editInsCadence.set(
      fleetValueFromLabel(this.cadenceOptions, m.insurancePaymentCadence) ||
        m.insurancePaymentCadence?.trim() ||
        '',
    );
    this.editInsPaymentMethod.set(m.insurancePaymentMethod?.trim() || '');
    this.editInsCost.set(formatMoneyInputValue(m.insuranceCost));
    this.editPolicyDocs.set([...this.docs('policy')]);
    this.editingSection.set('insurance');
  }

  removeEditPolicyDoc(index: number): void {
    this.editPolicyDocs.update((prev) => prev.filter((_, i) => i !== index));
  }

  onEditInsurancePolicyFiles(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    if (list.length === 0) {
      return;
    }
    this.editPolicyNewFiles.update((prev) => [...prev, ...list]);
    input.value = '';
  }

  removeEditInsurancePolicyNewFile(index: number): void {
    this.editPolicyNewFiles.update((prev) => prev.filter((_, i) => i !== index));
  }

  startEditVerif(): void {
    if (!this.canWriteFleet()) {
      return;
    }
    this.requestFocusDetailTab('cob');
    this.clearStagedDocUploads();
    this.verifClearConfirmScope.set(null);
    this.editPhysVerifDate.set('');
    this.editPhysVerifCost.set('');
    this.editEmisVerifDate.set('');
    this.editEmisVerifCost.set('');
    this.editDoubleVerifDate.set('');
    this.editDoubleVerifCost.set('');
    this.editVerifDocs.set([...this.docs('verif')]);
    this.editingSection.set('verif');
  }

  removeEditVerifDoc(index: number): void {
    this.editVerifDocs.update((prev) => prev.filter((_, i) => i !== index));
  }

  onEditVerifFiles(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    if (list.length === 0) {
      return;
    }
    this.editVerifNewFiles.update((prev) => [...prev, ...list]);
    input.value = '';
  }

  removeEditVerifNewFile(index: number): void {
    this.editVerifNewFiles.update((prev) => prev.filter((_, i) => i !== index));
  }

  saveEditVerif(): void {
    if (!this.canWriteFleet() || this.saving()) {
      return;
    }
    const fleetMeta = this.buildUnitVerifEditPatch();
    if (fleetMeta === 'invalid') {
      return;
    }
    const original = this.docs('verif');
    const kept = this.editVerifDocs();
    const files = this.editVerifNewFiles();
    const hasMetaPatch = Object.keys(fleetMeta).length > 0;
    this.saving.set(true);
    this.syncUnitDocuments('verification', kept, files, original)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (uploaded) => {
          this.editVerifNewFiles.set([]);
          const syncedDocuments = {
            kind: 'verification' as const,
            kept,
            uploaded,
          };
          if (hasMetaPatch) {
            this.saving.set(false);
            this.persistCurrentUnit(
              'Verificaciones actualizadas.',
              { fleetMeta },
              {
                ...COB_SECTION_PERSIST_OPTIONS,
                syncedDocuments,
              },
            );
            return;
          }
          this.saving.set(false);
          const next = applySyncedFleetDocuments(
            this.effUnit(),
            this.unitSource(),
            syncedDocuments,
          );
          this.unitSource.set(next);
          this.unitsFeature.upsertUnitSummary(next);
          this.metaOverride.set({});
          this.toast.show('Documentos de verificación actualizados.', 'success');
          this.editingSection.set(null);
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudieron guardar las verificaciones.', 'error');
        },
      });
  }

  private buildUnitVerifEditPatch(): Partial<UnitFleetMeta> | 'invalid' {
    const patch: Partial<UnitFleetMeta> = {};
    const apply = (
      dateRaw: string,
      costRaw: string,
      disabled: boolean,
      assign: (date: string, cost: number | undefined) => void,
    ): boolean => {
      if (disabled) {
        return true;
      }
      const date = dateRaw.trim();
      if (!date) {
        return true;
      }
      if (date > this.today) {
        this.toast.show('La fecha no puede ser futura.', 'warning');
        return false;
      }
      const cost = parseFleetOptionalAmount(costRaw);
      if (cost === 'invalid') {
        this.toast.show('El costo debe ser un número válido (≥ 0).', 'warning');
        return false;
      }
      assign(date, cost === undefined ? undefined : cost);
      return true;
    };

    if (
      !apply(
        this.editPhysVerifDate(),
        this.editPhysVerifCost(),
        this.physVerifInputsDisabled(),
        (date, cost) => {
          patch.verificationPhysMechDate = date;
          patch.verificationPhysMechCost = cost;
        },
      ) ||
      !apply(
        this.editEmisVerifDate(),
        this.editEmisVerifCost(),
        this.emissionsVerifInputsDisabled(),
        (date, cost) => {
          patch.verificationEmissionsDate = date;
          patch.verificationEmissionsCost = cost;
        },
      ) ||
      !apply(this.editDoubleVerifDate(), this.editDoubleVerifCost(), false, (date, cost) => {
        patch.verificationDoubleArticulatedApplies = true;
        patch.verificationDoubleArticulatedDate = date;
        patch.verificationDoubleArticulatedCost = cost;
      })
    ) {
      return 'invalid';
    }
    return patch;
  }

  saveEditInsurance(): void {
    const cost = parseFleetOptionalAmount(this.editInsCost());
    if (cost === 'invalid') {
      this.toast.show('El costo del seguro debe ser un número válido (≥ 0).', 'warning');
      return;
    }
    if (this.saving()) {
      return;
    }
    const cadenceLabel =
      this.cadenceOptions.find((o) => o.value === this.editInsCadence())?.label ||
      this.editInsCadence().trim() ||
      undefined;
    const fleetMetaDraft: Partial<UnitFleetMeta> = {
      insuranceCarrierName: this.editInsCarrierName().trim() || undefined,
      insurancePolicyNumber: this.editInsPolicyNumber().trim() || undefined,
      insuranceContractDate: this.editInsContractDate().trim() || undefined,
      insurancePaymentCadence: cadenceLabel,
      insurancePaymentMethod: this.editInsPaymentMethod().trim() || undefined,
      insuranceCost: cost === undefined ? undefined : cost,
    };
    const original = this.docs('policy');
    const kept = this.editPolicyDocs();
    const files = this.editPolicyNewFiles();
    this.saving.set(true);
    this.syncUnitDocuments('policy', kept, files, original)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (uploaded) => {
          this.editPolicyNewFiles.set([]);
          this.saving.set(false);
          this.persistCurrentUnit(
            'Seguro actualizado.',
            { fleetMeta: fleetMetaDraft },
            {
              ...COB_SECTION_PERSIST_OPTIONS,
              syncedDocuments: { kind: 'policy', kept, uploaded },
            },
          );
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudieron guardar los documentos del seguro.', 'error');
        },
      });
  }

  // -- GPS: form signals --
  readonly editGpsBrand = signal('');
  readonly editGpsContractDate = signal('');
  readonly editGpsCadence = signal('annual');
  readonly editGpsPaymentMethod = signal('');
  readonly editGpsPrice = signal('');
  readonly editGpsPortal = signal('');
  readonly editGpsEndorse = signal(false);

  startEditGps(): void {
    this.requestFocusDetailTab('cob');
    this.clearStagedDocUploads();
    const m = this.meta() ?? {};
    this.editGpsBrand.set(m.gpsProviderBrand?.trim() || '');
    this.editGpsContractDate.set(m.gpsContractDate ?? '');
    const cadRaw = m.gpsPaymentCadence?.trim() || '';
    this.editGpsCadence.set(
      fleetValueFromLabel(this.cadenceOptions, cadRaw) ||
        (this.cadenceOptions.some((o) => o.value === cadRaw) ? cadRaw : '') ||
        'annual',
    );
    this.editGpsPaymentMethod.set(m.gpsPaymentMethod?.trim() || '');
    this.editGpsPrice.set(formatMoneyInputValue(m.gpsPrice));
    this.editGpsPortal.set(m.gpsTrackingPortalUrl?.trim() || '');
    this.editGpsEndorse.set(m.gpsCoveredByInsuranceEndorsement === true);
    this.editingSection.set('gps');
  }

  toggleEditGpsEndorse(): void {
    this.editGpsEndorse.set(!this.editGpsEndorse());
  }

  saveEditGps(): void {
    const hasContent = gpsFleetFormHasContent({
      brand: this.editGpsBrand(),
      contractDate: this.editGpsContractDate(),
      price: this.editGpsPrice(),
      portal: this.editGpsPortal(),
    });
    if (!hasContent) {
      const fleetMetaDraft: Partial<UnitFleetMeta> = {
        hasGps: false,
        gpsProviderBrand: undefined,
        gpsPrice: undefined,
        gpsPaymentCadence: undefined,
        gpsContractDate: undefined,
        gpsLastPaymentDate: undefined,
        gpsPaymentMethod: undefined,
        gpsTrackingPortalUrl: undefined,
        gpsCoveredByInsuranceEndorsement: undefined,
      };
      this.persistCurrentUnit(
        'GPS actualizado.',
        { fleetMeta: fleetMetaDraft },
        COB_SECTION_PERSIST_OPTIONS,
      );
      return;
    }
    const price = parseFleetOptionalAmount(this.editGpsPrice());
    if (price === 'invalid') {
      this.toast.show('El precio del GPS debe ser un número válido (≥ 0).', 'warning');
      return;
    }
    const cadenceLabel =
      this.cadenceOptions.find((o) => o.value === this.editGpsCadence())?.label ||
      this.editGpsCadence().trim() ||
      undefined;
    const fleetMetaDraft: Partial<UnitFleetMeta> = {
      hasGps: true,
      gpsProviderBrand: this.editGpsBrand().trim() || undefined,
      gpsContractDate: this.editGpsContractDate().trim() || undefined,
      gpsPaymentCadence: cadenceLabel,
      gpsPaymentMethod: this.editGpsPaymentMethod().trim() || undefined,
      gpsPrice: price === undefined ? undefined : price,
      gpsTrackingPortalUrl: this.editGpsPortal().trim() || undefined,
      gpsCoveredByInsuranceEndorsement: this.editGpsEndorse() ? true : undefined,
    };
    this.persistCurrentUnit(
      'GPS actualizado.',
      { fleetMeta: fleetMetaDraft },
      COB_SECTION_PERSIST_OPTIONS,
    );
  }

  /** Formulario inline de mantenimiento concluido (historial + gasto). */
  readonly addingMaint = signal(false);
  readonly newMaintType = signal('servicio_completo');
  readonly newMaintCost = signal('');
  readonly newMaintPaymentMethod = signal('');
  readonly newMaintDate = signal('');
  readonly newMaintNotes = signal('');
  readonly newMaintFiles = signal<File[]>([]);

  readonly newMaintTypeOptions = FLEET_MAINTENANCE_TYPE_OPTIONS;
  readonly newMaintPaymentMethodOptions = EXPENSE_PAYMENT_METHOD_OPTIONS;

  readonly newMaintMaxDate = computed(() => this.today);

  readonly editingMaintenanceKmCounter = signal(false);
  readonly editMaintenanceKmCounter = signal('');

  canEditMaintenanceKmCounter(): boolean {
    return this.canWriteFleet() && this.maintenanceUsesKm();
  }

  startEditMaintenanceKmCounter(): void {
    if (!this.canEditMaintenanceKmCounter()) {
      return;
    }
    this.requestFocusDetailTab('mant');
    const n = parseMaintenanceKmCounter(this.meta()?.maintenanceKmCounter);
    this.editMaintenanceKmCounter.set(
      n > 0
        ? new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(n)
        : '',
    );
    this.editingMaintenanceKmCounter.set(true);
  }

  cancelEditMaintenanceKmCounter(): void {
    this.editingMaintenanceKmCounter.set(false);
    this.editMaintenanceKmCounter.set('');
  }

  maintenanceKmCounterEditHint(): string | null {
    const interval = this.companyMaintPolicy().kmIntervalDefault;
    if (interval == null || !Number.isFinite(interval)) {
      return null;
    }
    const remaining = fleetMaintenanceKmRemainingFromCounterInput(
      this.editMaintenanceKmCounter(),
      this.companyMaintPolicy(),
    );
    if (remaining == null) {
      return null;
    }
    const intervalLabel = new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 0,
    }).format(interval);
    return `Intervalo de la empresa: ${intervalLabel} km. Faltarían ${formatMaintenanceKmRemainingLabel(remaining)} para el próximo servicio completo.`;
  }

  saveEditMaintenanceKmCounter(): void {
    if (!this.canEditMaintenanceKmCounter() || this.saving()) {
      return;
    }
    const parsed = parseMaintenanceKmCounterInput(this.editMaintenanceKmCounter());
    if (parsed === 'invalid') {
      this.toast.show('Indica km acumulados válidos (cero o mayor).', 'warning');
      return;
    }
    const metaPatch: Partial<UnitFleetMeta> = { maintenanceKmCounter: parsed };
    this.metaOverride.update((prev) => ({ ...prev, ...metaPatch }));
    this.editingMaintenanceKmCounter.set(false);
    this.editMaintenanceKmCounter.set('');
    this.persistCurrentUnit('Km acumulados de mantenimiento actualizados.', {
      fleetMeta: metaPatch,
    });
  }

  private maintTypeLabel(value: string): string {
    return (
      this.newMaintTypeOptions.find((o) => o.value === value)?.label ?? value
    );
  }

  openNewMaint(): void {
    if (!this.canWriteFleet()) {
      return;
    }
    this.requestFocusDetailTab('mant');
    this.resetNewMaintForm();
    this.addingMaint.set(true);
  }

  cancelNewMaint(): void {
    this.addingMaint.set(false);
    this.resetNewMaintForm();
  }

  resetNewMaintForm(): void {
    this.newMaintType.set('servicio_completo');
    this.newMaintCost.set('');
    this.newMaintPaymentMethod.set('');
    this.newMaintDate.set('');
    this.newMaintNotes.set('');
    this.newMaintFiles.set([]);
  }

  onNewMaintFiles(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    if (list.length === 0) {
      return;
    }
    this.newMaintFiles.update((prev) => [...prev, ...list]);
    input.value = '';
  }

  removeNewMaintFile(index: number): void {
    this.newMaintFiles.update((prev) => prev.filter((_, i) => i !== index));
  }

  saveNewMaint(): void {
    const date = this.newMaintDate().trim();
    if (!date) {
      this.toast.show('La fecha es obligatoria.', 'warning');
      return;
    }
    if (date > this.today) {
      this.toast.show(
        'La fecha del servicio no puede ser futura.',
        'warning',
      );
      return;
    }
    const cost = parseFleetOptionalAmount(this.newMaintCost());
    if (cost === 'invalid' || cost === undefined || cost <= 0) {
      this.toast.show(
        'El costo es obligatorio y debe ser mayor a cero.',
        'warning',
      );
      return;
    }

    const typeLabel = this.maintTypeLabel(this.newMaintType());
    const notes = this.newMaintNotes().trim() || undefined;
    const paymentMethod = this.newMaintPaymentMethod().trim() || undefined;
    const typeValue = this.newMaintType();
    const metaPatch: Partial<UnitFleetMeta> = {
      lastMaintenanceDate: date,
      lastMaintenanceType: typeLabel,
      lastMaintenanceCost: cost,
      lastMaintenanceNotes: notes,
    };
    if (
      this.companyKmMaintControlActive() &&
      fleetMaintenanceResetsKmCounter(typeValue)
    ) {
      metaPatch.maintenanceKmCounter = 0;
    }

    this.metaOverride.update((p) => ({ ...p, ...metaPatch }));

    const files = this.newMaintFiles();
    const entry: MaintenanceEntry = {
      date,
      type: typeLabel,
      cost,
      notes,
      paymentMethod,
      documentNames: files.length > 0 ? files.map((f) => f.name) : undefined,
      status: 'concluido',
    };
    const ledgerPayload = buildFleetMaintenanceExpensePayload({
      date,
      cost,
      typeValue,
      typeLabel,
      notes,
      paymentMethod,
      unitId: this.effUnit().id,
    });
    if (this.saving()) {
      return;
    }
    const existingDocs = this.docs('maint');
    this.saving.set(true);
    this.syncUnitDocuments('maintenance', existingDocs, files, existingDocs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.localMaintEntries.update((prev) => [...prev, entry]);
          this.addingMaint.set(false);
          this.resetNewMaintForm();
          this.saving.set(false);
          this.persistCurrentUnit('Mantenimiento agregado.', { fleetMeta: metaPatch }, {
            onSuccess: () => this.postMaintenanceLedgerExpense(ledgerPayload),
          });
        },
        error: () => {
          this.saving.set(false);
          this.toast.show(
            'No se pudieron subir los documentos del mantenimiento.',
            'error',
          );
        },
      });
  }

  private postMaintenanceLedgerExpense(payload: ExpenseWritePayload | null): void {
    if (!payload) {
      return;
    }
    this.expensesApi
      .postExpense(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.toast.show(FLEET_MAINTENANCE_LEDGER_ERROR, 'warning'),
      });
  }

  // -- Identificación: form signals --
  readonly editBrand = signal('');
  readonly editYear = signal('');
  readonly editVersion = signal('');
  readonly editPlate = signal('');
  readonly editColor = signal('');
  readonly editServiceModality = signal('');
  readonly editTransportType = signal('');
  readonly editVisibility = signal<'active' | 'inactive'>('active');
  readonly editSerial = signal('');
  readonly editMotorNumber = signal('');
  readonly editAlias = signal('');

  readonly unitBrandNames = this.fleetFeature.unitBrandNames;
  readonly editUnitVersionNames = computed(() =>
    this.fleetFeature.versionNamesFor('UNIT', this.editBrand()),
  );
  readonly visibilityOptions = FLEET_RESOURCE_VISIBILITY_OPTIONS;
  readonly serviceModalityOptions = FLEET_SERVICE_MODALITY_OPTIONS;
  readonly transportTypeOptions = FLEET_TRANSPORT_TYPE_OPTIONS;

  transportTypeLabel(): string {
    const value = this.effUnit().transportType?.trim();
    return (
      this.transportTypeOptions.find((option) => option.value === value)?.label ||
      value ||
      '—'
    );
  }

  resourceVisibilityLabel(): string {
    return fleetResourceActiveLabel(this.effUnit().isActive);
  }

  startEditId(): void {
    this.fleetFeature.ensureFleetCatalogLoaded();
    this.focusDetailTab('ficha');
    this.clearStagedDocUploads();
    const u = this.effUnit();
    const m = u.fleetMeta ?? {};
    const brandName = m.trailerBrandName?.trim() || u.trailerBrandAbbr?.trim() || '';
    this.editBrand.set(brandName);
    this.editYear.set(u.trailerYear?.trim() || '');
    this.editVersion.set(m.trailerVersion?.trim() || '');
    this.editPlate.set(u.plate ?? '');
    this.editColor.set(m.trailerColor?.trim() || '');
    this.editServiceModality.set(
      fleetValueFromLabel(this.serviceModalityOptions, m.serviceModality) ||
        m.serviceModality?.trim() ||
        '',
    );
    this.editTransportType.set(u.transportType?.trim() || '');
    this.editVisibility.set(u.isActive === false ? 'inactive' : 'active');
    this.editSerial.set(u.serialNumber?.trim() || '');
    this.editMotorNumber.set(u.motorNumber?.trim() || '');
    this.editAlias.set(u.name?.trim() || '');
    this.editingSection.set('id');
  }
  saveEditId(): void {
    const plate = this.editPlate().trim().toUpperCase();
    if (!plate) {
      this.toast.show('Placa es obligatoria.', 'warning');
      return;
    }
    const brandName = this.editBrand().trim();
    if (!brandName) {
      this.toast.show('Marca es obligatoria.', 'warning');
      return;
    }
    const yearParsed = parseFleetModelYear(this.editYear());
    if (!yearParsed.ok) {
      this.toast.show(fleetModelYearErrorMessage(yearParsed.reason), 'warning');
      return;
    }
    const brandAbbr = deriveFleetBrandAbbr(brandName);
    const unitDraft: Partial<Unit> = {
      plate,
      transportType: this.editTransportType().trim() || undefined,
      isActive: this.editVisibility() === 'active',
      trailerBrandAbbr: brandAbbr || undefined,
      trailerYear: yearParsed.year,
      serialNumber: this.editSerial().trim().toUpperCase() || undefined,
      motorNumber: this.editMotorNumber().trim().toUpperCase() || undefined,
      name: this.editAlias().trim() || undefined,
    };
    const fleetMetaDraft: Partial<UnitFleetMeta> = {
      trailerBrandName: brandName,
      trailerVersion: this.editVersion().trim() || undefined,
      trailerColor: this.editColor().trim() || undefined,
      serviceModality:
        this.serviceModalityOptions.find((o) => o.value === this.editServiceModality())
          ?.label ||
        this.editServiceModality().trim() ||
        undefined,
    };
    this.unitOverride.update((prev) => ({ ...prev, ...unitDraft }));
    this.metaOverride.update((prev) => ({ ...prev, ...fleetMetaDraft }));
    this.fleetFeature.registerLocalCatalogEntry(
      'UNIT',
      brandName,
      this.editVersion().trim() || undefined,
    );
    this.persistCurrentUnit('Identificación actualizada.', {
      unit: unitDraft,
      fleetMeta: fleetMetaDraft,
    });
  }

  // -- Propiedad y tenencia: form signals --
  readonly editTenureMode = signal<TrailerTenureMode>('owned');
  readonly editCommercialValue = signal('');
  readonly editRecurringAmount = signal('');
  readonly editRecurringDate = signal('');
  readonly editRecurringInstallments = signal('');
  readonly editRecurringCadence = signal('');
  readonly editTenureBeneficiary = signal('');
  readonly editOwnerPayout = signal('');
  /** Documentos de propiedad (copia editable al abrir tenencia). */
  readonly editOwnershipDocs = signal<FleetStoredDocument[]>([]);
  readonly editOwnershipNewFiles = signal<File[]>([]);

  readonly tenureOptions = this.planEntitlements.tenureOptions;
  readonly tenureCadenceOptions = FLEET_PAYMENT_CADENCE_OPTIONS;

  tenureCadenceLabel(): string {
    const cadence = this.meta()?.trailerRecurringPaymentCadence?.trim();
    if (!cadence) return '—';
    const opt = FLEET_PAYMENT_CADENCE_OPTIONS.find((o) => o.value === cadence);
    return opt?.label ?? cadence;
  }

  tenureRecurringAmountLabel(): string {
    return this.editTenureMode() === 'leased' ? 'Monto de renta' : 'Monto por cuota';
  }

  tenureInstallmentOrTermLabel(): string {
    return this.editTenureMode() === 'leased'
      ? 'Plazos o meses de contrato'
      : 'Total de cuotas';
  }

  startEditTenure(): void {
    this.focusDetailTab('ficha');
    this.clearStagedDocUploads();
    const m = this.meta() ?? {};
    this.editTenureMode.set(trailerTenureModeOrDefault(m.trailerTenureMode));
    this.editCommercialValue.set(formatMoneyInputValue(m.trailerCommercialValue));
    this.editRecurringAmount.set(formatMoneyInputValue(m.trailerRecurringPaymentAmount));
    this.editRecurringDate.set(m.trailerRecurringPaymentDate ?? '');
    this.editRecurringInstallments.set(
      m.trailerRecurringInstallmentCount != null
        ? String(m.trailerRecurringInstallmentCount)
        : '',
    );
    this.editRecurringCadence.set(m.trailerRecurringPaymentCadence ?? '');
    this.editTenureBeneficiary.set(m.trailerTenureBeneficiary ?? '');
    this.editOwnerPayout.set(formatMoneyInputValue(m.trailerManagementOwnerPayout));
    this.editOwnershipDocs.set([...this.docs('ownership')]);
    this.editingSection.set('tenure');
  }

  removeEditOwnershipDoc(index: number): void {
    this.editOwnershipDocs.update((prev) => prev.filter((_, i) => i !== index));
  }

  onEditTenureOwnershipFiles(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    if (list.length === 0) {
      return;
    }
    this.editOwnershipNewFiles.update((prev) => [...prev, ...list]);
    input.value = '';
  }

  removeEditTenureNewFile(index: number): void {
    this.editOwnershipNewFiles.update((prev) => prev.filter((_, i) => i !== index));
  }

  setEditTenureMode(raw: string): void {
    const mode = trailerTenureModeOrDefault(raw);
    if (!this.planEntitlements.isTenureModeAllowed(mode)) {
      this.toast.show(this.planEntitlements.tenureUpgradeMessage(), 'warning');
      this.editTenureMode.set('owned');
      return;
    }
    this.editTenureMode.set(mode);
  }

  saveEditTenure(): void {
    let mode = trailerTenureModeOrDefault(this.editTenureMode());
    if (!this.planEntitlements.isTenureModeAllowed(mode)) {
      this.toast.show(this.planEntitlements.tenureUpgradeMessage(), 'warning');
      mode = 'owned';
      this.editTenureMode.set('owned');
    }
    const commercial = parseFleetOptionalAmount(this.editCommercialValue());
    const recAmt = parseFleetOptionalAmount(this.editRecurringAmount());
    const recCount = parseFleetOptionalPositiveInt(this.editRecurringInstallments());
    const payout = parseFleetOptionalAmount(this.editOwnerPayout());
    if (
      commercial === 'invalid' ||
      recAmt === 'invalid' ||
      recCount === 'invalid' ||
      payout === 'invalid'
    ) {
      this.toast.show('Revisa los montos o plazos.', 'warning');
      return;
    }
    let trailerCommercialValue: number | undefined;
    let trailerRecurringPaymentAmount: number | undefined;
    let trailerRecurringPaymentDate: string | undefined;
    let trailerRecurringInstallmentCount: number | undefined;
    let trailerRecurringPaymentCadence: string | undefined;
    let trailerTenureBeneficiary: string | undefined;
    let trailerManagementOwnerPayout: number | undefined;
    if (mode === 'owned') {
      trailerCommercialValue = commercial === undefined ? undefined : commercial;
    } else if (mode === 'financed' || mode === 'leased') {
      trailerRecurringPaymentAmount = recAmt === undefined ? undefined : recAmt;
      trailerRecurringPaymentDate = this.editRecurringDate().trim() || undefined;
      trailerRecurringInstallmentCount = recCount === undefined ? undefined : recCount;
      trailerRecurringPaymentCadence = this.editRecurringCadence().trim() || undefined;
      trailerTenureBeneficiary = this.editTenureBeneficiary().trim() || undefined;
    } else if (mode === 'managed') {
      trailerManagementOwnerPayout = payout === undefined ? undefined : payout;
      trailerTenureBeneficiary = this.editTenureBeneficiary().trim() || undefined;
      trailerRecurringPaymentCadence = this.editRecurringCadence().trim() || undefined;
    }
    const fleetMetaDraft: Partial<UnitFleetMeta> = {
      trailerTenureMode: mode,
      trailerCommercialValue,
      trailerRecurringPaymentAmount,
      trailerRecurringPaymentDate,
      trailerRecurringInstallmentCount,
      trailerRecurringPaymentCadence,
      trailerTenureBeneficiary,
      trailerManagementOwnerPayout,
    };
    if (this.saving()) {
      return;
    }
    const original = this.docs('ownership');
    const kept = this.editOwnershipDocs();
    const files = this.editOwnershipNewFiles();
    this.saving.set(true);
    this.syncUnitDocuments('ownership', kept, files, original)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (uploaded) => {
          this.metaOverride.update((prev) => ({ ...prev, ...fleetMetaDraft }));
          this.editOwnershipNewFiles.set([]);
          this.saving.set(false);
          this.persistCurrentUnit(
            'Propiedad y tenencia actualizadas.',
            { fleetMeta: fleetMetaDraft },
            {
              ...TENURE_SECTION_PERSIST_OPTIONS,
              syncedDocuments: { kind: 'ownership', kept, uploaded },
            },
          );
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudieron guardar los documentos de propiedad.', 'error');
        },
      });
  }

  // -- Tren motriz y capacidad: form signals --
  readonly editTransmissionType = signal('');
  readonly editTransmissionSpeeds = signal('');
  readonly editApproximatePerformanceKmL = signal('');
  readonly editGvwrLb = signal('');
  readonly editCapacityTons = signal('');
  readonly editOdometerKm = signal('');

  readonly transmissionOptions = FLEET_TRANSMISSION_TYPE_OPTIONS;

  readonly speedOptions = FLEET_TRANSMISSION_SPEED_OPTIONS;

  capacityTonsDisplay(): string {
    const u = this.effUnit();
    if (u.capacityTons != null && Number.isFinite(u.capacityTons)) {
      return `${u.capacityTons} t`;
    }
    if (u.capacityKg > 0) {
      return `${u.capacityKg / 1000} t`;
    }
    return '—';
  }

  approximatePerformanceDisplay(): string {
    const value = this.meta()?.approximatePerformanceKmL;
    if (value != null && Number.isFinite(value) && value > 0) {
      return `${value} km/L`;
    }
    return '—';
  }

  startEditCap(): void {
    this.focusDetailTab('ficha');
    this.clearStagedDocUploads();
    const m = this.meta() ?? {};
    this.editTransmissionType.set(
      fleetValueFromLabel(this.transmissionOptions, m.transmissionType) ||
        m.transmissionType?.trim() ||
        '',
    );
    this.editTransmissionSpeeds.set(
      fleetValueFromLabel(this.speedOptions, m.transmissionSpeeds) ||
        m.transmissionSpeeds?.trim() ||
        '',
    );
    this.editGvwrLb.set(m.grossVehicleWeightLb?.trim() || '');
    const perf = m.approximatePerformanceKmL;
    this.editApproximatePerformanceKmL.set(
      perf != null && Number.isFinite(perf) && perf > 0 ? String(perf) : '',
    );
    const u = this.effUnit();
    this.editCapacityTons.set(
      u.capacityTons != null && Number.isFinite(u.capacityTons)
        ? String(u.capacityTons)
        : u.capacityKg > 0
          ? String(u.capacityKg / 1000)
          : '',
    );
    this.editOdometerKm.set(m.odometerKm?.trim() || '');
    this.editingSection.set('cap');
  }

  saveEditCap(): void {
    const tonsRaw = this.editCapacityTons().trim().replace(/,/g, '');
    if (!tonsRaw) {
      this.toast.show('Indica la capacidad en toneladas.', 'warning');
      return;
    }
    const capacityTons = Number(tonsRaw);
    if (!Number.isFinite(capacityTons) || capacityTons <= 0) {
      this.toast.show('La capacidad en toneladas no es válida.', 'warning');
      return;
    }
    const capacityKg = Math.round(capacityTons * 1000);
    const lbRaw = this.editGvwrLb().trim().replace(/,/g, '');
    if (lbRaw) {
      const lb = Number(lbRaw);
      if (!Number.isFinite(lb) || lb <= 0 || !Number.isInteger(lb)) {
        this.toast.show('Ejes de tracción debe ser un número entero válido.', 'warning');
        return;
      }
    }
    const transLabel =
      this.transmissionOptions.find((o) => o.value === this.editTransmissionType())
        ?.label ||
      this.editTransmissionType().trim() ||
      undefined;
    const speedsLabel =
      this.speedOptions.find((o) => o.value === this.editTransmissionSpeeds())?.label ||
      this.editTransmissionSpeeds().trim() ||
      undefined;
    const perfRaw = this.editApproximatePerformanceKmL().trim().replace(/,/g, '.');
    let approximatePerformanceKmL: number | undefined;
    if (perfRaw) {
      const perf = Number(perfRaw);
      if (!Number.isFinite(perf) || perf <= 0) {
        this.toast.show('El rendimiento aprox. debe ser un número mayor a 0 (km/L).', 'warning');
        return;
      }
      approximatePerformanceKmL = perf;
    }
    const fleetMetaDraft: Partial<UnitFleetMeta> = {
      transmissionType: transLabel,
      transmissionSpeeds: speedsLabel,
      approximatePerformanceKmL,
      grossVehicleWeightLb: lbRaw || undefined,
      odometerKm: this.editOdometerKm().trim() || undefined,
    };
    this.unitOverride.update((prev) => ({ ...prev, capacityKg, capacityTons }));
    this.metaOverride.update((prev) => ({ ...prev, ...fleetMetaDraft }));
    this.persistCurrentUnit('Tren motriz y capacidad actualizados.', {
      unit: { capacityKg, capacityTons },
      fleetMeta: fleetMetaDraft,
    });
  }

  markReady(): void {
    this.drawerLoading.set(false);
  }

  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.requestDismiss();
    }
  }

  trailerOperationalId(): string {
    return formatUnitTrailerOperationalId(this.effUnit());
  }

  /** Código de tenencia para la UI (por defecto `owned` / Propio). */
  tenureMode(): TrailerTenureMode {
    return trailerTenureModeOrDefault(this.meta()?.trailerTenureMode);
  }

  tenureModeLabel(mode?: TrailerTenureMode | string | null): string {
    return trailerTenureModeLabel(mode ?? this.meta()?.trailerTenureMode, {
      defaultWhenEmpty: true,
    });
  }

  brandDisplay(): string {
    const u = this.effUnit();
    return fleetBrandDisplayName({
      trailerBrandName: u.fleetMeta?.trailerBrandName,
      trailerBrandAbbr: u.trailerBrandAbbr,
    });
  }

  /** Kilometraje acumulado de la unidad (solo lectura en UI). */
  accumulatedOdometerKmLabel(): string {
    return formatFleetStoredKmLabel(this.meta()?.odometerKm);
  }

  maintenanceKmCounterLabel(): string {
    return formatMaintenanceKmCounterLabel(this.meta());
  }

  newMaintKmCounterResetHint(): string | null {
    if (!this.maintenanceUsesKm()) {
      return null;
    }
    if (!fleetMaintenanceResetsKmCounter(this.newMaintType())) {
      return null;
    }
    return 'Al guardar, el contador de km desde el último servicio completo se reiniciará a cero.';
  }

  maintenanceUsesKm(): boolean {
    return this.companyKmMaintControlActive();
  }

  maintenanceUsesDate(): boolean {
    return (
      this.companyDateMaintControlActive() && !this.companyKmMaintControlActive()
    );
  }

  usesGlobalMaintenancePolicy(): boolean {
    return this.maintenanceUsesKm() || this.maintenanceUsesDate();
  }

  statusBanner(): { label: string; sub?: string; mod: string } {
    if (this.onRoute()) {
      return {
        label: tripStatusUiLabel('in_transit'),
        mod: 'fleet-unit-detail__status--route',
      };
    }
    const s = (this.effUnit().status ?? '').trim().toLowerCase();
    switch (s) {
      case 'available':
        return { label: 'Disponible', mod: 'fleet-unit-detail__status--available' };
      case 'maintenance':
        return { label: 'Mantenimiento', mod: 'fleet-unit-detail__status--maintenance' };
      case 'in_use':
        return { label: 'En uso', sub: 'Asignado / operación', mod: 'fleet-unit-detail__status--inuse' };
      case 'scheduled':
        return { label: 'Programado', mod: 'fleet-unit-detail__status--scheduled' };
      default:
        return {
          label: this.effUnit().status?.trim() || '—',
          mod: 'fleet-unit-detail__status--unknown',
        };
    }
  }

  catalogStatusLabel(): string {
    const s = (this.effUnit().status ?? '').trim().toLowerCase();
    switch (s) {
      case 'available':
        return 'Disponible';
      case 'in_use':
        return 'En uso';
      case 'maintenance':
        return 'Mantenimiento';
      case 'scheduled':
        return 'Programado';
      default:
        return this.effUnit().status?.trim() || '—';
    }
  }

  renewalBadgeMod(b: FleetRenewalBucket): string {
    switch (b) {
      case 'due':
        return 'fleet-unit-detail__badge--due';
      case 'soon':
        return 'fleet-unit-detail__badge--soon';
      case 'ok':
        return 'fleet-unit-detail__badge--ok';
      default:
        return 'fleet-unit-detail__badge--na';
    }
  }

  badgeRenewalClass(b: FleetRenewalBucket): string {
    return `fleet-unit-detail__badge ${this.renewalBadgeMod(b)}`;
  }

  nextMx(iso: string | undefined, cycleMonths: number): string {
    const t = nextCycleFormatted(iso, cycleMonths);
    if (!t) {
      return '—';
    }
    return t.replace(/^Próxima:\s*/i, '').trim();
  }

  /** Fecha corta `dd/mm/aaaa` para tabla de mantenimiento (ISO `YYYY-MM-DD`). */
  formatMaintDateShort(iso: string | undefined): string {
    const raw = iso?.trim();
    if (!raw) {
      return '—';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return '—';
    }
    const [y, mo, d] = raw.split('-');
    return `${d.padStart(2, '0')}/${mo.padStart(2, '0')}/${y}`;
  }

  maintNext(): string {
    return nextMaintenanceTableDate(this.meta(), this.companyMaintPolicy()) ?? '—';
  }

  maintenanceKmRemainingDisplay(): string {
    const raw = fleetMaintenanceKmRemaining(this.meta(), this.companyMaintPolicy());
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
      return `${new Intl.NumberFormat('es-MX', {
        maximumFractionDigits: 0,
      }).format(raw)} km`;
    }
    return '—';
  }

  maintKmRenewalBucket(): FleetRenewalBucket {
    const v = fleetMaintenanceKmRemaining(this.meta(), this.companyMaintPolicy());
    if (v == null) {
      return 'na';
    }
    if (v <= 0) {
      return 'due';
    }
    if (v <= 300) {
      return 'soon';
    }
    return 'ok';
  }

  insNext(): string {
    return coverageNextPaymentLabel(
      this.insurancePaymentSchedule(),
      formatFleetYmdMx,
      nextInsuranceTableDate(this.meta()) ?? '—',
    );
  }

  canConfirmInsurancePayment(): boolean {
    return this.canWriteFleet() && canConfirmInsurancePayment(this.meta());
  }

  insurancePaymentConfirmHint(): string {
    return insurancePaymentConfirmHint(this.meta());
  }

  confirmInsurancePayment(): void {
    if (this.saving() || !this.canConfirmInsurancePayment()) {
      return;
    }
    const dueDate = resolveFleetCoverageConfirmDueDate(
      this.insurancePaymentSchedule(),
      nextInsurancePaymentDate(this.meta()),
    );
    if (!dueDate) {
      return;
    }
    this.confirmInsurancePaymentCycle(dueDate);
  }

  confirmInsurancePaymentCycle(dueDate: string): void {
    if (!this.canWriteFleet() || this.saving()) {
      return;
    }
    confirmFleetCoverageSchedulePayment({
      expensesApi: this.expensesApi,
      toast: this.toast,
      destroyRef: this.destroyRef,
      schedule: this.insurancePaymentSchedule(),
      dueDate,
      successMessage: 'Pago de póliza registrado.',
      missingExpenseMessage:
        'No se encontró el gasto asociado. Edita la cobertura para regenerar.',
      setSaving: (saving) => this.saving.set(saving),
      onSuccess: () => {
        this.reloadInsurancePaymentExpenses();
        this.fleetFeature.refreshCoverageExpenses();
      },
    });
  }

  private reloadInsurancePaymentExpenses(): void {
    this.subscribeInsurancePaymentExpensesLoad();
  }

  private subscribeInsurancePaymentExpensesLoad(): Subscription | null {
    const unit = this.unitSource();
    const unitId = unit?.id;
    const meta = unit?.fleetMeta;
    if (
      this.detailTab() !== 'cob' ||
      !unitId ||
      !showInsurancePaymentSchedule(meta?.insurancePaymentCadence)
    ) {
      this.insurancePaymentExpenses.set([]);
      return null;
    }
    const requestId = ++this.insurancePaymentExpensesLoadId;
    return subscribeFleetCoverageExpensesPage({
      expensesApi: this.expensesApi,
      scope: { resource: 'unit', unitId },
      kind: 'insurance',
      bounds: insurancePolicyYearBounds(meta, new Date(this.today)),
      requestId,
      isCurrentRequest: (id) => id === this.insurancePaymentExpensesLoadId,
      setItems: (items) => this.insurancePaymentExpenses.set(items),
    });
  }

  private reloadGpsPaymentExpenses(): void {
    this.subscribeGpsPaymentExpensesLoad();
  }

  private subscribeGpsPaymentExpensesLoad(): Subscription | null {
    const unit = this.unitSource();
    const unitId = unit?.id;
    const meta = unit?.fleetMeta;
    if (this.detailTab() !== 'cob' || !unitId || !showGpsPaymentSchedule(meta)) {
      this.gpsPaymentExpenses.set([]);
      return null;
    }
    const requestId = ++this.gpsPaymentExpensesLoadId;
    return subscribeFleetCoverageExpensesPage({
      expensesApi: this.expensesApi,
      scope: { resource: 'unit', unitId },
      kind: 'gps',
      bounds: gpsServiceYearBounds(meta, new Date(this.today)),
      requestId,
      isCurrentRequest: (id) => id === this.gpsPaymentExpensesLoadId,
      setItems: (items) => this.gpsPaymentExpenses.set(items),
    });
  }

  gpsNext(): string {
    return coverageNextPaymentLabel(
      this.gpsPaymentSchedule(),
      formatFleetYmdMx,
      nextGpsTableDate(this.meta()) ?? '—',
    );
  }

  canConfirmGpsPayment(): boolean {
    return this.canWriteFleet() && canConfirmGpsPayment(this.meta());
  }

  gpsPaymentConfirmHint(): string {
    return gpsPaymentConfirmHint(this.meta());
  }

  confirmGpsPayment(): void {
    if (this.saving() || !this.canConfirmGpsPayment()) {
      return;
    }
    const dueDate = resolveFleetCoverageConfirmDueDate(
      this.gpsPaymentSchedule(),
      nextGpsPaymentDate(this.meta()),
    );
    if (!dueDate) {
      return;
    }
    this.confirmGpsPaymentCycle(dueDate);
  }

  confirmGpsPaymentCycle(dueDate: string): void {
    if (!this.canWriteFleet() || this.saving()) {
      return;
    }
    confirmFleetCoverageSchedulePayment({
      expensesApi: this.expensesApi,
      toast: this.toast,
      destroyRef: this.destroyRef,
      schedule: this.gpsPaymentSchedule(),
      dueDate,
      successMessage: 'Pago de GPS registrado.',
      missingExpenseMessage:
        'No se encontró el gasto asociado. Edita la cobertura para regenerar.',
      setSaving: (saving) => this.saving.set(saving),
      onSuccess: () => this.reloadGpsPaymentExpenses(),
    });
  }

  confirmTenurePaymentCycle(dueDate: string): void {
    if (!this.canWriteFleet() || this.saving()) {
      return;
    }
    confirmFleetCoverageSchedulePayment({
      expensesApi: this.expensesApi,
      toast: this.toast,
      destroyRef: this.destroyRef,
      schedule: this.tenurePaymentSchedule(),
      dueDate,
      successMessage: 'Cuota de financiamiento registrada.',
      missingExpenseMessage:
        'No se encontró el gasto asociado. Edita la tenencia para regenerar.',
      setSaving: (saving) => this.saving.set(saving),
      onSuccess: () => this.reloadTenurePaymentExpenses(),
    });
  }

  private reloadTenurePaymentExpenses(): void {
    this.subscribeTenurePaymentExpensesLoad();
  }

  private subscribeTenurePaymentExpensesLoad(): Subscription | null {
    const unit = this.unitSource();
    const unitId = unit?.id;
    const meta = unit?.fleetMeta;
    if (!unitId || !showTenurePaymentSchedule(meta)) {
      this.tenurePaymentExpenses.set([]);
      return null;
    }
    const requestId = ++this.tenurePaymentExpensesLoadId;
    return subscribeFleetCoverageExpensesPage({
      expensesApi: this.expensesApi,
      scope: { resource: 'unit', unitId },
      kind: 'tenure_payment',
      bounds: tenurePaymentBounds(meta),
      requestId,
      isCurrentRequest: (id) => id === this.tenurePaymentExpensesLoadId,
      setItems: (items) => this.tenurePaymentExpenses.set(items),
    });
  }

  trackingPortalHref(raw: string | undefined): string {
    const t = raw?.trim() ?? '';
    if (!t) {
      return '#';
    }
    if (/^https?:\/\//i.test(t)) {
      return t;
    }
    return `https://${t}`;
  }

  /**
   * Historial visible en la tabla. Si la unidad ya tiene `maintenanceEntries`,
   * se devuelven ordenadas por fecha desc; en caso contrario se sintetiza una
   * sola fila a partir de `lastMaintenance*` y los nombres de archivo legados
   * para que las unidades viejas no se vean vacías.
   * Docs de storage (`fleetDocuments` kind=maintenance) se muestran en la
   * entrada más reciente (aún no hay vínculo entry↔documento en API).
   */
  maintenanceEntries(): MaintenanceEntry[] {
    const m = this.meta();
    const local = this.localMaintEntries();
    let base: MaintenanceEntry[] = [];
    if (m) {
      const explicit = (m.maintenanceEntries ?? []).filter(isSubstantiveMaintenanceEntry);
      if (explicit.length > 0) {
        base = explicit;
      } else {
        const fallback: MaintenanceEntry = {
          date: m.lastMaintenanceDate,
          type: m.lastMaintenanceType,
          cost: m.lastMaintenanceCost,
          notes: m.lastMaintenanceNotes,
          documentNames: m.documentMaintenanceNames,
        };
        if (isSubstantiveMaintenanceEntry(fallback)) {
          base = [fallback];
        }
      }
    }
    const sorted = [...base, ...local]
      .filter(isSubstantiveMaintenanceEntry)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    return attachFleetMaintenanceDocNamesToNewestEntry(
      sorted,
      this.docs('maint').map((d) => d.fileName),
    );
  }

  docs(which: 'maint' | 'verif' | 'policy' | 'ownership'): FleetStoredDocument[] {
    const kind: FleetDocumentKind =
      which === 'maint'
        ? 'maintenance'
        : which === 'verif'
          ? 'verification'
          : which;
    const fromApi = (this.meta()?.fleetDocuments ?? []).filter(
      (d) => d.documentKind === kind && Number.isFinite(d.id) && d.id > 0,
    );
    if (fromApi.length > 0) {
      return fromApi;
    }
    // Fallback legacy: solo nombres (sin id → no descargables).
    return this.legacyDocNames(which).map((fileName, index) => ({
      id: -(index + 1),
      fileName,
      documentKind: kind,
    }));
  }

  docNames(which: 'maint' | 'verif' | 'policy' | 'ownership'): string[] {
    return this.docs(which)
      .map((d) => d.fileName)
      .filter(Boolean);
  }

  private legacyDocNames(
    which: 'maint' | 'verif' | 'policy' | 'ownership',
  ): string[] {
    const m = this.meta();
    if (!m) {
      return [];
    }
    if (which === 'maint') {
      return m.documentMaintenanceNames ?? [];
    }
    if (which === 'verif') {
      return m.documentVerificationNames ?? [];
    }
    if (which === 'ownership') {
      return m.documentOwnershipNames ?? [];
    }
    return m.documentPolicyNames ?? [];
  }

  /** Arrow: se pasa a secciones hijas sin perder `this`. */
  downloadStoredDocument = (doc: FleetStoredDocument | string): void => {
    const unitId = this.effUnit().id;
    const resolved =
      typeof doc === 'string'
        ? this.docs('maint')
            .concat(this.docs('verif'), this.docs('ownership'), this.docs('policy'))
            .find((d) => d.fileName === doc)
        : doc;
    if (!resolved || resolved.id <= 0) {
      this.toast.show(
        'Este documento aún no está en el almacenamiento (vuelve a subirlo).',
        'info',
      );
      return;
    }
    this.unitsApi
      .downloadUnitDocument(unitId, resolved.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ url }) => {
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.download = resolved.fileName || 'documento';
          document.body.appendChild(a);
          a.click();
          a.remove();
        },
        error: () => {
          this.toast.show('No se pudo descargar el documento.', 'error');
        },
      });
  };

  private syncUnitDocuments(
    kind: FleetDocumentKind,
    kept: readonly FleetStoredDocument[],
    newFiles: readonly File[],
    original: readonly FleetStoredDocument[],
  ): Observable<FleetStoredDocument[]> {
    const unitId = this.effUnit().id;
    const keptIds = new Set(kept.filter((d) => d.id > 0).map((d) => d.id));
    const deletes = original
      .filter((d) => d.id > 0 && !keptIds.has(d.id))
      .map((d) => this.unitsApi.deleteUnitDocument(unitId, d.id));
    const uploads = newFiles.map((file) =>
      this.unitsApi.uploadUnitDocument(unitId, kind, file),
    );
    if (deletes.length === 0 && uploads.length === 0) {
      return of([]);
    }
    return forkJoin({
      deleted: deletes.length > 0 ? forkJoin(deletes) : of([]),
      uploaded: uploads.length > 0 ? forkJoin(uploads) : of([] as FleetStoredDocument[]),
    }).pipe(map((result) => result.uploaded));
  }

  doubleArticLabel(m: UnitFleetMeta | undefined): string {
    if (!m) {
      return '—';
    }
    if (m.verificationDoubleArticulatedApplies === true) {
      return 'Sí aplica';
    }
    if (m.verificationDoubleArticulatedApplies === false) {
      return 'No aplica';
    }
    return '—';
  }

  renewalBucketFor(iso: string | undefined): FleetRenewalBucket {
    return complianceRenewalBucket(iso, VERIF_MO);
  }

  /** Costo, precio o cantidad asociada (verificación, seguro, etc.) en formato es-MX. */
  formatTrackingAmount(n: number | undefined): string {
    if (n == null || !Number.isFinite(n)) {
      return '—';
    }
    return formatGroupedNumber(n);
  }

  maintRenewalBucket(): FleetRenewalBucket {
    return fleetMaintenanceRenewal(this.meta(), this.companyMaintPolicy());
  }

  insRenewalBucket(): FleetRenewalBucket {
    return fleetInsuranceRenewal(this.meta(), this.insurancePaymentExpenses());
  }

  gpsRenewalBucket(): FleetRenewalBucket {
    return fleetGpsRenewal(this.meta(), this.gpsPaymentExpenses());
  }

  constructor() {
    registerFleetVersionResetOnBrandChange({
      brandName: () => this.editBrand(),
      versionName: this.editVersion,
    });

    effect(() => {
      const unit = this.unitsFeature.selectedUnit();
      if (!unit) {
        return;
      }
      this.equipmentFeature.equipment();
      this.bindHostUnit(unit);
      this.syncCatalogFromFeature();
    });

    effect((onCleanup) => {
      this.detailTab();
      this.unitSource();
      const sub = this.subscribeInsurancePaymentExpensesLoad();
      if (sub) {
        onCleanup(() => sub.unsubscribe());
      }
    });

    effect((onCleanup) => {
      this.detailTab();
      this.unitSource();
      const sub = this.subscribeGpsPaymentExpensesLoad();
      if (sub) {
        onCleanup(() => sub.unsubscribe());
      }
    });

    effect((onCleanup) => {
      this.unitSource();
      const sub = this.subscribeTenurePaymentExpensesLoad();
      if (sub) {
        onCleanup(() => sub.unsubscribe());
      }
    });

    registerFleetHitchSlotSync({
      isActive: () => this.editingSection() === 'hitch',
      catalog: () => this.equipmentCatalog(),
      unitId: () => this.unit().id,
      isSecondTrailer: this.hitchAddIsSecondTrailer,
    });

    let priorUnitId = '';
    effect(() => {
      const current = this.unitSource();
      if (!current) {
        return;
      }
      const id = current.id;
      if (priorUnitId !== '' && priorUnitId !== id) {
        this.resetOnUnitIdentityChange();
        this.verifClearConfirmScope.set(null);
        this.addingMaint.set(false);
        this.resetNewMaintForm();
        this.detailTab.set('mant');
        this.cancelHitchForms();
      }
      priorUnitId = id;
    });

    effect(() => {
      const unit = this.unitsFeature.selectedUnit();
      const tab = this.fleetFeature.pendingDetailTab();
      if (!unit || !tab) {
        return;
      }
      this.fleetFeature.clearPendingDetailTab();
      this.requestFocusDetailTab(tab);
    });
  }
}
