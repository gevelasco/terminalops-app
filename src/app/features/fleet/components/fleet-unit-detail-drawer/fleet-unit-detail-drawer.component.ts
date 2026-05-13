import { DecimalPipe, DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TRAILER_BRAND_OPTIONS } from '@app/mock-data/trailer-brands';
import { ToastService } from '@core/notifications/toast.service';
import {
  formatUnitTrailerLabel,
  formatUnitTrailerOperationalId,
} from '@app/mock-data/mock-units';
import {
  FleetRenewalBucket,
  fleetInsuranceRenewal,
  formatFleetYmdMx,
  nextInsuranceTableDate,
  nextMaintenanceTableDate,
  nextCycleFormatted,
  renewalBucket,
} from '@app/features/fleet/utils/fleet-unit-table-row';
import {
  MaintenanceEntry,
  MaintenanceEntryStatus,
  TrailerTenureMode,
  Unit,
  UnitFleetMeta,
} from '@shared/models/logistics.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
  ToSelectOption,
} from '@shared/ui/to-select/to-select.component';
import { ToTextareaComponent } from '@shared/ui/to-textarea/to-textarea.component';

const VERIF_MO = 6;
const MAINT_MO = 6;

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
    ToIconButtonComponent,
    ToButtonComponent,
    ToInputComponent,
    ToSelectComponent,
    ToTextareaComponent,
  ],
  templateUrl: './fleet-unit-detail-drawer.component.html',
  styleUrls: ['../fleet-drawer.shared.scss', './fleet-unit-detail-drawer.component.scss'],
})
export class FleetUnitDetailDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  readonly unit = input.required<Unit>();
  /** Si hay maniobra `in_transit` para esta unidad. */
  readonly onRoute = input(false);

  readonly verifCycleMo = VERIF_MO;

  /** Expuesto a la plantilla (no se pueden importar funciones sueltas en el HTML). */
  readonly formatYmd = formatFleetYmdMx;

  readonly dismiss = output<void>();

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
    'id' | 'tenure' | 'cap' | 'maint' | 'verif' | 'insurance' | null
  >(null);

  isEditing(section: 'id' | 'tenure' | 'cap' | 'maint' | 'verif' | 'insurance'): boolean {
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

  readonly brandOptions = TRAILER_BRAND_OPTIONS;
  readonly modelYearOptions: ToSelectOption[] = (() => {
    const y = new Date().getFullYear();
    const out: ToSelectOption[] = [];
    for (let i = y + 1; i >= 1990; i--) {
      out.push({ value: String(i), label: String(i) });
    }
    return out;
  })();
  readonly statusOptions: ToSelectOption[] = [
    { value: 'available', label: 'Disponible' },
    { value: 'in_use', label: 'En uso' },
    { value: 'scheduled', label: 'Programado' },
    { value: 'maintenance', label: 'Mantenimiento' },
  ];

  startEditId(): void {
    const u = this.effUnit();
    const m = u.fleetMeta ?? {};
    this.editBrand.set(u.trailerBrandAbbr?.trim() || '');
    this.editYear.set(u.trailerYear?.trim() || '');
    this.editVersion.set(m.trailerVersion?.trim() || '');
    this.editType.set(u.type ?? '');
    this.editPlate.set(u.plate ?? '');
    this.editColor.set(m.trailerColor?.trim() || '');
    this.editStatus.set((u.status || 'available').trim());
    this.editingSection.set('id');
  }

  cancelEdit(): void {
    this.editingSection.set(null);
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

  readonly tenureOptions: ToSelectOption[] = [
    { value: 'owned', label: 'Propio' },
    { value: 'financed', label: 'Financiado' },
    { value: 'leased', label: 'Arrendado' },
    { value: 'managed', label: 'Administrado' },
  ];

  tenureRecurringAmountLabel(): string {
    return this.editTenureMode() === 'leased' ? 'Monto de renta' : 'Monto por cuota';
  }

  tenureInstallmentOrTermLabel(): string {
    return this.editTenureMode() === 'leased'
      ? 'Plazos o meses de contrato'
      : 'Total de cuotas';
  }

  startEditTenure(): void {
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
    this.editingSection.set('tenure');
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
    this.metaOverride.update((prev) => ({
      ...prev,
      trailerTenureMode: mode,
      trailerCommercialValue,
      trailerRecurringPaymentAmount,
      trailerRecurringPaymentDate,
      trailerRecurringInstallmentCount,
      trailerManagementOwnerPayout,
    }));
    this.toast.show('Propiedad y tenencia actualizadas.', 'success');
    this.editingSection.set(null);
  }

  // -- Tren motriz y capacidad: form signals --
  readonly editTransmissionType = signal('');
  readonly editTransmissionSpeeds = signal('');
  readonly editGvwrLb = signal('');
  readonly editOdometerKm = signal('');

  readonly transmissionOptions: ToSelectOption[] = [
    { value: 'automatic', label: 'Automática' },
    { value: 'standard', label: 'Estándar (manual)' },
    { value: 'semi', label: 'Semiautomática (AMT)' },
  ];

  readonly speedOptions: ToSelectOption[] = [
    { value: '6', label: '6 velocidades' },
    { value: '7', label: '7 velocidades' },
    { value: '8', label: '8 velocidades' },
    { value: '9', label: '9 velocidades' },
    { value: '10', label: '10 velocidades' },
    { value: '12', label: '12 velocidades' },
    { value: '13', label: '13 velocidades' },
    { value: '14', label: '14 velocidades' },
    { value: '18', label: '18 velocidades' },
  ];

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

  readonly cadenceOptions: ToSelectOption[] = [
    { value: 'weekly', label: 'Semanal' },
    { value: 'monthly', label: 'Mensual' },
    { value: 'quarterly', label: 'Trimestral' },
    { value: 'annual', label: 'Anual' },
  ];

  startEditInsurance(): void {
    const m = this.meta() ?? {};
    this.editInsPolicyNumber.set(m.insurancePolicyNumber?.trim() || '');
    this.editInsContractDate.set(m.insuranceContractDate ?? '');
    this.editInsCadence.set(
      valueFromLabel(this.cadenceOptions, m.insurancePaymentCadence) ||
        m.insurancePaymentCadence?.trim() ||
        '',
    );
    this.editInsCost.set(m.insuranceCost != null ? String(m.insuranceCost) : '');
    this.editingSection.set('insurance');
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
    this.metaOverride.update((prev) => ({
      ...prev,
      insurancePolicyNumber: this.editInsPolicyNumber().trim() || undefined,
      insuranceContractDate: this.editInsContractDate().trim() || undefined,
      insurancePaymentCadence: cadenceLabel,
      insuranceCost: cost === undefined ? undefined : cost,
    }));
    this.toast.show('Seguro actualizado.', 'success');
    this.editingSection.set(null);
  }

  /** Entradas locales que se acumulan durante la sesión (mock). */
  private readonly localMaintEntries = signal<MaintenanceEntry[]>([]);

  /** Estado del formulario inline. */
  readonly addingMaint = signal(false);
  readonly newMaintStatus = signal<MaintenanceEntryStatus>('concluido');
  readonly newMaintType = signal('servicio_completo');
  readonly newMaintCost = signal('');
  readonly newMaintDate = signal('');
  readonly newMaintNotes = signal('');
  readonly newMaintFiles = signal<File[]>([]);

  readonly newMaintStatusOptions: ToSelectOption[] = [
    { value: 'concluido', label: 'Concluido' },
    { value: 'programado', label: 'Programado' },
  ];

  readonly newMaintTypeOptions: ToSelectOption[] = [
    { value: 'servicio_completo', label: 'Servicio completo' },
    { value: 'medio_servicio', label: 'Medio servicio' },
    { value: 'mecanica_general', label: 'Mecánica general' },
    { value: 'reparacion_electrica', label: 'Reparación eléctrica' },
    { value: 'accesorios', label: 'Accesorios' },
    { value: 'cambio_llantas', label: 'Cambio de llantas' },
    { value: 'otro', label: 'Otro' },
  ];

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

  friendlyTrailerLabel(): string {
    return formatUnitTrailerLabel(this.effUnit());
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

  statusBanner(): { label: string; sub?: string; mod: string } {
    if (this.onRoute()) {
      return {
        label: 'En ruta',
        sub: 'Maniobra activa',
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

  insNext(): string {
    return nextInsuranceTableDate(this.meta()) ?? '—';
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

  docNames(which: 'maint' | 'verif' | 'policy'): string[] {
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
    return m.documentPolicyNames ?? [];
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
    return renewalBucket(this.meta()?.lastMaintenanceDate, MAINT_MO);
  }

  insRenewalBucket(): FleetRenewalBucket {
    return fleetInsuranceRenewal(this.meta());
  }
}
