import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TRAILER_BRAND_OPTIONS } from '@app/mock-data/trailer-brands';
import { ToastService } from '@core/notifications/toast.service';
import { UnitRepository } from '@features/fleet/data/unit.repository';
import {
  MaintenanceEntry,
  TrailerTenureMode,
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

type RenewUi = 'due' | 'soon' | 'ok' | null;

function parseYmd(s: string): Date | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return null;
  }
  const d = new Date(t + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function daysFromToday(target: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target.getTime());
  t.setHours(0, 0, 0, 0);
  return Math.ceil((t.getTime() - today.getTime()) / 86400000);
}

/** Monto opcional: acepta miles con coma (es-MX) o punto decimal. */
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
  const t = raw.trim().replace(/\s/g, '').replace(/,/g, '');
  if (t === '') {
    return undefined;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 1 || Math.floor(n) !== n) {
    return 'invalid';
  }
  return n;
}

function renewalFromLastDate(iso: string, cycleMonths: number): RenewUi {
  const start = parseYmd(iso);
  if (!start) {
    return null;
  }
  const next = addMonths(start, cycleMonths);
  const d = daysFromToday(next);
  if (d < 0) {
    return 'due';
  }
  if (d <= 45) {
    return 'soon';
  }
  return 'ok';
}

@Component({
  selector: 'app-fleet-new-unit-drawer',
  standalone: true,
  imports: [
    FormsModule,
    ToButtonComponent,
    ToIconButtonComponent,
    ToInputComponent,
    ToSelectComponent,
    ToTextareaComponent,
  ],
  templateUrl: './fleet-new-unit-drawer.component.html',
  styleUrls: ['../fleet-drawer.shared.scss', './fleet-new-unit-drawer.component.scss'],
})
export class FleetNewUnitDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly unitsRepo = inject(UnitRepository);
  private readonly toast = inject(ToastService);

  readonly dismiss = output<void>();
  readonly saved = output<void>();

  readonly brandCode = model('');
  readonly trailerVersion = model('');
  readonly modelYear = model('');
  readonly plate = model('');
  readonly trailerColor = model('');
  readonly type = model('');
  readonly transmissionType = model('automatic');
  readonly transmissionSpeeds = model('10');
  readonly grossVehicleWeightLb = model('');
  readonly odometerKm = model('');
  readonly lastMaintenanceDate = model('');
  readonly lastMaintenanceType = model('servicio_completo');
  readonly lastMaintenanceCost = model('');
  readonly lastMaintenanceNotes = model('');
  readonly tireCondition = model('good');
  readonly verificationPhysMechDate = model('');
  readonly verificationPhysMechCost = model('');
  readonly verificationEmissionsDate = model('');
  readonly verificationEmissionsCost = model('');
  readonly doubleArticApplies = model(false);
  readonly verificationDoubleDate = model('');
  readonly verificationDoubleCost = model('');
  readonly insurancePolicyNumber = model('');
  readonly insurancePaymentCadence = model('annual');
  readonly insuranceContractDate = model('');
  readonly insuranceCost = model('');
  readonly trailerTenureMode = model('owned');
  readonly trailerCommercialValue = model('');
  readonly trailerRecurringPaymentAmount = model('');
  readonly trailerRecurringPaymentDate = model('');
  readonly trailerRecurringInstallmentCount = model('');
  readonly trailerManagementOwnerPayout = model('');
  readonly status = model('available');
  readonly saving = model(false);

  readonly filesMaintenance = signal<File[]>([]);
  readonly filesVerification = signal<File[]>([]);
  readonly filesPolicy = signal<File[]>([]);

  readonly brandOptions = TRAILER_BRAND_OPTIONS;

  readonly modelYearOptions: ToSelectOption[] = (() => {
    const y = new Date().getFullYear();
    const out: ToSelectOption[] = [];
    for (let i = y + 1; i >= 1990; i--) {
      out.push({ value: String(i), label: String(i) });
    }
    return out;
  })();

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

  readonly maintenanceTypeOptions: ToSelectOption[] = [
    { value: 'servicio_completo', label: 'Servicio completo' },
    { value: 'medio_servicio', label: 'Medio servicio' },
    { value: 'mecanica_general', label: 'Mecánica general' },
    { value: 'reparacion_electrica', label: 'Reparación eléctrica' },
    { value: 'accesorios', label: 'Accesorios' },
    { value: 'cambio_llantas', label: 'Cambio de llantas' },
    { value: 'otro', label: 'Otro' },
  ];

  readonly tireOptions: ToSelectOption[] = [
    {
      value: 'excellent',
      label: 'Excelente (banda ≥ 6 mm, sin daños)',
    },
    { value: 'good', label: 'Buena (4–6 mm, uso normal)' },
    { value: 'fair', label: 'Regular (2–4 mm, planear cambio)' },
    { value: 'low', label: 'Baja (cerca del mínimo legal)' },
    { value: 'critical', label: 'Crítica (fuera de servicio / cambio inmediato)' },
  ];

  readonly cadenceOptions: ToSelectOption[] = [
    { value: 'weekly', label: 'Semanal' },
    { value: 'monthly', label: 'Mensual' },
    { value: 'quarterly', label: 'Trimestral' },
    { value: 'annual', label: 'Anual' },
  ];

  readonly statusOptions: ToSelectOption[] = [
    { value: 'available', label: 'Disponible' },
    { value: 'in_use', label: 'En uso' },
    { value: 'scheduled', label: 'Programado' },
    { value: 'maintenance', label: 'Mantenimiento' },
  ];

  readonly tenureOptions: ToSelectOption[] = [
    { value: 'owned', label: 'Propio' },
    { value: 'financed', label: 'Financiado' },
    { value: 'leased', label: 'Arrendado' },
    { value: 'managed', label: 'Administrado' },
  ];

  readonly physRenewal = computed(() =>
    renewalFromLastDate(this.verificationPhysMechDate(), 6),
  );
  readonly emissionsRenewal = computed(() =>
    renewalFromLastDate(this.verificationEmissionsDate(), 6),
  );

  readonly insuranceRenewHint = computed(() => {
    const iso = this.insuranceContractDate().trim();
    const cad = this.insurancePaymentCadence();
    if (!iso) {
      return null;
    }
    const start = parseYmd(iso);
    if (!start) {
      return null;
    }
    const next =
      cad === 'weekly'
        ? new Date(start.getTime() + 7 * 86400000)
        : cad === 'monthly'
          ? addMonths(start, 1)
          : cad === 'quarterly'
            ? addMonths(start, 3)
            : addMonths(start, 12);
    const d = daysFromToday(next);
    if (d < 0) {
      return 'due' as const;
    }
    if (d <= 30) {
      return 'soon' as const;
    }
    return 'ok' as const;
  });

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

  brandLabel(code: string): string {
    return this.brandOptions.find((o) => o.value === code)?.label ?? code;
  }

  /** Una sola entrada al dar de alta; el detalle puede sumar más en el tiempo. */
  private buildMaintenanceEntries(
    typeLabel: string | undefined,
    cost: number | undefined,
  ): MaintenanceEntry[] | undefined {
    const date = this.lastMaintenanceDate().trim();
    const notes = this.lastMaintenanceNotes().trim();
    const docs = this.filesMaintenance().map((f) => f.name);
    const hasData = !!(date || (typeLabel && typeLabel.trim()) || cost !== undefined || notes || docs.length > 0);
    if (!hasData) {
      return undefined;
    }
    return [
      {
        date: date || undefined,
        type: typeLabel?.trim() || undefined,
        cost,
        notes: notes || undefined,
        documentNames: docs.length > 0 ? docs : undefined,
      },
    ];
  }

  tenureRecurringAmountLabel(): string {
    return this.trailerTenureMode() === 'leased' ? 'Monto de renta' : 'Monto por cuota';
  }

  tenureInstallmentOrTermLabel(): string {
    return this.trailerTenureMode() === 'leased'
      ? 'Plazos o meses de contrato'
      : 'Total de cuotas del crédito';
  }

  onFiles(ev: Event, which: 'maint' | 'verif' | 'policy'): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    if (list.length === 0) {
      return;
    }
    const target =
      which === 'maint'
        ? this.filesMaintenance
        : which === 'verif'
          ? this.filesVerification
          : this.filesPolicy;
    target.update((prev) => [...prev, ...list]);
    input.value = '';
  }

  toggleDoubleArticSwitch(): void {
    this.doubleArticApplies.set(!this.doubleArticApplies());
  }

  removeFile(which: 'maint' | 'verif' | 'policy', index: number): void {
    const target =
      which === 'maint'
        ? this.filesMaintenance
        : which === 'verif'
          ? this.filesVerification
          : this.filesPolicy;
    target.update((prev) => prev.filter((_, i) => i !== index));
  }

  submit(): void {
    const brand = this.brandCode().trim();
    const year = this.modelYear().trim();
    const plate = this.plate().trim();
    const type = this.type().trim();
    const lbRaw = this.grossVehicleWeightLb().trim().replace(/,/g, '');

    if (!brand || !year || !plate || !type) {
      this.toast.show('Marca, año modelo, placa y tipo de unidad son obligatorios.', 'warning');
      return;
    }
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

    if (this.doubleArticApplies() && !this.verificationDoubleDate().trim()) {
      this.toast.show('Si aplica doble articulado, indica la fecha de verificación.', 'warning');
      return;
    }

    const physCost = parseOptionalAmount(this.verificationPhysMechCost());
    const emisCost = parseOptionalAmount(this.verificationEmissionsCost());
    const doubleCost = this.doubleArticApplies()
      ? parseOptionalAmount(this.verificationDoubleCost())
      : undefined;
    if (physCost === 'invalid' || emisCost === 'invalid' || doubleCost === 'invalid') {
      this.toast.show(
        'Los montos de verificación deben ser números válidos (≥ 0) o dejar el campo vacío.',
        'warning',
      );
      return;
    }

    const insCost = parseOptionalAmount(this.insuranceCost());
    if (insCost === 'invalid') {
      this.toast.show(
        'El costo del seguro debe ser un número válido (≥ 0) o dejarse vacío.',
        'warning',
      );
      return;
    }

    const maintCost = parseOptionalAmount(this.lastMaintenanceCost());
    if (maintCost === 'invalid') {
      this.toast.show(
        'El costo del mantenimiento debe ser un número válido (≥ 0) o dejarse vacío.',
        'warning',
      );
      return;
    }

    const tenureModeRaw = this.trailerTenureMode().trim() as TrailerTenureMode;
    const TENURE: TrailerTenureMode[] = ['owned', 'financed', 'leased', 'managed'];
    const tenureMode: TrailerTenureMode = TENURE.includes(tenureModeRaw) ? tenureModeRaw : 'owned';

    const commercialVal = parseOptionalAmount(this.trailerCommercialValue());
    const recAmt = parseOptionalAmount(this.trailerRecurringPaymentAmount());
    const recCount = parseOptionalPositiveInt(this.trailerRecurringInstallmentCount());
    const ownerPayout = parseOptionalAmount(this.trailerManagementOwnerPayout());
    if (
      commercialVal === 'invalid' ||
      recAmt === 'invalid' ||
      recCount === 'invalid' ||
      ownerPayout === 'invalid'
    ) {
      this.toast.show('Revisa los montos o plazos de propiedad y tenencia.', 'warning');
      return;
    }

    let trailerCommercialValue: number | undefined;
    let trailerRecurringPaymentAmount: number | undefined;
    let trailerRecurringPaymentDate: string | undefined;
    let trailerRecurringInstallmentCount: number | undefined;
    let trailerManagementOwnerPayout: number | undefined;

    if (tenureMode === 'owned') {
      trailerCommercialValue = commercialVal === undefined ? undefined : commercialVal;
    } else if (tenureMode === 'financed' || tenureMode === 'leased') {
      trailerRecurringPaymentAmount = recAmt === undefined ? undefined : recAmt;
      trailerRecurringPaymentDate = this.trailerRecurringPaymentDate().trim() || undefined;
      trailerRecurringInstallmentCount = recCount === undefined ? undefined : recCount;
    } else if (tenureMode === 'managed') {
      trailerManagementOwnerPayout = ownerPayout === undefined ? undefined : ownerPayout;
    }

    const tireLabel =
      this.tireOptions.find((o) => o.value === this.tireCondition())?.label ??
      this.tireCondition();
    const maintTypeLabel =
      this.maintenanceTypeOptions.find((o) => o.value === this.lastMaintenanceType())?.label ??
      this.lastMaintenanceType();
    const transmissionLabel =
      this.transmissionOptions.find((o) => o.value === this.transmissionType())?.label ??
      this.transmissionType();
    const speedsLabel =
      this.speedOptions.find((o) => o.value === this.transmissionSpeeds())?.label ??
      this.transmissionSpeeds();
    const cadenceLabel =
      this.cadenceOptions.find((o) => o.value === this.insurancePaymentCadence())?.label ??
      this.insurancePaymentCadence();

    const meta: UnitFleetMeta = {
      trailerBrandName: this.brandLabel(brand),
      trailerVersion: this.trailerVersion().trim() || undefined,
      trailerColor: this.trailerColor().trim() || undefined,
      trailerTenureMode: tenureMode,
      trailerCommercialValue,
      trailerRecurringPaymentAmount,
      trailerRecurringPaymentDate,
      trailerRecurringInstallmentCount,
      trailerManagementOwnerPayout,
      transmissionType: transmissionLabel,
      transmissionSpeeds: speedsLabel,
      grossVehicleWeightLb: lbRaw || undefined,
      odometerKm: this.odometerKm().trim() || undefined,
      lastMaintenanceDate: this.lastMaintenanceDate().trim() || undefined,
      lastMaintenanceType: maintTypeLabel,
      lastMaintenanceCost: maintCost === undefined ? undefined : maintCost,
      lastMaintenanceNotes: this.lastMaintenanceNotes().trim() || undefined,
      maintenanceEntries: this.buildMaintenanceEntries(
        maintTypeLabel,
        maintCost === undefined ? undefined : maintCost,
      ),
      tireCondition: tireLabel,
      verificationPhysMechDate: this.verificationPhysMechDate().trim() || undefined,
      verificationPhysMechCost: physCost === undefined ? undefined : physCost,
      verificationEmissionsDate: this.verificationEmissionsDate().trim() || undefined,
      verificationEmissionsCost: emisCost === undefined ? undefined : emisCost,
      verificationDoubleArticulatedApplies: this.doubleArticApplies(),
      verificationDoubleArticulatedDate: this.doubleArticApplies()
        ? this.verificationDoubleDate().trim() || undefined
        : undefined,
      verificationDoubleArticulatedCost:
        this.doubleArticApplies() && doubleCost !== undefined ? doubleCost : undefined,
      insurancePolicyNumber: this.insurancePolicyNumber().trim() || undefined,
      insurancePaymentCadence: cadenceLabel,
      insuranceContractDate: this.insuranceContractDate().trim() || undefined,
      insuranceCost: insCost === undefined ? undefined : insCost,
      documentMaintenanceNames: this.filesMaintenance().map((f) => f.name),
      documentVerificationNames: this.filesVerification().map((f) => f.name),
      documentPolicyNames: this.filesPolicy().map((f) => f.name),
    };

    this.saving.set(true);
    this.unitsRepo
      .create({
        plate,
        type,
        capacityKg,
        status: this.status(),
        trailerBrandAbbr: brand,
        trailerYear: year,
        fleetMeta: meta,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.show('Unidad registrada.', 'success');
          this.saved.emit();
          this.dismiss.emit();
        },
        error: () => {
          this.toast.show('No se pudo guardar la unidad.', 'error');
          this.saving.set(false);
        },
      });
  }
}
