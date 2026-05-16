import { DecimalPipe, DOCUMENT, NgTemplateOutlet } from '@angular/common';
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
import { TRAILER_BRAND_OPTIONS } from '@app/mock-data/trailer-brands';
import { ToastService } from '@core/notifications/toast.service';
import { formatUnitTrailerOperationalId } from '@app/sim-db/utils/unit-label';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';
import {
  FleetRenewalBucket,
  fleetGpsRenewal,
  fleetInsuranceRenewal,
  fleetMaintenanceKmRemaining,
  formatFleetYmdMx,
  nextGpsTableDate,
  nextInsuranceTableDate,
  nextMaintenanceDueIso,
  nextMaintenanceTableDate,
  nextCycleFormatted,
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
  MaintenanceEntry,
  MaintenanceEntryStatus,
  TrailerTenureMode,
  Unit,
  UnitFleetMeta,
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
  FLEET_TRANSMISSION_SPEED_OPTIONS,
  FLEET_TRANSMISSION_TYPE_OPTIONS,
  FLEET_UNIT_STATUS_OPTIONS,
} from '@shared/catalogs/fleet-form-options';

const VERIF_MO = 6;
const MAINT_MO = 6;

type UnitDetailDrawerTab = 'ficha' | 'mant' | 'cob';

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

/** Encuentra el value de un option a partir de su label (case-insensitive). */
function valueFromLabel(opts: ToSelectOption[], label: string | undefined): string {
  if (!label) {
    return '';
  }
  const t = label.trim().toLowerCase();
  return opts.find((o) => o.label.trim().toLowerCase() === t)?.value ?? '';
}

