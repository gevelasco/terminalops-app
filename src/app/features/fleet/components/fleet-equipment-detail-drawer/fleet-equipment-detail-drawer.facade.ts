import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import { EquipmentFeatureService } from '@features/fleet/services/equipment.service';
import { UnitsFeatureService } from '@features/fleet/services/units.service';
import {
  companyMaintenancePolicyFromSession,
  maintenanceDatePeriodLabel,
} from '@shared/models/company-operational-settings.models';
import type { EquipmentPersistDraft } from '@shared/utils/fleet/equipment-api-payload';
import { fleetTenureMetaEquals } from '@features/fleet/utils/fleet-tenure-meta-equals';
import {
  trackFileEntry,
  trackMaintenanceEntry,
  trackStringEntry,
} from '@features/fleet/utils/list-trackers';
import { fleetUnitDetailSegmentTabs } from '@app/features/fleet/utils/fleet-unit-detail-segment-tabs';
import { FLEET_UNIT_DETAIL_TAB_SYMBOLS } from '@app/features/fleet/utils/fleet-unit-detail-tab-symbols';
import {
  EQUIPMENT_CONTAINER_SLOT_OPTIONS,
  EQUIPMENT_OPERATION_TYPE_OPTIONS,
  FLEET_PAYMENT_CADENCE_OPTIONS,
  FLEET_TRAILER_TENURE_OPTIONS,
  FLEET_UNIT_STATUS_OPTIONS,
  TRAILER_BRAND_OPTIONS,
  buildFleetModelYearSelectOptions,
  FLEET_MAINT_SCHEDULE_NEXT_MODE_OPTIONS,
  FLEET_MAINTENANCE_ENTRY_STATUS_OPTIONS,
  FLEET_MAINTENANCE_TYPE_OPTIONS,
} from '@shared/catalogs/fleet-form-options';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';
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
  registerFleetHitchSecondTrailerSync,
} from '@app/features/fleet/utils/fleet-drawer-form.utils';
import {
  trailerTenureModeLabel,
  trailerTenureModeOrDefault,
} from '@shared/utils/fleet/trailer-tenure-mode';
import { validateEquipmentHitchAssignment } from '@shared/utils/fleet/equipment-hitch-assignment';
import {
  hitchPositionForEquipmentWrite,
  isSecondTrailerHitch,
} from '@shared/utils/fleet/equipment-hitch-position';
import { formatUnitTrailerOperationalId } from '@shared/utils/fleet/unit-label';
import { resourceIdKey } from '@shared/utils/resource-id';
import { equipmentHitchPositionDisplayLabel } from '@app/features/fleet/utils/unit-hitched-equipment';
import { formatEquipmentOperationalId } from '@shared/utils/fleet/fleet-id-builders';
import {
  Equipment,
  EquipmentFleetMeta,
  MaintenanceEntry,
  MaintenanceEntryStatus,
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

export type {
  EquipmentDetailDrawerTab,
  FleetEquipmentDetailDrawerHostCallbacks,
  FleetEquipmentDetailDrawerHostLayout,
} from '@features/fleet/components/fleet-equipment-detail-drawer/fleet-equipment-detail-drawer.types';

const VERIF_MO = 6;

@Injectable()
export class FleetEquipmentDetailDrawerFacade {
  readonly toast = inject(ToastService);
  readonly session = inject(SessionService);
  readonly destroyRef = inject(DestroyRef);
  private readonly equipmentFeature = inject(EquipmentFeatureService);
  private readonly unitsFeature = inject(UnitsFeatureService);
  private readonly domain = inject(FleetEquipmentDetailDomain);

  private dismissCallback: (() => void) | null = null;
  private readonly equipmentSource = signal<Equipment | null>(null);
  private readonly unitCatalogSource = signal<Unit[]>([]);
  private readonly equipmentCatalogSource = signal<Equipment[]>([]);
  private readonly onRouteSource = signal(false);
  private readonly completedManeuverCountSource = signal(0);

  readonly equipment = computed(() => this.equipmentSource()!);
  readonly unitCatalog = computed(() => this.unitCatalogSource());
  readonly equipmentCatalog = computed(() => this.equipmentCatalogSource());
  readonly onRoute = computed(() => this.onRouteSource());
  readonly completedManeuverCount = computed(() => this.completedManeuverCountSource());

  readonly verifCycleMo = VERIF_MO;
  readonly formatYmd = formatFleetYmdMx;
  readonly trackFileEntry = trackFileEntry;
  readonly trackStringEntry = trackStringEntry;
  readonly trackMaintenanceEntry = trackMaintenanceEntry;
  readonly detailSegmentTabs = fleetUnitDetailSegmentTabs('fleet-eqd');
  readonly detailTabSymbols = FLEET_UNIT_DETAIL_TAB_SYMBOLS;

  readonly drawerLoading = signal(false);
  readonly saving = signal(false);

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

  companyMaintPolicyHint(): string {
    const p = this.companyMaintPolicy();
    const parts: string[] = [];
    if (p.kmControlEnabled && p.kmIntervalDefault != null) {
      parts.push(`Km (empresa): cada ${p.kmIntervalDefault.toLocaleString('es-MX')} km`);
    }
    if (p.dateControlEnabled && p.datePeriod) {
      parts.push(`Fechas (empresa): ${maintenanceDatePeriodLabel(p.datePeriod)}`);
    }
    return parts.join(' · ');
  }

  bindHostCallbacks(callbacks: FleetEquipmentDetailDrawerHostCallbacks): void {
    this.dismissCallback = callbacks.dismiss;
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
      this.editingSection.set(null);
      this.drawerLoading.set(false);
      return;
    }

    this.applyHostEquipmentSnapshotWhenRicher(equipment);
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
    this.completedManeuverCountSource.set(layout.completedManeuverCount);
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

  /** Km del tractora (inyectado en `uiTractorCompletedTripDistanceKm`). */
  uiTractorTripKm(): number | null {
    const v = this.effEquipment().uiTractorCompletedTripDistanceKm;
    if (v == null || !Number.isFinite(v)) {
      return null;
    }
    return v;
  }

  persistCurrentEquipment(successMessage: string, draft?: EquipmentPersistDraft): void {
    if (this.saving()) return;
    const equipmentToSend = this.domain.equipmentForPersist(this.effEquipment(), this.localMaintEntries(), draft);
    this.saving.set(true);
    this.equipmentFeature
      .updateEquipment(equipmentToSend, draft)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.equipmentSource.set(saved);
          this.equipmentOverride.set({});
          this.metaOverride.set({});
          this.localMaintEntries.set([]);
          this.toast.show(successMessage, 'success');
          this.editingSection.set(null);
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
    return equipmentHitchPositionDisplayLabel(e);
  });

  // -- Enganche --
  readonly editUnitId = signal('');
  readonly editIsSecondTrailer = signal(false);

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

  private editTractorLabel(): string {
    const id = this.editUnitId().trim();
    if (!id) {
      return '';
    }
    const u = this.unitCatalog().find((unit) => unit.id === id);
    return u ? formatUnitTrailerOperationalId(u) : id;
  }

  toggleEditIsSecondTrailer(): void {
    if (!this.editHitchValidation().canToggleSecondTrailer) {
      return;
    }
    this.editIsSecondTrailer.update((v) => !v);
  }
  startEditHitch(): void {
    this.requestFocusDetailTab('ficha');
    const e = this.effEquipment();
    this.editUnitId.set(resourceIdKey(e.unitId));
    this.editIsSecondTrailer.set(isSecondTrailerHitch(e));
    this.editingSection.set('hitch');
  }

  saveEditHitch(): void {
    const unitId = this.editUnitId().trim();
    const validation = this.editHitchValidation();
    if (!validation.canSave) {
      this.toast.show(
        validation.blockMessage ?? validation.infoMessage ?? 'Revise el enganche.',
        'warning',
      );
      return;
    }
    const hitchPosition = hitchPositionForEquipmentWrite(
      unitId,
      this.editIsSecondTrailer(),
    );
    const equipmentDraft: Partial<Equipment> = {
      unitId: unitId || '',
      hitchPosition: hitchPosition ?? null,
    };
    this.equipmentOverride.update((prev) => ({ ...prev, ...equipmentDraft }));
    this.persistCurrentEquipment('Enganche actualizado.', { equipment: equipmentDraft });
  }


  readonly cadenceOptions = FLEET_PAYMENT_CADENCE_OPTIONS;
  readonly today = fleetDrawerTodayIso();

  readonly verifEntryKind = signal<'phys' | null>(null);
  readonly newPhysVerifDate = signal('');
  readonly newPhysVerifCost = signal('');

  // -- Seguro: form signals --
  readonly editInsCarrierName = signal('');
  readonly editInsPolicyNumber = signal('');
  readonly editInsContractDate = signal('');
  readonly editInsCadence = signal('');
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
      insuranceCost: cost === undefined ? undefined : cost,
      documentPolicyNames,
    };
    this.metaOverride.update((prev) => ({ ...prev, ...fleetMetaDraft }));
    this.editPolicyNewFiles.set([]);
    this.persistCurrentEquipment('Seguro actualizado.', { fleetMeta: fleetMetaDraft });
  }
  isPhysVerifFormOpen(): boolean {
    return this.verifEntryKind() === 'phys';
  }

  startPhysVerifEntry(): void {
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
    this.persistCurrentEquipment('Verificación físico-mecánica registrada.', {
      fleetMeta: fleetMetaDraft,
    });
  }

  readonly addingMaint = signal(false);
  readonly newMaintStatus = signal<MaintenanceEntryStatus>('concluido');
  readonly newMaintType = signal('servicio_completo');
  readonly newMaintCost = signal('');
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

  readonly newMaintStatusOptions = FLEET_MAINTENANCE_ENTRY_STATUS_OPTIONS;
  readonly newMaintTypeOptions = FLEET_MAINTENANCE_TYPE_OPTIONS;

  readonly newMaintMinDate = computed(() =>
    this.newMaintStatus() === 'programado' ? this.today : undefined,
  );
  readonly newMaintMaxDate = computed(() =>
    this.newMaintStatus() === 'concluido' ? this.today : undefined,
  );

  private maintTypeLabel(value: string): string {
    return (
      this.newMaintTypeOptions.find((o) => o.value === value)?.label ?? value
    );
  }

  openNewMaint(): void {
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
    this.newMaintStatus.set('concluido');
    this.newMaintType.set('servicio_completo');
    this.newMaintCost.set('');
    this.newMaintDate.set('');
    this.newMaintNotes.set('');
    this.newMaintFiles.set([]);
    this.newMaintNextMode.set('tiempo');
    this.newMaintNextDate.set('');
    this.newMaintNextKmInterval.set('');
  }

  onNewMaintStatusChange(): void {
    if (this.newMaintStatus() === 'programado') {
      this.newMaintNextDate.set('');
      this.newMaintNextKmInterval.set('');
    }
    const date = this.newMaintDate().trim();
    if (!date) {
      return;
    }
    if (this.newMaintStatus() === 'programado' && date < this.today) {
      this.newMaintDate.set('');
    }
    if (this.newMaintStatus() === 'concluido' && date > this.today) {
      this.newMaintDate.set('');
    }
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
    if (this.newMaintStatus() === 'programado' && date < this.today) {
      this.toast.show(
        'Un mantenimiento programado debe tener fecha futura.',
        'warning',
      );
      return;
    }
    if (this.newMaintStatus() === 'concluido' && date > this.today) {
      this.toast.show(
        'Un mantenimiento concluido no puede tener fecha futura.',
        'warning',
      );
      return;
    }
    const cost = parseFleetOptionalAmount(this.newMaintCost());
    if (cost === 'invalid') {
      this.toast.show(
        'El costo debe ser un número válido (≥ 0) o dejarse vacío.',
        'warning',
      );
      return;
    }

    const status = this.newMaintStatus();
    const scheduleNext = status === 'concluido';
    const hasScheduleTiempo =
      scheduleNext &&
      this.newMaintNextMode() === 'tiempo' &&
      this.newMaintNextDate().trim() !== '';
    const hasScheduleKm =
      scheduleNext &&
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

    const tripKmNow = this.uiTractorTripKm();
    const metaPatch: Partial<EquipmentFleetMeta> = {};

    if (status === 'programado') {
      metaPatch.maintenanceNextDateOverride = date;
      metaPatch.maintenanceAlertByKm = false;
    } else if (hasScheduleTiempo) {
      metaPatch.maintenanceNextDateOverride = this.newMaintNextDate().trim();
      metaPatch.maintenanceAlertByKm = false;
      metaPatch.maintenanceKmInterval = undefined;
      metaPatch.maintenanceTripKmAtLastService = undefined;
      metaPatch.maintenanceKmRemaining = null;
    } else if (hasScheduleKm) {
      const km = parseFleetPositiveKm(this.newMaintNextKmInterval());
      if (km === 'invalid') {
        return;
      }
      metaPatch.maintenanceKmInterval = km;
      metaPatch.maintenanceTripKmAtLastService = tripKmNow ?? 0;
      metaPatch.maintenanceAlertByKm = true;
      metaPatch.maintenanceNextDateOverride = undefined;
      metaPatch.maintenanceKmRemaining = null;
    } else if (status === 'concluido') {
      metaPatch.maintenanceNextDateOverride = undefined;
      if (this.meta()?.maintenanceAlertByKm === true) {
        metaPatch.maintenanceTripKmAtLastService = tripKmNow ?? 0;
      }
    }

    if (status === 'concluido') {
      metaPatch.lastMaintenanceDate = date;
      metaPatch.lastMaintenanceType = this.maintTypeLabel(this.newMaintType());
      if (cost !== undefined) {
        metaPatch.lastMaintenanceCost = cost;
      }
      const notes = this.newMaintNotes().trim();
      metaPatch.lastMaintenanceNotes = notes || undefined;
    }

    if (Object.keys(metaPatch).length > 0) {
      this.metaOverride.update((p) => ({ ...p, ...metaPatch }));
    }

    const docs = this.newMaintFiles().map((f) => f.name);
    const entry: MaintenanceEntry = {
      date,
      type: this.maintTypeLabel(this.newMaintType()),
      cost: cost === undefined ? undefined : cost,
      notes: this.newMaintNotes().trim() || undefined,
      documentNames: docs.length > 0 ? docs : undefined,
      status: this.newMaintStatus(),
    };
    this.localMaintEntries.update((prev) => [...prev, entry]);
    this.addingMaint.set(false);
    this.resetNewMaintForm();
    this.persistCurrentEquipment('Mantenimiento agregado.', { fleetMeta: metaPatch });
  }

  statusBadgeLabel(s: MaintenanceEntryStatus | undefined): string {
    if (s === 'programado') {
      return 'Programado';
    }
    if (s === 'concluido') {
      return 'Concluido';
    }
    return '';
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
  readonly editStatus = signal('available');

  readonly brandOptions = TRAILER_BRAND_OPTIONS;
  readonly operationTypeOptions = EQUIPMENT_OPERATION_TYPE_OPTIONS;
  readonly containerSlotOptions = EQUIPMENT_CONTAINER_SLOT_OPTIONS;

  readonly modelYearOptions = buildFleetModelYearSelectOptions();
  readonly statusOptions = FLEET_UNIT_STATUS_OPTIONS;

  startEditId(): void {
    this.requestFocusDetailTab('ficha');
    this.clearStagedDocUploads();
    const e = this.effEquipment();
    const m = e.fleetMeta ?? {};
    this.editSerialNumber.set(e.serialNumber?.trim() || '');
    this.editName.set(e.name?.trim() || '');
    this.editBrand.set(e.trailerBrandAbbr?.trim() || '');
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
    this.editStatus.set((e.status || 'available').trim());
    this.editingSection.set('id');
  }
  saveEditId(): void {
    const serial = this.editSerialNumber().trim();
    const typeVal = this.editType().trim();
    if (!serial || !typeVal) {
      this.toast.show('Número de serie y tipo de unidad son obligatorios.', 'warning');
      return;
    }
    const brandLabel =
      this.brandOptions.find((o) => o.value === this.editBrand())?.label ||
      this.editBrand().trim() ||
      undefined;
    const plate = this.editPlate().trim() || undefined;
    const equipmentDraft: Partial<Equipment> = {
      serialNumber: serial,
      name: this.editName().trim(),
      plate,
      type: this.operationTypeLabel(typeVal),
      status: this.editStatus(),
      trailerBrandAbbr: this.editBrand().trim() || undefined,
      trailerYear: this.editYear().trim() || undefined,
    };
    const fleetMetaDraft: Partial<EquipmentFleetMeta> = {
      trailerBrandName: brandLabel,
      trailerVersion: this.editVersion().trim() || undefined,
      trailerColor: this.editColor().trim() || undefined,
    };
    this.equipmentOverride.update((prev) => ({ ...prev, ...equipmentDraft }));
    this.metaOverride.update((prev) => ({ ...prev, ...fleetMetaDraft }));
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
  readonly editTechTires = signal('');
  readonly editTechSlot = signal('');

  startEditTech(): void {
    this.requestFocusDetailTab('ficha');
    this.clearStagedDocUploads();
    const m = this.meta() ?? {};
    this.editTechCapacityTons.set(m.equipmentCapacityTons?.trim() ?? '');
    this.editTechAxles.set(
      m.equipmentAxleCount != null ? String(m.equipmentAxleCount) : '',
    );
    this.editTechTires.set(
      m.equipmentTireCount != null ? String(m.equipmentTireCount) : '',
    );
    const raw = m.equipmentContainerSlotConfig?.trim() ?? '';
    this.editTechSlot.set(
      fleetValueFromLabel(this.containerSlotOptions, raw) ||
        this.containerSlotOptions.find((o) => o.value === raw)?.value ||
        '',
    );
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
    const tiresParsed = parseFleetOptionalPositiveInt(this.editTechTires());
    if (tiresParsed === 'invalid') {
      this.toast.show('Número de llantas debe ser un entero mayor que cero.', 'warning');
      return;
    }
    const slotVal = this.editTechSlot().trim();
    const slotLabel =
      this.containerSlotOptions.find((o) => o.value === slotVal)?.label ??
      (slotVal || undefined);
    const fleetMetaDraft: Partial<EquipmentFleetMeta> = {
      equipmentCapacityTons: tonsRaw || undefined,
      equipmentAxleCount: axlesParsed === undefined ? undefined : axlesParsed,
      equipmentTireCount: tiresParsed === undefined ? undefined : tiresParsed,
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
    const name = e.fleetMeta?.trailerBrandName?.trim();
    if (name) {
      return name;
    }
    const abbr = e.trailerBrandAbbr?.trim();
    if (!abbr) {
      return '—';
    }
    return TRAILER_BRAND_OPTIONS.find((o) => o.value === abbr)?.label ?? abbr;
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
    const raw = this.meta()?.equipmentContainerSlotConfig?.trim();
    if (!raw) {
      return '—';
    }
    const byVal = EQUIPMENT_CONTAINER_SLOT_OPTIONS.find((o) => o.value === raw);
    if (byVal) {
      return byVal.label;
    }
    const byLab = EQUIPMENT_CONTAINER_SLOT_OPTIONS.find(
      (o) => o.label.trim().toLowerCase() === raw.toLowerCase(),
    );
    if (byLab) {
      return byLab.label;
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

  completedTripDistanceKmLabel(): string {
    const v = this.uiTractorTripKm();
    if (v == null || !Number.isFinite(v) || v <= 0) {
      return '—';
    }
    return `${new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    }).format(v)} km`;
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

  maintenanceAlertUsesKm(): boolean {
    if (this.companyKmMaintControlActive()) {
      return true;
    }
    return this.meta()?.maintenanceAlertByKm === true;
  }

  canToggleMaintenanceAlertMode(): boolean {
    return !this.companyKmMaintControlActive();
  }

  canEditMaintNextDate(): boolean {
    return !this.companyDateMaintControlActive();
  }

  toggleMaintenanceAlertMode(): void {
    if (!this.canToggleMaintenanceAlertMode()) {
      this.toast.show(
        'El intervalo por kilómetros está definido en Configuración operativa.',
        'info',
      );
      return;
    }
    const next = !this.maintenanceAlertUsesKm();
    const fleetMetaDraft: Partial<EquipmentFleetMeta> = { maintenanceAlertByKm: next };
    this.metaOverride.update((p) => ({ ...p, ...fleetMetaDraft }));
    this.persistCurrentEquipment(
      next
        ? 'Alerta de mantenimiento por kilómetros activada.'
        : 'Alerta de mantenimiento por calendario activada.',
      { fleetMeta: fleetMetaDraft },
    );
  }

  maintenanceKmRemainingDisplay(): string {
    const raw = fleetMaintenanceKmRemaining(
      this.meta(),
      this.uiTractorTripKm(),
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
      this.meta(),
      this.uiTractorTripKm(),
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
    if (!this.canToggleMaintenanceAlertMode()) {
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
    const n = parseFleetPositiveKm(this.editMaintKmIntervalStr());
    if (n === 'invalid') {
      this.toast.show(
        'Indica un intervalo en kilómetros mayor a cero (ej. 1000 o 1500).',
        'warning',
      );
      return;
    }
    const fleetMetaDraft: Partial<EquipmentFleetMeta> = {
      maintenanceKmInterval: n,
      maintenanceKmRemaining: null,
    };
    this.metaOverride.update((p) => ({ ...p, ...fleetMetaDraft }));
    this.cancelEditMaintKmInterval();
    this.persistCurrentEquipment('Intervalo por kilómetros actualizado.', {
      fleetMeta: fleetMetaDraft,
    });
  }

  insNext(): string {
    return nextInsuranceTableDate(this.meta()) ?? '—';
  }

  maintenanceEntries(): MaintenanceEntry[] {
    const m = this.meta();
    const local = this.localMaintEntries();
    let base: MaintenanceEntry[] = [];
    if (m) {
      const explicit = m.maintenanceEntries ?? [];
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
        const hasData = !!(
          fallback.date ||
          fallback.type ||
          fallback.cost !== undefined ||
          fallback.notes ||
          (fallback.documentNames && fallback.documentNames.length > 0)
        );
        if (hasData) {
          base = [fallback];
        }
      }
    }
    return [...base, ...local].sort((a, b) =>
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
    return fleetMaintenanceRenewal(
      this.meta(),
      this.uiTractorTripKm(),
      this.companyMaintPolicy(),
    );
  }

  insRenewalBucket(): FleetRenewalBucket {
    return fleetInsuranceRenewal(this.meta());
  }

  constructor() {
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

    registerFleetHitchSecondTrailerSync({
      isActive: () => this.editingSection() === 'hitch',
      validation: () => this.editHitchValidation(),
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
  }
}
