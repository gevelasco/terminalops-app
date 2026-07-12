import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, type Subscription } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { ExpensesService } from '@core/services/api/expenses';
import {
  buildFleetCoverageExpensesPageParams,
  fleetCoverageExpensesQueryRange,
} from '@features/fleet/utils/fleet-coverage-expenses.util';
import { SessionService } from '@core/services/state/session';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { EquipmentFeatureService } from '@features/fleet/services/equipment.service';
import { FleetFeatureService } from '@features/fleet/services/fleet.service';
import { UnitsFeatureService } from '@features/fleet/services/units.service';
import {
  companyMaintenancePolicyFromSession,
} from '@shared/models/company-operational-settings.models';
import type { EquipmentPersistDraft } from '@shared/utils/fleet/equipment-api-payload';
import type { UnitPersistDraft } from '@shared/utils/fleet/unit-api-payload';
import {
  trackFileEntry,
  trackMaintenanceEntry,
  trackStringEntry,
} from '@features/fleet/utils/list-trackers';
import { fleetUnitDetailSegmentTabs } from '@app/features/fleet/utils/fleet-unit-detail-segment-tabs';
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
import { formatFleetStoredKmLabel } from '@features/fleet/utils/fleet-stored-km.util';
import { isSubstantiveMaintenanceEntry } from '@features/fleet/utils/fleet-maintenance-entry.util';
import { formatMaintenanceKmCounterLabel } from '@features/fleet/utils/fleet-maintenance-km.util';
import { FLEET_UNIT_DETAIL_TAB_SYMBOLS } from '@app/features/fleet/utils/fleet-unit-detail-tab-symbols';
import {
  EQUIPMENT_OPERATION_TYPE_OPTIONS,
  FLEET_PAYMENT_CADENCE_OPTIONS,
  FLEET_TRAILER_TENURE_OPTIONS,
  FLEET_RESOURCE_VISIBILITY_OPTIONS,
  buildFleetModelYearSelectOptions,
  FLEET_MAINT_SCHEDULE_NEXT_MODE_OPTIONS,
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
import { deriveFleetBrandAbbr } from '@shared/utils/fleet/derive-fleet-brand-abbr';
import { fleetBrandDisplayName } from '@shared/utils/fleet/fleet-brand-display';
import { registerFleetVersionResetOnBrandChange } from '@shared/utils/fleet/fleet-brand-version-link';
import {
  coerceContainerSlotForOperationType,
  containerSlotFieldApplies,
  containerSlotFieldLabel,
  containerSlotLabelForKey,
  containerSlotSelectOptionsForOperationType,
  resolveContainerSlotConfigKey,
  resolveEquipmentOperationTypeCode,
} from '@shared/utils/fleet/equipment-container-slot-options.util';
import {
  FleetRenewalBucket,
  equipmentPhysMechTwoYearExemptionEnd,
  equipmentPhysMechVerificationBucket,
  equipmentPhysMechVerificationTooltip,
  fleetInsuranceRenewal,
  fleetMaintenanceKmRemaining,
  fleetMaintenanceRenewal,
  fleetOperationalKeyLabel,
  formatFleetYmdMx,
  nextCycleFormatted,
  nextEquipmentPhysMechTableDate,
  nextInsuranceTableDate,
  nextMaintenanceDueIso,
  nextMaintenanceTableDate,
  operationalKeyEquipment,
} from '@app/features/fleet/utils/fleet-unit-table-row';
import {
  fleetDrawerTodayIso,
  fleetValueFromLabel,
  parseFleetOptionalAmount,
  parseFleetOptionalPositiveInt,
  parseFleetPositiveKm,
  registerFleetHitchSlotSync,
} from '@app/features/fleet/utils/fleet-drawer-form.utils';
import {
  trailerTenureModeLabel,
  trailerTenureModeOrDefault,
} from '@shared/utils/fleet/trailer-tenure-mode';
import {
  fleetUnitIdIsOnRoute,
  fleetUnitIsOnRoute,
} from '@features/fleet/utils/fleet-operational-status';
import {
  unitHitchSlotForNewEquipment,
  unitsEligibleForEquipmentHitch,
  hitchPositionForNewEquipmentOnUnit,
  validateEquipmentHitchAssignment,
} from '@shared/utils/fleet/equipment-hitch-assignment';
import {
  equipmentAssignedToUnit,
  equipmentPromoteToLeadPersistDraft,
  equipmentUnhitchPersistDraft,
  isSecondTrailerHitch,
  rearEquipmentToPromoteOnLeadUnhitch,
  unhitchingLeadRequiresRearPromotion,
} from '@shared/utils/fleet/equipment-hitch-position';
import { formatUnitTrailerLabel, formatUnitTrailerOperationalId } from '@shared/utils/fleet/unit-label';
import { resourceIdKey, resourceIdsEqual } from '@shared/utils/resource-id';
import { equipmentHitchPositionDisplayLabel } from '@app/features/fleet/utils/unit-hitched-equipment';
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import {
  Equipment,
  EquipmentFleetMeta,
  Expense,
  MaintenanceEntry,
  TrailerTenureMode,
  Unit,
} from '@shared/models/logistics.models';
import { FleetEquipmentDetailDomain } from '@features/fleet/services/domain/fleet-equipment-detail.domain';
import type {
  EquipmentDetailDrawerTab,
  EquipmentEditingSection,
  FleetEquipmentDetailDrawerHostCallbacks,
  FleetEquipmentDetailDrawerHostLayout,
} from '@features/fleet/components/fleet-equipment-detail-drawer/fleet-equipment-detail-drawer.types';
import type { FleetPersistOptions } from '@features/fleet/components/fleet-detail-drawer.types';

export type {
  EquipmentDetailDrawerTab,
  FleetEquipmentDetailDrawerHostCallbacks,
  FleetEquipmentDetailDrawerHostLayout,
} from '@features/fleet/components/fleet-equipment-detail-drawer/fleet-equipment-detail-drawer.types';

const VERIF_MO = 6;

const COB_SECTION_PERSIST_OPTIONS: FleetPersistOptions = {
  skipListRefresh: true,
  skipFleetRefresh: true,
};

@Injectable()
export class FleetEquipmentDetailDrawerFacade {
  readonly toast = inject(ToastService);
  readonly session = inject(SessionService);
  readonly destroyRef = inject(DestroyRef);
  private readonly equipmentFeature = inject(EquipmentFeatureService);
  private readonly fleetFeature = inject(FleetFeatureService);
  private readonly expensesApi = inject(ExpensesService);
  private readonly unitsFeature = inject(UnitsFeatureService);
  private readonly domain = inject(FleetEquipmentDetailDomain);

  private dismissCallback: (() => void) | null = null;
  private viewAssignedUnitCallback: ((unit: Unit) => void) | null = null;
  private readonly equipmentSource = signal<Equipment | null>(null);
  private readonly unitCatalogSource = signal<Unit[]>([]);
  private readonly equipmentCatalogSource = signal<Equipment[]>([]);
  private readonly onRouteSource = signal(false);

  readonly equipment = computed(() => this.equipmentSource()!);
  readonly unitCatalog = computed(() => this.unitCatalogSource());
  readonly equipmentCatalog = computed(() => this.equipmentCatalogSource());
  readonly onRoute = computed(() => this.onRouteSource());

  readonly verifCycleMo = VERIF_MO;
  readonly formatYmd = formatFleetYmdMx;
  readonly trackFileEntry = trackFileEntry;
  readonly trackStringEntry = trackStringEntry;
  readonly trackMaintenanceEntry = trackMaintenanceEntry;
  readonly detailSegmentTabs = fleetUnitDetailSegmentTabs('fleet-eqd');
  readonly detailTabSymbols = FLEET_UNIT_DETAIL_TAB_SYMBOLS;

  readonly drawerLoading = signal(false);
  readonly saving = signal(false);
  private readonly insurancePaymentExpenses = signal<Expense[]>([]);
  private insurancePaymentExpensesLoadId = 0;
  readonly deleteConfirmOpen = signal(false);
  readonly deleteSubmitting = signal(false);
  readonly maintenanceSubmitting = signal(false);

  readonly canDeleteEquipment = computed(() => isAdminRole(this.session.role()));
  readonly canWriteFleet = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.FLEET),
  );
  readonly deleteBlockedByRoute = computed(() => this.onRoute());
  readonly deleteBlockedTooltip = () => FLEET_DELETE_ON_ROUTE_TOOLTIP;

  readonly maintenanceAction = computed(() =>
    fleetMaintenanceAction({
      status: this.effEquipment().status,
      onRoute: this.onRoute(),
      isActive: this.effEquipment().isActive,
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
      maintenanceKmControlEnabled: this.session.maintenanceKmControlEnabled(),
      maintenanceKmIntervalDefault: this.session.maintenanceKmIntervalDefault(),
      maintenanceDateControlEnabled: this.session.maintenanceDateControlEnabled(),
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

  readonly equipmentOverride = signal<Partial<Equipment>>({});
  readonly metaOverride = signal<Partial<EquipmentFleetMeta>>({});
  readonly localMaintEntries = signal<MaintenanceEntry[]>([]);

  readonly effEquipment = computed<Equipment>(() => {
    const base = this.equipment();
    const u = this.equipmentOverride();
    const m = this.metaOverride();
    return {
      ...base,
      ...u,
      fleetMeta: { ...(base.fleetMeta ?? {}), ...m },
    };
  });

  readonly editingSection = signal<EquipmentEditingSection>(null);
  readonly detailTab = signal<EquipmentDetailDrawerTab>('mant');

  bindHostCallbacks(callbacks: FleetEquipmentDetailDrawerHostCallbacks): void {
    this.dismissCallback = callbacks.dismiss;
    this.viewAssignedUnitCallback = callbacks.viewAssignedUnit;
  }

  bindHostEquipment(equipment: Equipment): void {
    const prevId = this.equipmentSource()?.id ?? '';
    const nextId = equipment.id;
    const equipmentIdChanged = prevId !== nextId;

    if (equipmentIdChanged) {
      const resolved =
        this.equipmentFeature.equipment().find((e) => e.id === nextId) ?? equipment;
      this.equipmentSource.set(resolved);
      this.equipmentOverride.set({});
      this.metaOverride.set({});
      this.insurancePaymentExpenses.set([]);
      this.editingSection.set(null);
      this.drawerLoading.set(false);
      return;
    }

    this.syncHostEquipmentFromFeatureList(nextId);
  }

  private syncHostEquipmentFromFeatureList(equipmentId: string): void {
    if (this.editingSection() !== null || this.verifEntryKind() !== null) {
      const incoming = this.equipmentFeature.selectedEquipment();
      if (incoming) {
        this.applyHostEquipmentSnapshotWhenRicher(incoming);
      }
      return;
    }
    const resolved = this.equipmentFeature.equipment().find((e) => e.id === equipmentId);
    const current = this.equipmentSource();
    if (!resolved || !current) {
      return;
    }
    const resolvedMeta = JSON.stringify(resolved.fleetMeta ?? {});
    const currentMeta = JSON.stringify(current.fleetMeta ?? {});
    if (resolvedMeta !== currentMeta) {
      this.equipmentSource.set(resolved);
      this.metaOverride.set({});
    }
  }

  private applyHostEquipmentSnapshotWhenRicher(incoming: Equipment): void {
    const current = this.equipmentSource();
    if (!current) {
      return;
    }
    const next = this.domain.applyHostEquipmentSnapshotWhenRicher(current, incoming);
    if (next) {
      this.equipmentSource.set(next);
    }
  }

  requestFocusDetailTab(tab: EquipmentDetailDrawerTab): void {
    this.focusDetailTab(tab);
  }

  syncHostLayout(layout: FleetEquipmentDetailDrawerHostLayout): void {
    this.onRouteSource.set(layout.onRoute);
    this.syncCatalogFromFeature();
  }

  private syncCatalogFromFeature(): void {
    this.unitCatalogSource.set([...this.unitsFeature.units()]);
    this.equipmentCatalogSource.set([...this.equipmentFeature.equipment()]);
  }

  selectDetailTab(tab: EquipmentDetailDrawerTab): void {
    this.focusDetailTab(tab);
  }

  private focusDetailTab(tab: EquipmentDetailDrawerTab): void {
    if (this.detailTab() === tab) {
      return;
    }
    this.cancelEdit();
    this.cancelPhysVerifEntry();
    this.cancelMaintScheduleEdits();
    this.addingMaint.set(false);
    this.resetNewMaintForm();
    this.detailTab.set(tab);
  }

  cancelEdit(): void {
    this.clearStagedDocUploads();
    this.hitchSecondConfirmOpen.set(false);
    this.hitchLeadUnhitchConfirmOpen.set(false);
    this.editingSection.set(null);
  }

  private clearStagedDocUploads(): void {
    this.editOwnershipNewFiles.set([]);
    this.editPolicyNewFiles.set([]);
  }

  private cancelMaintScheduleEdits(): void {
    this.editingMaintNextDate.set(false);
    this.editingMaintKmInterval.set(false);
    this.editMaintNextDate.set('');
    this.editMaintKmIntervalStr.set('');
  }

  resetOnEquipmentIdentityChange(): void {
    this.equipmentOverride.set({});
    this.metaOverride.set({});
    this.editingSection.set(null);
    this.localMaintEntries.set([]);
  }

  requestDismiss(): void {
    this.dismissCallback?.();
  }

  openDeleteConfirm(): void {
    if (
      !this.canDeleteEquipment() ||
      this.deleteBlockedByRoute() ||
      this.deleteSubmitting()
    ) {
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

  confirmDeleteEquipment(): void {
    if (
      !this.canDeleteEquipment() ||
      this.deleteBlockedByRoute() ||
      this.deleteSubmitting()
    ) {
      return;
    }
    const equipment = this.effEquipment();
    const label = this.equipmentOperationalTitle();
    this.deleteSubmitting.set(true);
    this.equipmentFeature
      .deleteEquipment(equipment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleteSubmitting.set(false);
          this.deleteConfirmOpen.set(false);
          this.fleetFeature.refreshFleetModule();
          this.toast.show(`Equipo ${label} dado de baja.`, 'success');
          this.requestDismiss();
        },
        error: (err: unknown) => {
          this.deleteSubmitting.set(false);
          const detail = parseHttpApiErrorMessage(err)?.trim() ?? '';
          this.toast.show(
            detail || 'No se pudo eliminar el equipo. Inténtalo de nuevo.',
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
    const equipment = this.effEquipment();
    const label = this.equipmentOperationalTitle();
    this.maintenanceSubmitting.set(true);
    this.equipmentFeature
      .setEquipmentMaintenance(equipment.id, action)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.maintenanceSubmitting.set(false);
          this.equipmentSource.set(saved);
          this.equipmentOverride.set({});
          this.fleetFeature.refreshFleetModule();
          this.toast.show(
            action === 'start'
              ? `Equipo ${label} en mantenimiento; no estará disponible para maniobras.`
              : `Equipo ${label} disponible de nuevo para operación.`,
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

  markReady(): void {
    this.drawerLoading.set(false);
  }

  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.requestDismiss();
    }
  }

  meta(): EquipmentFleetMeta | undefined {
    return this.effEquipment().fleetMeta;
  }

  isEditing(section: NonNullable<EquipmentEditingSection>): boolean {
    return this.editingSection() === section;
  }

  showSectionEdit(section: NonNullable<EquipmentEditingSection>): boolean {
    return this.canWriteFleet() && !this.isEditing(section);
  }

  /** Odómetro aprox. de la tractora asignada. */
  accumulatedOdometerKmLabel(): string {
    return formatFleetStoredKmLabel(this.assignedTractor()?.fleetMeta?.odometerKm);
  }

  maintenanceKmCounterLabel(): string {
    return formatMaintenanceKmCounterLabel(this.assignedTractor()?.fleetMeta);
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

  private maintenanceKmMeta() {
    return this.companyKmMaintControlActive()
      ? this.assignedTractor()?.fleetMeta
      : this.meta();
  }

  persistCurrentEquipment(
    successMessage: string,
    draft?: EquipmentPersistDraft,
    options?: FleetPersistOptions,
  ): void {
    if (this.saving()) return;
    const equipmentToSend = this.domain.equipmentForPersist(this.effEquipment(), this.localMaintEntries(), draft);
    this.saving.set(true);
    this.equipmentFeature
      .updateEquipment(equipmentToSend, draft, { skipListRefresh: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.equipmentSource.set(saved);
          this.equipmentOverride.set({});
          this.metaOverride.set({});
          this.localMaintEntries.set([]);
          if (!options?.skipFleetRefresh) {
            this.fleetFeature.refreshFleetModule();
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

  readonly assignedTractor = computed(() => {
    const id = resourceIdKey(this.effEquipment().unitId);
    if (!id) {
      return null;
    }
    return this.unitCatalog().find((u) => u.id === id) ?? null;
  });

  readonly hitchAssignmentAvailable = computed(
    () => !resourceIdKey(this.effEquipment().unitId),
  );

  readonly hitchTractorOperationalId = computed(() => {
    const u = this.assignedTractor();
    return u ? formatUnitTrailerOperationalId(u) : '—';
  });

  readonly hitchTractorPlate = computed(() => {
    const u = this.assignedTractor();
    return u?.plate?.trim() || '—';
  });

  readonly hitchPositionLabel = computed(() => {
    const e = this.effEquipment();
    if (!resourceIdKey(e.unitId)) {
      return '—';
    }
    const onUnit = equipmentAssignedToUnit(this.equipmentCatalog(), e.unitId);
    const index = onUnit.findIndex((item) => resourceIdsEqual(item.id, e.id));
    return equipmentHitchPositionDisplayLabel(
      e,
      index >= 0 ? index : undefined,
      onUnit.length,
    );
  });

  readonly hitchTractorCard = computed(() => {
    const unit = this.assignedTractor();
    const e = this.effEquipment();
    if (!unit || !resourceIdKey(e.unitId)) {
      return null;
    }
    const onUnit = equipmentAssignedToUnit(this.equipmentCatalog(), unit.id);
    const index = onUnit.findIndex((item) => resourceIdsEqual(item.id, e.id));
    return {
      unit,
      positionLabel: equipmentHitchPositionDisplayLabel(
        e,
        index >= 0 ? index : undefined,
        onUnit.length,
      ),
      operationalId: formatUnitTrailerOperationalId(unit),
      plate: unit.plate?.trim() || '—',
      description: formatUnitTrailerLabel(unit),
      alias: unit.name?.trim() || null,
    };
  });

  readonly hitchLeadUnhitchRearLabel = computed(() => {
    const rear = rearEquipmentToPromoteOnLeadUnhitch(
      this.equipmentCatalog(),
      this.effEquipment(),
    );
    return rear ? formatEquipmentOperationalId(rear) : '';
  });

  readonly hitchManagementBlocked = computed(() =>
    fleetUnitIsOnRoute(this.assignedTractor()),
  );

  private readonly hitchBlockedMessage =
    'No puede cambiar el enganche mientras la unidad tractora está en curso.';

  private hitchBlockedForAssignedTractor(): boolean {
    if (!this.hitchManagementBlocked()) {
      return false;
    }
    this.toast.show(this.hitchBlockedMessage, 'warning');
    return true;
  }

  private hitchBlockedForTargetUnit(unitId: string): boolean {
    if (!fleetUnitIdIsOnRoute(unitId, this.unitCatalog())) {
      return false;
    }
    this.toast.show(
      'No puede enganchar equipos a una unidad que está en curso.',
      'warning',
    );
    return true;
  }

  // -- Enganche --
  readonly editUnitId = signal('');
  readonly editIsSecondTrailer = signal(false);
  readonly hitchSecondConfirmOpen = signal(false);
  readonly hitchLeadUnhitchConfirmOpen = signal(false);

  readonly hitchSelectableUnits = computed(() =>
    unitsEligibleForEquipmentHitch(
      this.unitCatalog(),
      this.equipmentCatalog(),
      this.effEquipment().id,
    ),
  );

  readonly editHitchSlot = computed(() => {
    const unitId = this.editUnitId().trim();
    if (!unitId) {
      return null;
    }
    return unitHitchSlotForNewEquipment(
      this.equipmentCatalog(),
      unitId,
      this.effEquipment().id,
    );
  });

  readonly editHitchValidation = computed(() => {
    if (this.editingSection() !== 'hitch') {
      return validateEquipmentHitchAssignment({
        unitId: '',
        catalog: [],
        isSecondTrailer: false,
      });
    }
    return validateEquipmentHitchAssignment({
      unitId: this.editUnitId(),
      catalog: this.equipmentCatalog(),
      excludeEquipmentId: this.effEquipment().id,
      isSecondTrailer: this.editIsSecondTrailer(),
      unitLabel: this.editTractorLabel(),
    });
  });

  editTractorLabel(): string {
    const id = this.editUnitId().trim();
    if (!id) {
      return '';
    }
    const u = this.unitCatalog().find((unit) => unit.id === id);
    return u ? formatUnitTrailerOperationalId(u) : id;
  }

  toggleEditIsSecondTrailer(): void {
    /* Posición fijada por cupo de la tractora; sin toggle manual. */
  }
  startEditHitch(): void {
    if (!this.canWriteFleet() || this.hitchBlockedForAssignedTractor()) {
      return;
    }
    this.requestFocusDetailTab('ficha');
    const e = this.effEquipment();
    this.editUnitId.set(resourceIdKey(e.unitId));
    this.editIsSecondTrailer.set(isSecondTrailerHitch(e));
    this.editingSection.set('hitch');
  }

  saveEditHitch(): void {
    if (!this.canWriteFleet()) {
      return;
    }
    const unitId = this.editUnitId().trim();
    if (this.hitchBlockedForAssignedTractor()) {
      return;
    }
    if (unitId && this.hitchBlockedForTargetUnit(unitId)) {
      return;
    }
    const validation = this.editHitchValidation();
    if (!validation.canSave) {
      this.toast.show(
        validation.blockMessage ?? validation.infoMessage ?? 'Revise el enganche.',
        'warning',
      );
      return;
    }
    if (unitId && this.editHitchSlot() === 'second') {
      this.hitchSecondConfirmOpen.set(true);
      return;
    }
    this.commitEditHitch();
  }

  confirmEditHitchAsSecondEquipment(): void {
    this.hitchSecondConfirmOpen.set(false);
    this.commitEditHitch();
  }

  cancelEditHitchSecondConfirm(): void {
    this.hitchSecondConfirmOpen.set(false);
  }

  private commitEditHitch(): void {
    if (!this.canWriteFleet()) {
      return;
    }
    const unitId = this.editUnitId().trim();
    const hitchPosition = unitId
      ? hitchPositionForNewEquipmentOnUnit(
          this.equipmentCatalog(),
          unitId,
          this.effEquipment().id,
        )
      : null;
    const equipmentDraft: Partial<Equipment> = {
      unitId: unitId || '',
      hitchPosition,
    };
    this.equipmentOverride.update((prev) => ({ ...prev, ...equipmentDraft }));
    this.persistCurrentEquipment('Enganche actualizado.', { equipment: equipmentDraft });
  }

  requestViewAssignedTractor(): void {
    const unit = this.assignedTractor();
    if (!unit) {
      return;
    }
    this.viewAssignedUnitCallback?.(unit);
  }

  unhitchFromTractor(): void {
    if (!this.canWriteFleet() || this.hitchBlockedForAssignedTractor()) {
      return;
    }
    const equipment = this.effEquipment();
    if (!resourceIdKey(equipment.unitId)) {
      return;
    }
    if (unhitchingLeadRequiresRearPromotion(this.equipmentCatalog(), equipment)) {
      this.hitchLeadUnhitchConfirmOpen.set(true);
      return;
    }
    this.commitUnhitchFromTractor();
  }

  confirmUnhitchLeadFromTractor(): void {
    this.hitchLeadUnhitchConfirmOpen.set(false);
    this.commitUnhitchFromTractor();
  }

  cancelUnhitchLeadFromTractor(): void {
    this.hitchLeadUnhitchConfirmOpen.set(false);
  }

  private commitUnhitchFromTractor(): void {
    if (!this.canWriteFleet()) {
      return;
    }
    this.persistCatalogEquipmentUnhitch(this.effEquipment(), 'Equipo desenganchado.');
  }

  private persistCatalogEquipmentUnhitch(
    equipment: Equipment,
    successMessage: string,
    onSuccess?: () => void,
  ): void {
    if (this.saving()) {
      return;
    }
    const rearToPromote = rearEquipmentToPromoteOnLeadUnhitch(
      this.equipmentCatalog(),
      equipment,
    );
    const unhitchDraft: EquipmentPersistDraft = {
      equipment: equipmentUnhitchPersistDraft(),
    };
    const finishSuccess = () => {
      this.saving.set(false);
      const viewingId = resourceIdKey(this.effEquipment().id);
      const refreshed = this.equipmentFeature
        .equipment()
        .find((e) => resourceIdsEqual(e.id, viewingId));
      if (refreshed) {
        this.equipmentSource.set(refreshed);
        this.equipmentOverride.set({});
      }
      this.syncCatalogFromFeature();
      this.fleetFeature.refreshFleetModule();
      this.toast.show(successMessage, 'success');
      onSuccess?.();
    };
    const finishError = () => {
      this.saving.set(false);
      this.toast.show('No se pudo actualizar el equipo.', 'error');
    };

    this.saving.set(true);
    if (!rearToPromote) {
      this.equipmentFeature
        .updateEquipment(equipment, unhitchDraft, { skipListRefresh: true })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: finishSuccess, error: finishError });
      return;
    }

    const promoteDraft: EquipmentPersistDraft = {
      equipment: equipmentPromoteToLeadPersistDraft(),
    };
    // Primero desenganchar el 1.er; si se promueve el 2.do antes, el backend rechaza otro lead.
    this.equipmentFeature
      .updateEquipment(equipment, unhitchDraft, { skipListRefresh: true })
      .pipe(
        switchMap(() =>
          this.equipmentFeature.updateEquipment(rearToPromote, promoteDraft, {
            skipListRefresh: true,
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: finishSuccess, error: finishError });
  }


  readonly cadenceOptions = FLEET_PAYMENT_CADENCE_OPTIONS;
  readonly insurancePaymentMethodOptions = EXPENSE_PAYMENT_METHOD_OPTIONS.filter(
    (o) => o.value !== '',
  );

  insurancePaymentMethodLabel(code?: string): string {
    return expensePaymentMethodLabel(code);
  }
  readonly today = fleetDrawerTodayIso();

  readonly verifEntryKind = signal<'phys' | null>(null);
  readonly newPhysVerifDate = signal('');
  readonly newPhysVerifCost = signal('');
  readonly agencyExemptionEditing = signal(false);
  readonly editOperatedByAgency = signal(false);
  readonly editExemptStartDate = signal('');

  // -- Seguro: form signals --
  readonly editInsCarrierName = signal('');
  readonly editInsPolicyNumber = signal('');
  readonly editInsContractDate = signal('');
  readonly editInsCadence = signal('');
  readonly editInsPaymentMethod = signal('');
  readonly editInsInvoiceRequired = signal(false);
  readonly editInsCost = signal('');
  /** Póliza y comprobantes (copia editable al abrir seguro). */
  readonly editPolicyNames = signal<string[]>([]);
  readonly editPolicyNewFiles = signal<File[]>([]);

  startEditInsurance(): void {
    this.requestFocusDetailTab('cob');
    this.editPolicyNewFiles.set([]);
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
    this.editInsInvoiceRequired.set(m.insuranceInvoiceRequired === true);
    this.editInsCost.set(m.insuranceCost != null ? String(m.insuranceCost) : '');
    this.editPolicyNames.set([...(m.documentPolicyNames ?? [])]);
    this.editingSection.set('insurance');
  }

  removeEditPolicyDoc(index: number): void {
    this.editPolicyNames.update((prev) => prev.filter((_, i) => i !== index));
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

  saveEditInsurance(): void {
    const cost = parseFleetOptionalAmount(this.editInsCost());
    if (cost === 'invalid') {
      this.toast.show('El costo del seguro debe ser un número válido (≥ 0).', 'warning');
      return;
    }
    const cadenceLabel =
      this.cadenceOptions.find((o) => o.value === this.editInsCadence())?.label ||
      this.editInsCadence().trim() ||
      undefined;
    const policyMerged = [
      ...this.editPolicyNames(),
      ...this.editPolicyNewFiles().map((f) => f.name),
    ];
    const documentPolicyNames =
      policyMerged.length > 0 ? [...new Set(policyMerged)] : undefined;
    const fleetMetaDraft: Partial<EquipmentFleetMeta> = {
      insuranceCarrierName: this.editInsCarrierName().trim() || undefined,
      insurancePolicyNumber: this.editInsPolicyNumber().trim() || undefined,
      insuranceContractDate: this.editInsContractDate().trim() || undefined,
      insurancePaymentCadence: cadenceLabel,
      insurancePaymentMethod: this.editInsPaymentMethod().trim() || undefined,
      insuranceInvoiceRequired: this.editInsInvoiceRequired(),
      insuranceCost: cost === undefined ? undefined : cost,
      documentPolicyNames,
    };
    this.editPolicyNewFiles.set([]);
    this.persistCurrentEquipment(
      'Seguro actualizado.',
      { fleetMeta: fleetMetaDraft },
      COB_SECTION_PERSIST_OPTIONS,
    );
  }
  isPhysVerifFormOpen(): boolean {
    return this.verifEntryKind() === 'phys';
  }

  startPhysVerifEntry(): void {
    if (!this.canWriteFleet()) {
      return;
    }
    this.newPhysVerifDate.set('');
    this.newPhysVerifCost.set('');
    this.verifEntryKind.set('phys');
  }

  cancelPhysVerifEntry(): void {
    this.verifEntryKind.set(null);
    this.newPhysVerifDate.set('');
    this.newPhysVerifCost.set('');
  }

  savePhysVerifEntry(): void {
    if (!this.canWriteFleet()) {
      return;
    }
    const date = this.newPhysVerifDate().trim();
    if (!date) {
      this.toast.show('Indica la fecha de la nueva verificación.', 'warning');
      return;
    }
    if (date > this.today) {
      this.toast.show('La fecha no puede ser futura.', 'warning');
      return;
    }
    const cost = parseFleetOptionalAmount(this.newPhysVerifCost());
    if (cost === 'invalid') {
      this.toast.show('El costo debe ser un número válido (≥ 0).', 'warning');
      return;
    }
    const fleetMetaDraft: Partial<EquipmentFleetMeta> = {
      verificationPhysMechDate: date,
      verificationPhysMechCost: cost === undefined ? undefined : cost,
    };
    this.metaOverride.update((prev) => ({ ...prev, ...fleetMetaDraft }));
    this.cancelPhysVerifEntry();
    this.persistCurrentEquipment(
      'Verificación físico-mecánica registrada.',
      { fleetMeta: fleetMetaDraft },
      COB_SECTION_PERSIST_OPTIONS,
    );
  }

  readonly addingMaint = signal(false);
  readonly newMaintType = signal('servicio_completo');
  readonly newMaintCost = signal('');
  readonly newMaintPaymentMethod = signal('');
  readonly newMaintDate = signal('');
  readonly newMaintNotes = signal('');
  readonly newMaintFiles = signal<File[]>([]);

  readonly newMaintNextMode = signal<'tiempo' | 'km'>('tiempo');
  readonly newMaintNextDate = signal('');
  readonly newMaintNextKmInterval = signal('');
  readonly newMaintNextModeOptions = FLEET_MAINT_SCHEDULE_NEXT_MODE_OPTIONS;

  readonly editingMaintNextDate = signal(false);
  readonly editMaintNextDate = signal('');
  readonly editingMaintKmInterval = signal(false);
  readonly editMaintKmIntervalStr = signal('');

  readonly newMaintTypeOptions = FLEET_MAINTENANCE_TYPE_OPTIONS;
  readonly newMaintPaymentMethodOptions = EXPENSE_PAYMENT_METHOD_OPTIONS;

  readonly newMaintMaxDate = computed(() => this.today);

  private maintTypeLabel(value: string): string {
    return (
      this.newMaintTypeOptions.find((o) => o.value === value)?.label ?? value
    );
  }

  openNewMaint(): void {
    if (!this.canWriteFleet()) {
      return;
    }
    this.cancelMaintScheduleEdits();
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
    this.newMaintNextMode.set('tiempo');
    this.newMaintNextDate.set('');
    this.newMaintNextKmInterval.set('');
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

    const hasScheduleTiempo =
      this.newMaintNextMode() === 'tiempo' &&
      this.newMaintNextDate().trim() !== '';
    const hasScheduleKm =
      this.newMaintNextMode() === 'km' &&
      this.newMaintNextKmInterval().trim() !== '';

    if (hasScheduleTiempo) {
      const nd = this.newMaintNextDate().trim();
      if (!nd || nd < this.today) {
        this.toast.show(
          'Indica la fecha del próximo mantenimiento (hoy o futura).',
          'warning',
        );
        return;
      }
    }
    if (hasScheduleKm) {
      const km = parseFleetPositiveKm(this.newMaintNextKmInterval());
      if (km === 'invalid') {
        this.toast.show(
          'Indica los kilómetros hasta el próximo servicio (mayor a cero).',
          'warning',
        );
        return;
      }
    }

    const resetTractorKmCounter = this.companyKmMaintControlActive();
    const tractor = this.assignedTractor();

    const metaPatch: Partial<EquipmentFleetMeta> = {
      lastMaintenanceDate: date,
      lastMaintenanceType: this.maintTypeLabel(this.newMaintType()),
      lastMaintenanceCost: cost,
      lastMaintenanceNotes: this.newMaintNotes().trim() || undefined,
    };

    if (hasScheduleTiempo) {
      metaPatch.maintenanceNextDateOverride = this.newMaintNextDate().trim();
    } else {
      metaPatch.maintenanceNextDateOverride = undefined;
    }

    this.metaOverride.update((p) => ({ ...p, ...metaPatch }));

    const docs = this.newMaintFiles().map((f) => f.name);
    const paymentMethod = this.newMaintPaymentMethod().trim() || undefined;
    const entry: MaintenanceEntry = {
      date,
      type: this.maintTypeLabel(this.newMaintType()),
      cost,
      notes: this.newMaintNotes().trim() || undefined,
      paymentMethod,
      documentNames: docs.length > 0 ? docs : undefined,
      status: 'concluido',
    };
    this.localMaintEntries.update((prev) => [...prev, entry]);
    this.addingMaint.set(false);
    this.resetNewMaintForm();
    this.persistCurrentEquipment(
      'Mantenimiento agregado.',
      { fleetMeta: metaPatch },
      {
        onSuccess: () => {
          if (resetTractorKmCounter && tractor) {
            this.resetTractorMaintenanceKmCounter(tractor);
          }
        },
      },
    );
  }

  private resetTractorMaintenanceKmCounter(tractor: Unit): void {
    const draft: UnitPersistDraft = { fleetMeta: { maintenanceKmCounter: 0 } };
    const unitToSend: Unit = {
      ...tractor,
      fleetMeta: { ...(tractor.fleetMeta ?? {}), maintenanceKmCounter: 0 },
    };
    this.unitsFeature
      .updateUnit(unitToSend, draft)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.fleetFeature.refreshFleetModule(),
        error: () => {
          this.toast.show(
            'El mantenimiento se guardó, pero no se pudo reiniciar el contador de km de la tractora.',
            'warning',
          );
        },
      });
  }

  readonly equipmentOperationalTitle = computed(() =>
    formatEquipmentOperationalId(this.effEquipment()),
  );

  private operationTypeLabel(code: string): string {
    return (
      EQUIPMENT_OPERATION_TYPE_OPTIONS.find((o) => o.value === code)?.label ?? code
    );
  }

  // -- Identificación: form signals --
  readonly editSerialNumber = signal('');
  readonly editName = signal('');
  readonly editBrand = signal('');
  readonly editYear = signal('');
  readonly editVersion = signal('');
  readonly editType = signal('');
  readonly editPlate = signal('');
  readonly editColor = signal('');
  readonly editVisibility = signal<'active' | 'inactive'>('active');

  readonly equipmentBrandNames = this.fleetFeature.equipmentBrandNames;
  readonly editEquipmentVersionNames = computed(() =>
    this.fleetFeature.versionNamesFor('EQUIPMENT', this.editBrand()),
  );
  readonly operationTypeOptions = EQUIPMENT_OPERATION_TYPE_OPTIONS;
  readonly equipmentOperationTypeCode = computed(() =>
    resolveEquipmentOperationTypeCode(this.effEquipment().type),
  );
  readonly containerSlotOptionsForEquipment = computed(() =>
    containerSlotSelectOptionsForOperationType(this.equipmentOperationTypeCode()),
  );
  readonly containerSlotFieldAppliesForEquipment = computed(() =>
    containerSlotFieldApplies(this.equipmentOperationTypeCode()),
  );
  readonly containerSlotFieldLabelForEquipment = computed(() =>
    containerSlotFieldLabel(this.equipmentOperationTypeCode()),
  );

  readonly modelYearOptions = buildFleetModelYearSelectOptions();
  readonly visibilityOptions = FLEET_RESOURCE_VISIBILITY_OPTIONS;

  resourceVisibilityLabel(): string {
    return fleetResourceActiveLabel(this.effEquipment().isActive);
  }

  startEditId(): void {
    this.fleetFeature.ensureFleetCatalogLoaded();
    this.requestFocusDetailTab('ficha');
    this.clearStagedDocUploads();
    const e = this.effEquipment();
    const m = e.fleetMeta ?? {};
    this.editSerialNumber.set(e.serialNumber?.trim() || '');
    this.editName.set(e.name?.trim() || '');
    this.editBrand.set(
      m.trailerBrandName?.trim() || e.trailerBrandAbbr?.trim() || '',
    );
    this.editYear.set(e.trailerYear?.trim() || '');
    this.editVersion.set(m.trailerVersion?.trim() || '');
    const typeRaw = e.type?.trim() || '';
    this.editType.set(
      EQUIPMENT_OPERATION_TYPE_OPTIONS.some((o) => o.value === typeRaw)
        ? typeRaw
        : fleetValueFromLabel(EQUIPMENT_OPERATION_TYPE_OPTIONS, typeRaw) || typeRaw,
    );
    this.editPlate.set(e.plate?.trim() || '');
    this.editColor.set(m.trailerColor?.trim() || '');
    this.editVisibility.set(e.isActive === false ? 'inactive' : 'active');
    this.editingSection.set('id');
  }
  saveEditId(): void {
    const serial = this.editSerialNumber().trim().toUpperCase();
    const typeVal = this.editType().trim();
    if (!serial || !typeVal) {
      this.toast.show('Número de serie y tipo de unidad son obligatorios.', 'warning');
      return;
    }
    const brandName = this.editBrand().trim();
    if (!brandName) {
      this.toast.show('Marca es obligatoria.', 'warning');
      return;
    }
    const brandAbbr = deriveFleetBrandAbbr(brandName);
    const plate = this.editPlate().trim().toUpperCase() || undefined;
    const equipmentDraft: Partial<Equipment> = {
      serialNumber: serial,
      name: this.editName().trim(),
      plate,
      type: this.operationTypeLabel(typeVal),
      isActive: this.editVisibility() === 'active',
      trailerBrandAbbr: brandAbbr || undefined,
      trailerYear: this.editYear().trim() || undefined,
    };
    const fleetMetaDraft: Partial<EquipmentFleetMeta> = {
      trailerBrandName: brandName,
      trailerVersion: this.editVersion().trim() || undefined,
      trailerColor: this.editColor().trim() || undefined,
    };
    this.equipmentOverride.update((prev) => ({ ...prev, ...equipmentDraft }));
    this.metaOverride.update((prev) => ({ ...prev, ...fleetMetaDraft }));
    this.fleetFeature.registerLocalCatalogEntry(
      'EQUIPMENT',
      brandName,
      this.editVersion().trim() || undefined,
    );
    this.persistCurrentEquipment('Identificación actualizada.', {
      equipment: equipmentDraft,
      fleetMeta: fleetMetaDraft,
    });
  }
  // -- Propiedad y tenencia: form signals --
  readonly editTenureMode = signal<TrailerTenureMode>('owned');
  readonly editCommercialValue = signal('');
  readonly editRecurringAmount = signal('');
  readonly editRecurringDate = signal('');
  readonly editRecurringInstallments = signal('');
  readonly editOwnerPayout = signal('');
  /** Nombres de documentos de propiedad (copia editable al abrir tenencia). */
  readonly editOwnershipNames = signal<string[]>([]);
  readonly editOwnershipNewFiles = signal<File[]>([]);

  readonly tenureOptions = FLEET_TRAILER_TENURE_OPTIONS;

  tenureRecurringAmountLabel(): string {
    return this.editTenureMode() === 'leased' ? 'Monto de renta' : 'Monto por cuota';
  }

  tenureInstallmentOrTermLabel(): string {
    return this.editTenureMode() === 'leased'
      ? 'Plazos o meses de contrato'
      : 'Total de cuotas';
  }

  startEditTenure(): void {
    this.requestFocusDetailTab('ficha');
    this.clearStagedDocUploads();
    const m = this.meta() ?? {};
    this.editTenureMode.set(trailerTenureModeOrDefault(m.trailerTenureMode));
    this.editCommercialValue.set(
      m.trailerCommercialValue != null ? String(m.trailerCommercialValue) : '',
    );
    this.editRecurringAmount.set(
      m.trailerRecurringPaymentAmount != null
        ? String(m.trailerRecurringPaymentAmount)
        : '',
    );
    this.editRecurringDate.set(m.trailerRecurringPaymentDate ?? '');
    this.editRecurringInstallments.set(
      m.trailerRecurringInstallmentCount != null
        ? String(m.trailerRecurringInstallmentCount)
        : '',
    );
    this.editOwnerPayout.set(
      m.trailerManagementOwnerPayout != null
        ? String(m.trailerManagementOwnerPayout)
        : '',
    );
    this.editOwnershipNames.set([...(m.documentOwnershipNames ?? [])]);
    this.editingSection.set('tenure');
  }

  removeEditOwnershipDoc(index: number): void {
    this.editOwnershipNames.update((prev) => prev.filter((_, i) => i !== index));
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
    this.editTenureMode.set(trailerTenureModeOrDefault(raw));
  }

  saveEditTenure(): void {
    const mode = trailerTenureModeOrDefault(this.editTenureMode());
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
    let trailerManagementOwnerPayout: number | undefined;
    if (mode === 'owned') {
      trailerCommercialValue = commercial === undefined ? undefined : commercial;
    } else if (mode === 'financed' || mode === 'leased') {
      trailerRecurringPaymentAmount = recAmt === undefined ? undefined : recAmt;
      trailerRecurringPaymentDate = this.editRecurringDate().trim() || undefined;
      trailerRecurringInstallmentCount = recCount === undefined ? undefined : recCount;
    } else if (mode === 'managed') {
      trailerManagementOwnerPayout = payout === undefined ? undefined : payout;
    }
    const ownershipMerged = [
      ...this.editOwnershipNames(),
      ...this.editOwnershipNewFiles().map((f) => f.name),
    ];
    const documentOwnershipNames =
      ownershipMerged.length > 0 ? [...new Set(ownershipMerged)] : undefined;
    const fleetMetaDraft: Partial<EquipmentFleetMeta> = {
      trailerTenureMode: mode,
      trailerCommercialValue,
      trailerRecurringPaymentAmount,
      trailerRecurringPaymentDate,
      trailerRecurringInstallmentCount,
      trailerManagementOwnerPayout,
      documentOwnershipNames,
    };
    this.metaOverride.update((prev) => ({ ...prev, ...fleetMetaDraft }));
    this.editOwnershipNewFiles.set([]);
    this.persistCurrentEquipment('Propiedad y tenencia actualizadas.', {
      fleetMeta: fleetMetaDraft,
    });
  }

  // -- Ficha técnica --
  readonly editTechCapacityTons = signal('');
  readonly editTechAxles = signal('');
  readonly editTechSlot = signal('');

  startEditTech(): void {
    this.requestFocusDetailTab('ficha');
    this.clearStagedDocUploads();
    const m = this.meta() ?? {};
    this.editTechCapacityTons.set(m.equipmentCapacityTons?.trim() ?? '');
    this.editTechAxles.set(
      m.equipmentAxleCount != null ? String(m.equipmentAxleCount) : '',
    );
    const typeCode = resolveEquipmentOperationTypeCode(this.effEquipment().type);
    const raw = m.equipmentContainerSlotConfig?.trim() ?? '';
    this.editTechSlot.set(coerceContainerSlotForOperationType(typeCode, raw));
    this.editingSection.set('tech');
  }

  saveEditTech(): void {
    const tonsRaw = this.editTechCapacityTons().trim().replace(/,/g, '');
    if (tonsRaw) {
      const n = Number(tonsRaw);
      if (!Number.isFinite(n) || n <= 0) {
        this.toast.show('Capacidad en toneladas no es válida.', 'warning');
        return;
      }
    }
    const axlesParsed = parseFleetOptionalPositiveInt(this.editTechAxles());
    if (axlesParsed === 'invalid') {
      this.toast.show('Número de ejes debe ser un entero mayor que cero.', 'warning');
      return;
    }
    const typeCode = resolveEquipmentOperationTypeCode(this.effEquipment().type);
    const slotVal = this.editTechSlot().trim();
    const slotLabel = containerSlotFieldApplies(typeCode)
      ? containerSlotLabelForKey(
          coerceContainerSlotForOperationType(typeCode, slotVal),
        )
      : undefined;
    const fleetMetaDraft: Partial<EquipmentFleetMeta> = {
      equipmentCapacityTons: tonsRaw || undefined,
      equipmentAxleCount: axlesParsed === undefined ? undefined : axlesParsed,
      equipmentContainerSlotConfig: slotLabel,
    };
    this.metaOverride.update((prev) => ({ ...prev, ...fleetMetaDraft }));
    this.persistCurrentEquipment('Ficha técnica actualizada.', { fleetMeta: fleetMetaDraft });
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
    const e = this.effEquipment();
    return fleetBrandDisplayName({
      trailerBrandName: e.fleetMeta?.trailerBrandName,
      trailerBrandAbbr: e.trailerBrandAbbr,
    });
  }

  operationTypeDisplay(): string {
    const t = this.effEquipment().type?.trim();
    if (!t) {
      return '—';
    }
    const byVal = EQUIPMENT_OPERATION_TYPE_OPTIONS.find((o) => o.value === t);
    if (byVal) {
      return byVal.label;
    }
    const byLab = EQUIPMENT_OPERATION_TYPE_OPTIONS.find((o) => o.label.trim() === t);
    if (byLab) {
      return byLab.label;
    }
    return t;
  }

  slotConfigDisplay(): string {
    const typeCode = resolveEquipmentOperationTypeCode(this.effEquipment().type);
    if (!containerSlotFieldApplies(typeCode)) {
      return '—';
    }
    const raw = this.meta()?.equipmentContainerSlotConfig?.trim();
    if (!raw) {
      return '—';
    }
    const key = resolveContainerSlotConfigKey(raw);
    if (key) {
      return containerSlotLabelForKey(key);
    }
    return raw;
  }

  statusBanner(): { label: string; sub?: string; mod: string } {
    const key = operationalKeyEquipment(this.effEquipment(), this.onRoute());
    const label = fleetOperationalKeyLabel(key);
    let mod = 'fleet-unit-detail__status--unknown';
    switch (key) {
      case 'on_route':
        mod = 'fleet-unit-detail__status--route';
        break;
      case 'available':
        mod = 'fleet-unit-detail__status--available';
        break;
      case 'in_use':
        mod = 'fleet-unit-detail__status--inuse';
        break;
      case 'maintenance':
        mod = 'fleet-unit-detail__status--maintenance';
        break;
      case 'scheduled':
        mod = 'fleet-unit-detail__status--scheduled';
        break;
      default:
        break;
    }
    return { label, mod };
  }

  catalogStatusLabel(): string {
    return fleetOperationalKeyLabel(
      operationalKeyEquipment(this.effEquipment(), this.onRoute()),
    );
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

  canEditMaintNextDate(): boolean {
    return this.canWriteFleet() && !this.companyDateMaintControlActive();
  }

  maintenanceKmRemainingDisplay(): string {
    const raw = fleetMaintenanceKmRemaining(
      this.maintenanceKmMeta(),
      this.companyMaintPolicy(),
    );
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
      return `${new Intl.NumberFormat('es-MX', {
        maximumFractionDigits: 0,
      }).format(raw)} km`;
    }
    return '—';
  }

  maintKmRenewalBucket(): FleetRenewalBucket {
    const v = fleetMaintenanceKmRemaining(
      this.maintenanceKmMeta(),
      this.companyMaintPolicy(),
    );
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

  startEditMaintNextDate(): void {
    if (!this.canEditMaintNextDate()) {
      this.toast.show(
        'El periodo de mantenimiento por fechas está definido en Configuración operativa.',
        'info',
      );
      return;
    }
    this.editMaintNextDate.set(
      nextMaintenanceDueIso(this.meta(), this.companyMaintPolicy()) ?? '',
    );
    this.editingMaintNextDate.set(true);
  }

  cancelEditMaintNextDate(): void {
    this.editingMaintNextDate.set(false);
    this.editMaintNextDate.set('');
  }

  saveEditMaintNextDate(): void {
    const raw = this.editMaintNextDate().trim();
    if (!raw) {
      const fleetMetaDraft: Partial<EquipmentFleetMeta> = {
        maintenanceNextDateOverride: undefined,
      };
      this.metaOverride.update((p) => ({ ...p, ...fleetMetaDraft }));
      this.cancelEditMaintNextDate();
      this.persistCurrentEquipment(
        'Se quitó la fecha manual; se usará el ciclo sugerido desde el último servicio.',
        { fleetMeta: fleetMetaDraft },
      );
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw < this.today) {
      this.toast.show(
        'Indica una fecha válida (hoy o futura) en formato año-mes-día.',
        'warning',
      );
      return;
    }
    const fleetMetaDraft: Partial<EquipmentFleetMeta> = {
      maintenanceNextDateOverride: raw,
    };
    this.metaOverride.update((p) => ({ ...p, ...fleetMetaDraft }));
    this.cancelEditMaintNextDate();
    this.persistCurrentEquipment('Fecha de próximo mantenimiento guardada.', {
      fleetMeta: fleetMetaDraft,
    });
  }

  startEditMaintKmInterval(): void {
    if (this.companyKmMaintControlActive()) {
      this.toast.show(
        'El intervalo por kilómetros está definido en Configuración operativa.',
        'info',
      );
      return;
    }
    const m = this.meta();
    const v = m?.maintenanceKmInterval;
    this.editMaintKmIntervalStr.set(
      typeof v === 'number' && Number.isFinite(v) && v > 0 ? String(v) : '',
    );
    this.editingMaintKmInterval.set(true);
  }

  cancelEditMaintKmInterval(): void {
    this.editingMaintKmInterval.set(false);
    this.editMaintKmIntervalStr.set('');
  }

  saveEditMaintKmInterval(): void {
    this.toast.show(
      'El intervalo por kilómetros está definido en Configuración operativa.',
      'info',
    );
    this.cancelEditMaintKmInterval();
  }

  insNext(): string {
    return nextInsuranceTableDate(this.meta()) ?? '—';
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
    const scheduleRow = this.insurancePaymentSchedule().find((row) => row.canConfirm);
    if (scheduleRow) {
      this.confirmInsurancePaymentCycle(scheduleRow.dueDate);
      return;
    }
    const next = nextInsurancePaymentDate(this.meta());
    if (!next) {
      return;
    }
    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, '0');
    const day = String(next.getDate()).padStart(2, '0');
    this.confirmInsurancePaymentCycle(`${y}-${m}-${day}`);
  }

  confirmInsurancePaymentCycle(dueDate: string): void {
    if (!this.canWriteFleet() || this.saving()) {
      return;
    }
    const normalizedDueDate = dueDate.trim();
    if (!normalizedDueDate) {
      return;
    }
    const scheduleRow = this.insurancePaymentSchedule().find(
      (row) => row.dueDate === normalizedDueDate,
    );
    if (scheduleRow && !scheduleRow.canConfirm) {
      return;
    }
    const cost = this.meta()?.insuranceCost;
    if (cost == null || !Number.isFinite(cost) || cost <= 0) {
      this.toast.show(
        'Registra el costo por ciclo del seguro antes de confirmar el pago.',
        'warning',
      );
      return;
    }
    const patch: Partial<EquipmentFleetMeta> = {
      insuranceLastPaymentDate: normalizedDueDate,
    };
    this.persistCurrentEquipment(
      'Pago de póliza registrado.',
      { fleetMeta: patch, sparseFleetMeta: true },
      COB_SECTION_PERSIST_OPTIONS,
    );
  }

  private subscribeInsurancePaymentExpensesLoad(): Subscription | null {
    const equipment = this.equipmentSource();
    const equipmentId = equipment?.id;
    const meta = equipment?.fleetMeta;
    if (
      this.detailTab() !== 'cob' ||
      !equipmentId ||
      !showInsurancePaymentSchedule(meta?.insurancePaymentCadence)
    ) {
      this.insurancePaymentExpenses.set([]);
      return null;
    }
    const bounds = insurancePolicyYearBounds(meta, new Date(this.today));
    if (!bounds) {
      this.insurancePaymentExpenses.set([]);
      return null;
    }
    const requestId = ++this.insurancePaymentExpensesLoadId;
    return this.expensesApi
      .getExpensesPage(
        buildFleetCoverageExpensesPageParams(
          { resource: 'equipment', equipmentId },
          'insurance',
          bounds,
        ),
      )
      .pipe(
        catchError(() =>
          of({ items: [] as Expense[], total: 0, page: 1, limit: 0, totalAmount: 0 }),
        ),
      )
      .subscribe((res) => {
        if (requestId !== this.insurancePaymentExpensesLoadId) {
          return;
        }
        this.insurancePaymentExpenses.set(res.items);
      });
  }

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
    return [...base, ...local].filter(isSubstantiveMaintenanceEntry).sort((a, b) =>
      (b.date ?? '').localeCompare(a.date ?? ''),
    );
  }

  docNames(which: 'maint' | 'policy' | 'ownership' | 'verification'): string[] {
    const m = this.meta();
    if (!m) {
      return [];
    }
    if (which === 'maint') {
      return m.documentMaintenanceNames ?? [];
    }
    if (which === 'ownership') {
      return m.documentOwnershipNames ?? [];
    }
    if (which === 'verification') {
      return m.documentVerificationNames ?? [];
    }
    return m.documentPolicyNames ?? [];
  }

  downloadStoredDocument(_fileName: string): void {
    this.toast.show('La descarga de documentos estará disponible con la API de archivos.', 'info');
  }

  operatedByAgencyLabel(): string {
    return this.meta()?.equipmentOperatedByAgency === true ? 'Sí' : 'No';
  }

  physMechExemptStartLabel(): string {
    const raw =
      this.meta()?.physMechTwoYearExemptStartDate?.trim() ||
      this.equipment().lastServiceDate?.trim();
    return raw ? this.formatYmd(raw) : '—';
  }

  startAgencyExemptionEdit(): void {
    if (!this.canWriteFleet()) {
      return;
    }
    const m = this.meta();
    this.editOperatedByAgency.set(m?.equipmentOperatedByAgency === true);
    this.editExemptStartDate.set(
      m?.physMechTwoYearExemptStartDate?.trim() ||
        this.equipment().lastServiceDate?.trim() ||
        '',
    );
    this.agencyExemptionEditing.set(true);
  }

  cancelAgencyExemptionEdit(): void {
    this.agencyExemptionEditing.set(false);
    this.editOperatedByAgency.set(false);
    this.editExemptStartDate.set('');
  }

  saveAgencyExemption(): void {
    if (!this.canWriteFleet()) {
      return;
    }
    const byAgency = this.editOperatedByAgency();
    const start = this.editExemptStartDate().trim();
    if (byAgency && !start) {
      this.toast.show(
        'Indica la fecha de inicio de la exención de 2 años.',
        'warning',
      );
      return;
    }
    if (byAgency && start > this.today) {
      this.toast.show('La fecha de inicio no puede ser futura.', 'warning');
      return;
    }
    const fleetMetaDraft: Partial<EquipmentFleetMeta> = {
      equipmentOperatedByAgency: byAgency,
      physMechTwoYearExemptStartDate: byAgency ? start : undefined,
    };
    this.metaOverride.update((prev) => ({ ...prev, ...fleetMetaDraft }));
    this.cancelAgencyExemptionEdit();
    this.persistCurrentEquipment('Exención de verificación actualizada.', {
      fleetMeta: fleetMetaDraft,
    });
  }

  physMechExemptionActive(): boolean {
    const e = this.effEquipment();
    const m = this.meta();
    const end = equipmentPhysMechTwoYearExemptionEnd(e, m);
    if (!end) {
      return false;
    }
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const ed = new Date(end.getTime());
    ed.setHours(0, 0, 0, 0);
    return t.getTime() < ed.getTime();
  }

  physMechRenewalBucketForUi(): FleetRenewalBucket {
    return equipmentPhysMechVerificationBucket(this.effEquipment(), this.meta());
  }

  physMechTooltipText(): string {
    return equipmentPhysMechVerificationTooltip(this.effEquipment(), this.meta());
  }

  physMechNextShortLabel(): string {
    const e = this.effEquipment();
    const m = this.meta();
    const t = nextCycleFormatted(m?.verificationPhysMechDate, VERIF_MO);
    const fromCycle = t ? t.replace(/^Próxima:\s*/i, '').trim() : '—';
    if (this.physMechExemptionActive()) {
      const end = nextEquipmentPhysMechTableDate(e, m);
      return end ? `A partir del ${end}` : '—';
    }
    return fromCycle;
  }

  formatTrackingAmount(n: number | undefined): string {
    if (n == null || !Number.isFinite(n)) {
      return '—';
    }
    return new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(n);
  }

  maintRenewalBucket(): FleetRenewalBucket {
    return fleetMaintenanceRenewal(this.meta(), this.companyMaintPolicy());
  }

  insRenewalBucket(): FleetRenewalBucket {
    return fleetInsuranceRenewal(this.meta());
  }

  constructor() {
    registerFleetVersionResetOnBrandChange({
      brandName: () => this.editBrand(),
      versionName: this.editVersion,
    });

    effect(() => {
      const equipment = this.equipmentFeature.selectedEquipment();
      if (!equipment) {
        return;
      }
      this.unitsFeature.units();
      this.equipmentFeature.equipment();
      this.bindHostEquipment(equipment);
      this.syncCatalogFromFeature();
    });

    effect((onCleanup) => {
      this.detailTab();
      this.equipmentSource();
      const sub = this.subscribeInsurancePaymentExpensesLoad();
      if (sub) {
        onCleanup(() => sub.unsubscribe());
      }
    });

    registerFleetHitchSlotSync({
      isActive: () => this.editingSection() === 'hitch',
      catalog: () => this.equipmentCatalog(),
      unitId: () => this.editUnitId(),
      excludeEquipmentId: () => this.effEquipment().id,
      isSecondTrailer: this.editIsSecondTrailer,
    });

    let priorEquipmentId = '';
    effect(() => {
      const current = this.equipmentSource();
      if (!current) {
        return;
      }
      const id = current.id;
      if (priorEquipmentId !== '' && priorEquipmentId !== id) {
        this.resetOnEquipmentIdentityChange();
        this.cancelPhysVerifEntry();
        this.addingMaint.set(false);
        this.resetNewMaintForm();
        this.cancelMaintScheduleEdits();
        this.detailTab.set('mant');
      }
      priorEquipmentId = id;
    });

    effect(() => {
      const equipment = this.equipmentFeature.selectedEquipment();
      const tab = this.fleetFeature.pendingDetailTab();
      if (!equipment || !tab) {
        return;
      }
      this.fleetFeature.clearPendingDetailTab();
      this.requestFocusDetailTab(tab);
    });
  }
}
