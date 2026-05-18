import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { EQUIPMENT_CONTAINER_SLOT_OPTIONS } from '@app/mock-data/equipment-container-slot-options';
import { EQUIPMENT_OPERATION_TYPE_OPTIONS } from '@app/mock-data/equipment-operation-type-options';
import { TRAILER_BRAND_OPTIONS } from '@app/mock-data/trailer-brands';
import { formatEquipmentOperationalId } from '@app/sim-db/utils/fleet-id-builders';
import { formatUnitTrailerOperationalId } from '@app/sim-db/utils/unit-label';
import { ToastService } from '@core/notifications/toast.service';
import { SimulatedDbService } from '@app/sim-db/simulated-db.service';
import {
  FleetRenewalBucket,
  equipmentPhysMechTwoYearExemptionEnd,
  equipmentPhysMechVerificationBucket,
  equipmentPhysMechVerificationTooltip,
  fleetInsuranceRenewal,
  fleetMaintenanceKmRemaining,
  fleetOperationalKeyLabel,
  formatFleetYmdMx,
  nextCycleFormatted,
  nextEquipmentPhysMechTableDate,
  nextInsuranceTableDate,
  nextMaintenanceDueIso,
  nextMaintenanceTableDate,
  operationalKeyEquipment,
  renewalBucket,
  renewalBucketFromTargetYmd,
} from '@app/features/fleet/utils/fleet-unit-table-row';
import { downloadMockFleetDocument } from '@app/features/fleet/utils/fleet-mock-document-download';
import {
  trackFileEntry,
  trackMaintenanceEntry,
  trackStringEntry,
} from '@features/fleet/utils/list-trackers';
import { FLEET_UNIT_DETAIL_TAB_SYMBOLS } from '@app/features/fleet/utils/fleet-unit-detail-tab-symbols';
import {
  Equipment,
  EquipmentFleetMeta,
  MaintenanceEntry,
  MaintenanceEntryStatus,
  TrailerTenureMode,
  Unit,
} from '@shared/models/logistics.models';
import { ToDrawerSkeletonComponent } from '@shared/ui/to-drawer-skeleton/to-drawer-skeleton.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
  ToSelectOption,
} from '@shared/ui/to-select/to-select.component';
import { ToTextareaComponent } from '@shared/ui/to-textarea/to-textarea.component';
import {
  buildFleetModelYearSelectOptions,
  FLEET_MAINT_SCHEDULE_NEXT_MODE_OPTIONS,
  FLEET_MAINTENANCE_ENTRY_STATUS_OPTIONS,
  FLEET_MAINTENANCE_TYPE_OPTIONS,
  FLEET_PAYMENT_CADENCE_OPTIONS,
  FLEET_TRAILER_TENURE_OPTIONS,
  FLEET_UNIT_STATUS_OPTIONS,
} from '@shared/catalogs/fleet-form-options';

const MAINT_MO = 6;
const VERIF_MO = 6;

type EquipmentDetailDrawerTab = 'ficha' | 'mant' | 'cob';

function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function parseOptionalAmount(raw: string): number | undefined | 'invalid' {
  const t = raw.trim().replace(/\s/g, '').replace(/,/g, '');
  if (t === '') {
    return undefined;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    return 'invalid';
  }
  return n;
}

function parseOptionalPositiveInt(raw: string): number | undefined | 'invalid' {
  const t = raw.trim();
  if (t === '') {
    return undefined;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return 'invalid';
  }
  return n;
}

function parsePositiveKm(raw: string): number | 'invalid' {
  const t = raw.trim().replace(/\s/g, '').replace(/,/g, '');
  if (t === '') {
    return 'invalid';
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) {
    return 'invalid';
  }
  return n;
}

/** Encuentra el value de un option a partir de su label (case-insensitive). */
function valueFromLabel(opts: ToSelectOption[], label: string | undefined): string {
  if (!label) {
    return '';
  }
  const t = label.trim().toLowerCase();
  return opts.find((o) => o.label.trim().toLowerCase() === t)?.value ?? '';
}