@Component({
  selector: 'app-fleet-unit-detail-drawer',
  standalone: true,
  imports: [
    DecimalPipe,
    NgTemplateOutlet,
    ToIconButtonComponent,
    ToButtonComponent,
    ToInputComponent,
    ToSelectComponent,
    ToTextareaComponent,
    ToDrawerSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-unit-detail-drawer.component.html',
  styleUrls: [
    '../fleet-drawer.shared.scss',
    '../styles/fleet-drawer-unit-sec.shared.scss',
    './fleet-unit-detail-drawer-panel.scss',
    './fleet-unit-detail-drawer-tables.scss',
  ],
})
export class FleetUnitDetailDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  readonly unit = input.required<Unit>();
  /** Si hay maniobra `in_transit` para esta unidad. */
  readonly onRoute = input(false);
  /** Maniobras con estado `completed` asignadas a esta unidad (última carga en flota). */
  readonly completedManeuverCount = input(0);
  /**
   * Suma de `routeDistanceKm` en maniobras completadas para esta unidad.
   * `null` si no hay km registrados en esas maniobras.
   */
  readonly completedTripDistanceKm = input<number | null>(null);

  readonly verifCycleMo = VERIF_MO;

  /** Expuesto a la plantilla (no se pueden importar funciones sueltas en el HTML). */
  readonly formatYmd = formatFleetYmdMx;

  readonly trackFileEntry = trackFileEntry;
  readonly trackStringEntry = trackStringEntry;
  readonly trackMaintenanceEntry = trackMaintenanceEntry;

  /** Iconos de pestañas (Material Symbols, estilo tablero). */
  readonly detailTabSymbols = FLEET_UNIT_DETAIL_TAB_SYMBOLS;

  readonly dismiss = output<void>();
  readonly drawerLoading = signal(true);

  /** Overrides locales durante la sesión (mock; reemplazar con persistencia real). */
  private readonly unitOverride = signal<Partial<Unit>>({});
  private readonly metaOverride = signal<Partial<UnitFleetMeta>>({});

  /** Unit efectiva: base + cambios locales aplicados. */
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

  /** Sección abierta en modo edición. `null` = solo lectura. */
  readonly editingSection = signal<
    'id' | 'tenure' | 'cap' | 'maint' | 'verif' | 'insurance' | 'gps' | null
  >(null);

  readonly detailTab = signal<UnitDetailDrawerTab>('mant');

  isEditing(
    section: 'id' | 'tenure' | 'cap' | 'maint' | 'verif' | 'insurance' | 'gps',
  ): boolean {
    return this.editingSection() === section;
  }

  /** Verificación cuyo registro inline está abierto. */
  readonly verifEntryKind = signal<'phys' | 'emis' | 'double' | null>(null);
  readonly newVerifDate = signal('');
  readonly newVerifCost = signal('');

  isVerifEntryOpen(kind: 'phys' | 'emis' | 'double'): boolean {
    return this.verifEntryKind() === kind;
  }

  startVerifEntry(kind: 'phys' | 'emis' | 'double'): void {
    this.newVerifDate.set('');
    this.newVerifCost.set('');
    this.verifEntryKind.set(kind);
  }

  cancelVerifEntry(): void {
    this.verifEntryKind.set(null);
    this.newVerifDate.set('');
    this.newVerifCost.set('');
  }

  saveVerifEntry(): void {
    const kind = this.verifEntryKind();
    if (!kind) {
      return;
    }
    const date = this.newVerifDate().trim();
    if (!date) {
      this.toast.show('Indica la fecha de la nueva verificación.', 'warning');
      return;
    }
    if (date > this.today) {
      this.toast.show('La fecha no puede ser futura.', 'warning');
      return;
    }
    const cost = parseOptionalAmount(this.newVerifCost());
    if (cost === 'invalid') {
      this.toast.show('El costo debe ser un número válido (≥ 0).', 'warning');
      return;
    }
    const patch: Partial<UnitFleetMeta> = {};
    if (kind === 'phys') {
      patch.verificationPhysMechDate = date;
      patch.verificationPhysMechCost = cost === undefined ? undefined : cost;
    } else if (kind === 'emis') {
      patch.verificationEmissionsDate = date;
      patch.verificationEmissionsCost = cost === undefined ? undefined : cost;
    } else {
      patch.verificationDoubleArticulatedApplies = true;
      patch.verificationDoubleArticulatedDate = date;
      patch.verificationDoubleArticulatedCost = cost === undefined ? undefined : cost;
    }
    this.metaOverride.update((prev) => ({ ...prev, ...patch }));
    this.toast.show('Verificación registrada.', 'success');
    this.cancelVerifEntry();
  }

  // -- Identificación: form signals --
  readonly editBrand = signal('');
  readonly editYear = signal('');
  readonly editVersion = signal('');
  readonly editType = signal('');
  readonly editPlate = signal('');
  readonly editColor = signal('');
  readonly editStatus = signal('available');
  readonly editSerial = signal('');
  readonly editAlias = signal('');

  readonly brandOptions = TRAILER_BRAND_OPTIONS;
  readonly modelYearOptions = buildFleetModelYearSelectOptions();
  readonly statusOptions = FLEET_UNIT_STATUS_OPTIONS;

  startEditId(): void {
    this.focusDetailTab('ficha');
    this.clearStagedDocUploads();
    const u = this.effUnit();
    const m = u.fleetMeta ?? {};
    this.editBrand.set(u.trailerBrandAbbr?.trim() || '');
    this.editYear.set(u.trailerYear?.trim() || '');
    this.editVersion.set(m.trailerVersion?.trim() || '');
    this.editType.set(u.type ?? '');
    this.editPlate.set(u.plate ?? '');
    this.editColor.set(m.trailerColor?.trim() || '');
    this.editStatus.set((u.status || 'available').trim());
    this.editSerial.set(u.serialNumber?.trim() || '');
    this.editAlias.set(u.name?.trim() || '');
    this.editingSection.set('id');
  }

  cancelEdit(): void {
    this.clearStagedDocUploads();
    this.editingSection.set(null);
  }

  selectDetailTab(tab: UnitDetailDrawerTab): void {
    this.focusDetailTab(tab);
  }

  /** Cambia de pestaña y limpia edición / formularios inline al salir de una pestaña. */
  private focusDetailTab(tab: UnitDetailDrawerTab): void {
    if (this.detailTab() === tab) {
      return;
    }
    this.cancelEdit();
    this.cancelVerifEntry();
    this.cancelMaintScheduleEdits();
    this.addingMaint.set(false);
    this.resetNewMaintForm();
    this.detailTab.set(tab);
  }

  private cancelMaintScheduleEdits(): void {
    this.editingMaintNextDate.set(false);
    this.editingMaintKmInterval.set(false);
    this.editMaintNextDate.set('');
    this.editMaintKmIntervalStr.set('');
  }

  private clearStagedDocUploads(): void {
    this.editOwnershipNewFiles.set([]);
    this.editPolicyNewFiles.set([]);
    this.editVerifNewFiles.set([]);
  }

  saveEditId(): void {
    const plate = this.editPlate().trim();
    const type = this.editType().trim();
    if (!plate || !type) {
      this.toast.show('Placa y tipo son obligatorios.', 'warning');
      return;
    }
    const brandLabel =
      this.brandOptions.find((o) => o.value === this.editBrand())?.label ||
      this.editBrand().trim() ||
      undefined;
    this.unitOverride.update((prev) => ({
      ...prev,
      plate,
      type,
      status: this.editStatus(),
      trailerBrandAbbr: this.editBrand().trim() || undefined,
      trailerYear: this.editYear().trim() || undefined,
      serialNumber: this.editSerial().trim() || undefined,
      name: this.editAlias().trim() || undefined,
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

  // -- Tren motriz y capacidad: form signals --
  readonly editTransmissionType = signal('');
  readonly editTransmissionSpeeds = signal('');
  readonly editGvwrLb = signal('');
  readonly editOdometerKm = signal('');

  readonly transmissionOptions = FLEET_TRANSMISSION_TYPE_OPTIONS;

  readonly speedOptions = FLEET_TRANSMISSION_SPEED_OPTIONS;

  /** Capacidad derivada del GVWR mientras se edita (kg). */
  readonly editCapacityPreviewKg = computed<number | null>(() => {
    const raw = this.editGvwrLb().trim().replace(/,/g, '');
    if (!raw) {
      return null;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      return null;
    }
    return Math.round(n * 0.45359237);
  });

  startEditCap(): void {
    this.focusDetailTab('ficha');
    this.clearStagedDocUploads();
    const m = this.meta() ?? {};
    this.editTransmissionType.set(
      valueFromLabel(this.transmissionOptions, m.transmissionType) ||
        m.transmissionType?.trim() ||
        '',
    );
    this.editTransmissionSpeeds.set(
      valueFromLabel(this.speedOptions, m.transmissionSpeeds) ||
        m.transmissionSpeeds?.trim() ||
        '',
    );
    this.editGvwrLb.set(m.grossVehicleWeightLb?.trim() || '');
    this.editOdometerKm.set(m.odometerKm?.trim() || '');
    this.editingSection.set('cap');
  }

  saveEditCap(): void {
    const lbRaw = this.editGvwrLb().trim().replace(/,/g, '');
    if (!lbRaw) {
      this.toast.show('Indica el peso bruto (GVWR) en libras.', 'warning');
      return;
    }
    const lb = Number(lbRaw);
    if (!Number.isFinite(lb) || lb <= 0) {
      this.toast.show('GVWR en libras no es válido.', 'warning');
      return;
    }
    const capacityKg = Math.round(lb * 0.45359237);
    const transLabel =
      this.transmissionOptions.find((o) => o.value === this.editTransmissionType())
        ?.label ||
      this.editTransmissionType().trim() ||
      undefined;
    const speedsLabel =
      this.speedOptions.find((o) => o.value === this.editTransmissionSpeeds())?.label ||
      this.editTransmissionSpeeds().trim() ||
      undefined;
    this.unitOverride.update((prev) => ({ ...prev, capacityKg }));
    this.metaOverride.update((prev) => ({
      ...prev,
      transmissionType: transLabel,
      transmissionSpeeds: speedsLabel,
      grossVehicleWeightLb: lbRaw || undefined,
      odometerKm: this.editOdometerKm().trim() || undefined,
    }));
    this.toast.show('Tren motriz y capacidad actualizados.', 'success');
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
  /** Documentos de verificación (copia editable). */
  readonly editVerifNames = signal<string[]>([]);
  readonly editVerifNewFiles = signal<File[]>([]);

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

  startEditVerif(): void {
    this.focusDetailTab('cob');
    this.clearStagedDocUploads();
    const m = this.meta() ?? {};
    this.editVerifNames.set([...(m.documentVerificationNames ?? [])]);
    this.editingSection.set('verif');
  }

  removeEditVerifDoc(index: number): void {
    this.editVerifNames.update((prev) => prev.filter((_, i) => i !== index));
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
    const merged = [
      ...this.editVerifNames(),
      ...this.editVerifNewFiles().map((f) => f.name),
    ];
    const documentVerificationNames =
      merged.length > 0 ? [...new Set(merged)] : undefined;
    this.metaOverride.update((prev) => ({ ...prev, documentVerificationNames }));
    this.editVerifNewFiles.set([]);
    this.toast.show('Documentos de verificación actualizados.', 'success');
    this.editingSection.set(null);
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

  // -- GPS: form signals --
  readonly editGpsHas = signal(false);
  readonly editGpsBrand = signal('');
  readonly editGpsContractDate = signal('');
  readonly editGpsCadence = signal('annual');
  readonly editGpsPrice = signal('');
  readonly editGpsPortal = signal('');
  readonly editGpsEndorse = signal(false);

  startEditGps(): void {
    this.focusDetailTab('cob');
    this.clearStagedDocUploads();
    const m = this.meta() ?? {};
    this.editGpsHas.set(m.hasGps === true);
    this.editGpsBrand.set(m.gpsProviderBrand?.trim() || '');
    this.editGpsContractDate.set(m.gpsContractDate ?? '');
    const cadRaw = m.gpsPaymentCadence?.trim() || '';
    this.editGpsCadence.set(
      valueFromLabel(this.cadenceOptions, cadRaw) ||
        (this.cadenceOptions.some((o) => o.value === cadRaw) ? cadRaw : '') ||
        'annual',
    );
    this.editGpsPrice.set(m.gpsPrice != null ? String(m.gpsPrice) : '');
    this.editGpsPortal.set(m.gpsTrackingPortalUrl?.trim() || '');
    this.editGpsEndorse.set(m.gpsCoveredByInsuranceEndorsement === true);
    this.editingSection.set('gps');
  }

  toggleEditGpsHas(): void {
    this.editGpsHas.set(!this.editGpsHas());
  }

  toggleEditGpsEndorse(): void {
    this.editGpsEndorse.set(!this.editGpsEndorse());
  }

  saveEditGps(): void {
    if (!this.editGpsHas()) {
      this.metaOverride.update((prev) => ({
        ...prev,
        hasGps: false,
        gpsProviderBrand: undefined,
        gpsPrice: undefined,
        gpsPaymentCadence: undefined,
        gpsContractDate: undefined,
        gpsTrackingPortalUrl: undefined,
        gpsCoveredByInsuranceEndorsement: undefined,
      }));
      this.toast.show('GPS actualizado.', 'success');
      this.editingSection.set(null);
      return;
    }
    const price = parseOptionalAmount(this.editGpsPrice());
    if (price === 'invalid') {
      this.toast.show('El precio del GPS debe ser un número válido (≥ 0).', 'warning');
      return;
    }
    const cadenceLabel =
      this.cadenceOptions.find((o) => o.value === this.editGpsCadence())?.label ||
      this.editGpsCadence().trim() ||
      undefined;
    this.metaOverride.update((prev) => ({
      ...prev,
      hasGps: true,
      gpsProviderBrand: this.editGpsBrand().trim() || undefined,
      gpsContractDate: this.editGpsContractDate().trim() || undefined,
      gpsPaymentCadence: cadenceLabel,
      gpsPrice: price === undefined ? undefined : price,
      gpsTrackingPortalUrl: this.editGpsPortal().trim() || undefined,
      gpsCoveredByInsuranceEndorsement: this.editGpsEndorse() ? true : undefined,
    }));
    this.toast.show('GPS actualizado.', 'success');
    this.editingSection.set(null);
  }
  private readonly localMaintEntries = signal<MaintenanceEntry[]>([]);

  /** Estado del formulario inline. */
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

  /** Hoy en formato ISO; cacheado para usarse como min/max del datepicker. */
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

    let priorUnitId = '';
    effect(() => {
      const id = this.unit().id;
      if (priorUnitId !== '' && priorUnitId !== id) {
        this.unitOverride.set({});
        this.metaOverride.set({});
        this.editingSection.set(null);
        this.verifEntryKind.set(null);
        this.addingMaint.set(false);
        this.localMaintEntries.set([]);
        this.resetNewMaintForm();
        this.detailTab.set('mant');
      }
      priorUnitId = id;
    });

    afterNextRender(() => this.drawerLoading.set(false));
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }

  trailerOperationalId(): string {
    return formatUnitTrailerOperationalId(this.effUnit());
  }

  meta(): UnitFleetMeta | undefined {
    return this.effUnit().fleetMeta;
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
    const u = this.effUnit();
    const name = u.fleetMeta?.trailerBrandName?.trim();
    if (name) {
      return name;
    }
    const abbr = u.trailerBrandAbbr?.trim();
    if (!abbr) {
      return '—';
    }
    return TRAILER_BRAND_OPTIONS.find((o) => o.value === abbr)?.label ?? abbr;
  }

  /** Suma de km en maniobras completadas (rutas con distancia registrada). */
  completedTripDistanceKmLabel(): string {
    const v = this.completedTripDistanceKm();
    if (v == null || !Number.isFinite(v) || v <= 0) {
      return '—';
    }
    return `${new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    }).format(v)} km`;
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
    return nextMaintenanceTableDate(this.meta()) ?? '—';
  }

  /** `true` = alerta por km; `false`/ausente = por tiempo (calendario). */
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

  /**
   * Texto del badge de kms hasta próximo mantenimiento.
   * Con `maintenanceKmInterval` y km de maniobras se calcula; si no, valor explícito en meta.
   */
  maintenanceKmRemainingDisplay(): string {
    const raw = fleetMaintenanceKmRemaining(
      this.meta(),
      this.completedTripDistanceKm(),
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
      this.completedTripDistanceKm(),
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

  gpsNext(): string {
    return nextGpsTableDate(this.meta()) ?? '—';
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
   */
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

  /** Etiqueta del catálogo de tipo (usa label legible para mostrarse en la tabla). */
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

  /** Cambia el estado y limpia la fecha si quedó fuera del rango permitido. */
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

    const tripKmNow = this.completedTripDistanceKm();
    const metaPatch: Partial<UnitFleetMeta> = {};
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

  docNames(which: 'maint' | 'verif' | 'policy' | 'ownership'): string[] {
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

  downloadStoredDocument(fileName: string): void {
    downloadMockFleetDocument(this.doc, fileName);
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
    return renewalBucket(iso, VERIF_MO);
  }

  /** Costo, precio o cantidad asociada (verificación, seguro, etc.) en formato es-MX. */
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

  gpsRenewalBucket(): FleetRenewalBucket {
    return fleetGpsRenewal(this.meta());
  }
}