@Component({
  selector: 'app-fleet-equipment-detail-drawer',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ToIconButtonComponent,
    ToButtonComponent,
    ToInputComponent,
    ToSelectComponent,
    ToTextareaComponent,
    ToDrawerSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-equipment-detail-drawer.component.html',
  styleUrls: [
    '../fleet-drawer.shared.scss',
    '../styles/fleet-drawer-unit-sec.shared.scss',
    '../fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    '../fleet-unit-detail-drawer/fleet-unit-detail-drawer-tables.scss',
  ],
})
export class FleetEquipmentDetailDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly simDb = inject(SimulatedDbService);

  readonly equipment = input.required<Equipment>();
  /** Opciones de unidad tractora (mismo catálogo que alta de equipo). */
  readonly unitOptions = input<ToSelectOption[]>([]);
  /** Catálogo de tractoras para resolver enganche en ficha técnica. */
  readonly unitCatalog = input<Unit[]>([]);
  /** Maniobra en curso del enganche (`unitId`), misma regla que la tabla Flota. */
  readonly onRoute = input(false);
  /** Maniobras completadas de la unidad tractora (para contexto de km). */
  readonly completedManeuverCount = input(0);

  readonly formatYmd = formatFleetYmdMx;

  readonly trackFileEntry = trackFileEntry;
  readonly trackStringEntry = trackStringEntry;
  readonly trackMaintenanceEntry = trackMaintenanceEntry;

  readonly detailTabSymbols = FLEET_UNIT_DETAIL_TAB_SYMBOLS;

  readonly detailTab = signal<EquipmentDetailDrawerTab>('mant');

  /** Registro inline de verificación físico-mecánica (equipo; no aplica emisiones). */
  readonly verifEntryKind = signal<'phys' | null>(null);
  readonly newPhysVerifDate = signal('');
  readonly newPhysVerifCost = signal('');

  readonly dismiss = output<void>();
  readonly drawerLoading = signal(true);

  private readonly equipmentOverride = signal<Partial<Equipment>>({});
  private readonly metaOverride = signal<Partial<EquipmentFleetMeta>>({});

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

  /**
   * Km acumulados del tractor (maniobras completadas), inyectados por la página
   * de flota en `equipment.uiTractorCompletedTripDistanceKm`.
   */
  private uiTractorTripKm(): number | null {
    const v = this.effEquipment().uiTractorCompletedTripDistanceKm;
    if (v == null || !Number.isFinite(v)) {
      return null;
    }
    return v;
  }

  readonly editingSection = signal<
    'id' | 'tenure' | 'tech' | 'insurance' | null
  >(null);

  isEditing(section: 'id' | 'tenure' | 'tech' | 'insurance'): boolean {
    return this.editingSection() === section;
  }

  readonly equipmentOperationalTitle = computed(() =>
    formatEquipmentOperationalId(this.effEquipment()),
  );

  readonly unitLabel = computed(() => {
    const id = this.effEquipment().unitId?.trim();
    if (!id) {
      return '—';
    }
    const opt = this.unitOptions().find((o) => o.value === id);
    return opt?.label ?? this.simDb.labelForUnitId(id);
  });

  readonly assignedTractor = computed(() => {
    const id = this.effEquipment().unitId?.trim();
    if (!id) {
      return null;
    }
    return this.unitCatalog().find((u) => u.id === id) ?? null;
  });

  readonly hitchAssignmentAvailable = computed(
    () => !this.effEquipment().unitId?.trim(),
  );

  readonly hitchTractorOperationalId = computed(() => {
    const u = this.assignedTractor();
    return u ? formatUnitTrailerOperationalId(u) : '—';
  });

  readonly hitchTractorPlate = computed(() => {
    const u = this.assignedTractor();
    return u?.plate?.trim() || '—';
  });

  // -- Identificación: form signals --
  readonly editUnitId = signal('');
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
    this.focusDetailTab('ficha');
    this.clearStagedDocUploads();
    const e = this.effEquipment();
    const m = e.fleetMeta ?? {};
    this.editUnitId.set(e.unitId?.trim() || '');
    this.editSerialNumber.set(e.serialNumber?.trim() || '');
    this.editName.set(e.name?.trim() || '');
    this.editBrand.set(e.trailerBrandAbbr?.trim() || '');
    this.editYear.set(e.trailerYear?.trim() || '');
    this.editVersion.set(m.trailerVersion?.trim() || '');
    const typeRaw = e.type?.trim() || '';
    this.editType.set(
      EQUIPMENT_OPERATION_TYPE_OPTIONS.some((o) => o.value === typeRaw)
        ? typeRaw
        : valueFromLabel(EQUIPMENT_OPERATION_TYPE_OPTIONS, typeRaw) || typeRaw,
    );
    this.editPlate.set(e.plate?.trim() || '');
    this.editColor.set(m.trailerColor?.trim() || '');
    this.editStatus.set((e.status || 'available').trim());
    this.editingSection.set('id');
  }

  cancelEdit(): void {
    this.clearStagedDocUploads();
    this.editingSection.set(null);
  }

  selectDetailTab(tab: EquipmentDetailDrawerTab): void {
    this.focusDetailTab(tab);
  }

  /** Cambia de pestaña y limpia edición / formularios al salir. */
  private focusDetailTab(tab: EquipmentDetailDrawerTab): void {
    if (this.detailTab() === tab) {
      return;
    }
    this.cancelEdit();
    this.cancelMaintScheduleEdits();
    this.cancelPhysVerifEntry();
    this.addingMaint.set(false);
    this.resetNewMaintForm();
    this.detailTab.set(tab);
  }

  private clearStagedDocUploads(): void {
    this.editOwnershipNewFiles.set([]);
    this.editPolicyNewFiles.set([]);
  }

  saveEditId(): void {
    const unitId = this.editUnitId().trim();
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
    this.equipmentOverride.update((prev) => ({
      ...prev,
      unitId: unitId || '',
      serialNumber: serial,
      name: this.editName().trim(),
      plate,
      type: typeVal,
      status: this.editStatus(),
      trailerBrandAbbr: this.editBrand().trim() || undefined,
      trailerYear: this.editYear().trim() || undefined,
    }));
    this.metaOverride.update((prev) => ({
      ...prev,
      trailerBrandName: brandLabel,
      trailerVersion: this.editVersion().trim() || undefined,
      trailerColor: this.editColor().trim() || undefined,
    }));
    this.toast.show('Identificación actualizada.', 'success');
    this.editingSection.set(null);
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
    this.focusDetailTab('ficha');
    this.clearStagedDocUploads();
    const m = this.meta() ?? {};
    this.editTenureMode.set(m.trailerTenureMode ?? 'owned');
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

  saveEditTenure(): void {
    const mode = this.editTenureMode();
    const commercial = parseOptionalAmount(this.editCommercialValue());
    const recAmt = parseOptionalAmount(this.editRecurringAmount());
    const recCount = parseOptionalPositiveInt(this.editRecurringInstallments());
    const payout = parseOptionalAmount(this.editOwnerPayout());
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
    this.metaOverride.update((prev) => ({
      ...prev,
      trailerTenureMode: mode,
      trailerCommercialValue,
      trailerRecurringPaymentAmount,
      trailerRecurringPaymentDate,
      trailerRecurringInstallmentCount,
      trailerManagementOwnerPayout,
      documentOwnershipNames,
    }));
    this.editOwnershipNewFiles.set([]);
    this.toast.show('Propiedad y tenencia actualizadas.', 'success');
    this.editingSection.set(null);
  }

  // -- Ficha técnica --
  readonly editTechCapacityTons = signal('');
  readonly editTechAxles = signal('');
  readonly editTechTires = signal('');
  readonly editTechSlot = signal('');

  startEditTech(): void {
    this.focusDetailTab('ficha');
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
      valueFromLabel(this.containerSlotOptions, raw) ||
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
    const axlesParsed = parseOptionalPositiveInt(this.editTechAxles());
    if (axlesParsed === 'invalid') {
      this.toast.show('Número de ejes debe ser un entero mayor que cero.', 'warning');
      return;
    }
    const tiresParsed = parseOptionalPositiveInt(this.editTechTires());
    if (tiresParsed === 'invalid') {
      this.toast.show('Número de llantas debe ser un entero mayor que cero.', 'warning');
      return;
    }
    const slotVal = this.editTechSlot().trim();
    const slotLabel =
      this.containerSlotOptions.find((o) => o.value === slotVal)?.label ??
      (slotVal || undefined);
    this.metaOverride.update((prev) => ({
      ...prev,
      equipmentCapacityTons: tonsRaw || undefined,
      equipmentAxleCount: axlesParsed === undefined ? undefined : axlesParsed,
      equipmentTireCount: tiresParsed === undefined ? undefined : tiresParsed,
      equipmentContainerSlotConfig: slotLabel,
    }));
    this.toast.show('Ficha técnica actualizada.', 'success');
    this.editingSection.set(null);
  }

  // -- Seguro: form signals --
  readonly editInsPolicyNumber = signal('');
  readonly editInsContractDate = signal('');
  readonly editInsCadence = signal('');
  readonly editInsCost = signal('');
  /** Póliza y comprobantes (copia editable al abrir seguro). */
  readonly editPolicyNames = signal<string[]>([]);
  readonly editPolicyNewFiles = signal<File[]>([]);

  readonly cadenceOptions = FLEET_PAYMENT_CADENCE_OPTIONS;

  startEditInsurance(): void {
    this.focusDetailTab('cob');
    this.clearStagedDocUploads();
    const m = this.meta() ?? {};
    this.editInsPolicyNumber.set(m.insurancePolicyNumber?.trim() || '');
    this.editInsContractDate.set(m.insuranceContractDate ?? '');
    this.editInsCadence.set(
      valueFromLabel(this.cadenceOptions, m.insurancePaymentCadence) ||
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
    const cost = parseOptionalAmount(this.editInsCost());
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
    this.metaOverride.update((prev) => ({
      ...prev,
      insurancePolicyNumber: this.editInsPolicyNumber().trim() || undefined,
      insuranceContractDate: this.editInsContractDate().trim() || undefined,
      insurancePaymentCadence: cadenceLabel,
      insuranceCost: cost === undefined ? undefined : cost,
      documentPolicyNames,
    }));
    this.editPolicyNewFiles.set([]);
    this.toast.show('Seguro actualizado.', 'success');
    this.editingSection.set(null);
  }

  private readonly localMaintEntries = signal<MaintenanceEntry[]>([]);

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

  readonly today = todayIso();

  readonly newMaintMinDate = computed(() =>
    this.newMaintStatus() === 'programado' ? this.today : undefined,
  );
  readonly newMaintMaxDate = computed(() =>
    this.newMaintStatus() === 'concluido' ? this.today : undefined,
  );

  constructor() {
    this.doc.body.style.overflow = 'hidden';
    this.destroyRef.onDestroy(() => {
      this.doc.body.style.overflow = '';
    });

    let priorEquipmentId = '';
    effect(() => {
      const id = this.equipment().id;
      if (priorEquipmentId !== '' && priorEquipmentId !== id) {
        this.equipmentOverride.set({});
        this.metaOverride.set({});
        this.editingSection.set(null);
        this.addingMaint.set(false);
        this.localMaintEntries.set([]);
        this.resetNewMaintForm();
        this.cancelMaintScheduleEdits();
        this.cancelPhysVerifEntry();
        this.detailTab.set('mant');
      }
      priorEquipmentId = id;
    });

    afterNextRender(() => this.drawerLoading.set(false));
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }

  meta(): EquipmentFleetMeta | undefined {
    return this.effEquipment().fleetMeta;
  }

  tenureModeLabel(mode: TrailerTenureMode | undefined): string {
    switch (mode) {
      case 'owned':
        return 'Propio';
      case 'financed':
        return 'Financiado';
      case 'leased':
        return 'Arrendado';
      case 'managed':
        return 'Administrado';
      default:
        return '—';
    }
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
    return nextMaintenanceTableDate(this.meta()) ?? '—';
  }

  maintenanceAlertUsesKm(): boolean {
    return this.meta()?.maintenanceAlertByKm === true;
  }

  toggleMaintenanceAlertMode(): void {
    const next = !this.maintenanceAlertUsesKm();
    this.metaOverride.update((p) => ({
      ...p,
      maintenanceAlertByKm: next,
    }));
  }

  maintenanceKmRemainingDisplay(): string {
    const raw = fleetMaintenanceKmRemaining(
      this.meta(),
      this.uiTractorTripKm(),
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

  private cancelMaintScheduleEdits(): void {
    this.editingMaintNextDate.set(false);
    this.editingMaintKmInterval.set(false);
    this.editMaintNextDate.set('');
    this.editMaintKmIntervalStr.set('');
  }

  startEditMaintNextDate(): void {
    this.editMaintNextDate.set(nextMaintenanceDueIso(this.meta()) ?? '');
    this.editingMaintNextDate.set(true);
  }

  cancelEditMaintNextDate(): void {
    this.editingMaintNextDate.set(false);
    this.editMaintNextDate.set('');
  }

  saveEditMaintNextDate(): void {
    const raw = this.editMaintNextDate().trim();
    if (!raw) {
      this.metaOverride.update((p) => ({
        ...p,
        maintenanceNextDateOverride: undefined,
      }));
      this.toast.show(
        'Se quitó la fecha manual; se usará el ciclo sugerido desde el último servicio.',
        'success',
      );
      this.cancelEditMaintNextDate();
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw < this.today) {
      this.toast.show(
        'Indica una fecha válida (hoy o futura) en formato año-mes-día.',
        'warning',
      );
      return;
    }
    this.metaOverride.update((p) => ({
      ...p,
      maintenanceNextDateOverride: raw,
    }));
    this.toast.show('Fecha de próximo mantenimiento guardada.', 'success');
    this.cancelEditMaintNextDate();
  }

  startEditMaintKmInterval(): void {
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
    const n = parsePositiveKm(this.editMaintKmIntervalStr());
    if (n === 'invalid') {
      this.toast.show(
        'Indica un intervalo en kilómetros mayor a cero (ej. 1000 o 1500).',
        'warning',
      );
      return;
    }
    this.metaOverride.update((p) => ({
      ...p,
      maintenanceKmInterval: n,
      maintenanceKmRemaining: null,
    }));
    this.toast.show('Intervalo por kilómetros actualizado.', 'success');
    this.cancelEditMaintKmInterval();
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

  private maintTypeLabel(value: string): string {
    return (
      this.newMaintTypeOptions.find((o) => o.value === value)?.label ?? value
    );
  }

  openNewMaint(): void {
    this.cancelMaintScheduleEdits();
    this.focusDetailTab('mant');
    this.resetNewMaintForm();
    this.addingMaint.set(true);
  }

  cancelNewMaint(): void {
    this.addingMaint.set(false);
    this.resetNewMaintForm();
  }

  private resetNewMaintForm(): void {
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
    const cost = parseOptionalAmount(this.newMaintCost());
    if (cost === 'invalid') {
      this.toast.show(
        'El costo debe ser un número válido (≥ 0) o dejarse vacío.',
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
      const km = parsePositiveKm(this.newMaintNextKmInterval());
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
    const status = this.newMaintStatus();

    if (hasScheduleTiempo) {
      metaPatch.maintenanceNextDateOverride = this.newMaintNextDate().trim();
      metaPatch.maintenanceAlertByKm = false;
      metaPatch.maintenanceKmInterval = undefined;
      metaPatch.maintenanceTripKmAtLastService = undefined;
      metaPatch.maintenanceKmRemaining = null;
    } else if (hasScheduleKm) {
      const km = parsePositiveKm(this.newMaintNextKmInterval());
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
    this.toast.show('Mantenimiento agregado.', 'success');
    this.addingMaint.set(false);
    this.resetNewMaintForm();
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

  downloadStoredDocument(fileName: string): void {
    downloadMockFleetDocument(this.doc, fileName);
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
    const cost = parseOptionalAmount(this.newPhysVerifCost());
    if (cost === 'invalid') {
      this.toast.show('El costo debe ser un número válido (≥ 0).', 'warning');
      return;
    }
    this.metaOverride.update((prev) => ({
      ...prev,
      verificationPhysMechDate: date,
      verificationPhysMechCost: cost === undefined ? undefined : cost,
    }));
    this.toast.show('Verificación físico-mecánica registrada.', 'success');
    this.cancelPhysVerifEntry();
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
    if (this.maintenanceAlertUsesKm()) {
      return this.maintKmRenewalBucket();
    }
    const m = this.meta();
    const override = m?.maintenanceNextDateOverride?.trim();
    if (override) {
      return renewalBucketFromTargetYmd(override);
    }
    return renewalBucket(m?.lastMaintenanceDate, MAINT_MO);
  }

  insRenewalBucket(): FleetRenewalBucket {
    return fleetInsuranceRenewal(this.meta());
  }
}
