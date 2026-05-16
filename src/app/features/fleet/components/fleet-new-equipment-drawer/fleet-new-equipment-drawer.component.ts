import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EQUIPMENT_CONTAINER_SLOT_OPTIONS } from '@app/mock-data/equipment-container-slot-options';
import { EQUIPMENT_OPERATION_TYPE_OPTIONS } from '@app/mock-data/equipment-operation-type-options';
import { TRAILER_BRAND_OPTIONS } from '@app/mock-data/trailer-brands';
import { ToastService } from '@core/notifications/toast.service';
import { EquipmentRepository } from '@features/fleet/data/equipment.repository';
import { trackFileEntry } from '@features/fleet/utils/list-trackers';
import {
  EquipmentFleetMeta,
  MaintenanceEntry,
  TrailerTenureMode,
} from '@shared/models/logistics.models';
import { ToDrawerSkeletonComponent } from '@shared/ui/to-drawer-skeleton/to-drawer-skeleton.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
  type ToSelectOption,
} from '@shared/ui/to-select/to-select.component';
import { ToTextareaComponent } from '@shared/ui/to-textarea/to-textarea.component';
import {
  buildFleetModelYearSelectOptions,
  FLEET_MAINTENANCE_TYPE_OPTIONS,
  FLEET_PAYMENT_CADENCE_OPTIONS,
  FLEET_TIRE_CONDITION_OPTIONS,
  FLEET_TRAILER_TENURE_OPTIONS,
  FLEET_UNIT_STATUS_OPTIONS,
} from '@shared/catalogs/fleet-form-options';

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

type PhysRenewUi = 'due' | 'soon' | 'ok' | null;

function renewalFromLastDateForVerif(iso: string, cycleMonths: number): PhysRenewUi {
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

@Component({
  selector: 'app-fleet-new-equipment-drawer',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    ToButtonComponent,
    ToIconButtonComponent,
    ToInputComponent,
    ToSelectComponent,
    ToTextareaComponent,
    ToDrawerSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-new-equipment-drawer.component.html',
  styleUrls: ['../fleet-drawer.shared.scss', '../styles/fleet-drawer-unit-sec.shared.scss'],
})
export class FleetNewEquipmentDrawerComponent {
  readonly trackFileEntry = trackFileEntry;

  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly equipmentRepo = inject(EquipmentRepository);
  private readonly toast = inject(ToastService);

  readonly unitOptions = input.required<ToSelectOption[]>();

  readonly dismiss = output<void>();
  readonly drawerLoading = signal(true);
  readonly saved = output<void>();

  readonly unitId = model('');
  readonly brandCode = model('');
  readonly modelYear = model('');
  readonly trailerVersion = model('');
  readonly operationTypeCode = model('');
  readonly plate = model('');
  readonly trailerColor = model('');
  readonly status = model('available');
  readonly name = model('');
  readonly serialNumber = model('');

  readonly trailerTenureMode = model('owned');
  readonly trailerCommercialValue = model('');
  readonly trailerRecurringPaymentAmount = model('');
  readonly trailerRecurringPaymentDate = model('');
  readonly trailerRecurringInstallmentCount = model('');
  readonly trailerManagementOwnerPayout = model('');

  readonly equipmentCapacityTons = model('');
  readonly equipmentAxleCount = model('');
  readonly equipmentTireCount = model('');
  readonly equipmentContainerSlot = model('na');

  readonly insurancePolicyNumber = model('');
  readonly insurancePaymentCadence = model('annual');
  readonly insuranceContractDate = model('');
  readonly insuranceCost = model('');

  readonly verificationPhysMechDate = model('');
  readonly verificationPhysMechCost = model('');

  readonly lastMaintenanceDate = model('');
  readonly lastMaintenanceType = model('servicio_completo');
  readonly lastMaintenanceCost = model('');
  readonly lastMaintenanceNotes = model('');
  readonly tireCondition = model('good');

  readonly saving = model(false);

  readonly filesMaintenance = signal<File[]>([]);
  readonly filesVerification = signal<File[]>([]);
  readonly filesPolicy = signal<File[]>([]);
  readonly filesOwnership = signal<File[]>([]);

  readonly brandOptions = TRAILER_BRAND_OPTIONS;
  readonly operationTypeOptions = EQUIPMENT_OPERATION_TYPE_OPTIONS;
  readonly containerSlotOptions = EQUIPMENT_CONTAINER_SLOT_OPTIONS;

  readonly modelYearOptions = buildFleetModelYearSelectOptions();

  readonly maintenanceTypeOptions = FLEET_MAINTENANCE_TYPE_OPTIONS;

  readonly tireOptions = FLEET_TIRE_CONDITION_OPTIONS;

  readonly cadenceOptions = FLEET_PAYMENT_CADENCE_OPTIONS;

  readonly statusOptions = FLEET_UNIT_STATUS_OPTIONS;

  readonly tenureOptions = FLEET_TRAILER_TENURE_OPTIONS;

  readonly physRenewal = computed(() =>
    renewalFromLastDateForVerif(this.verificationPhysMechDate().trim(), 6),
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
    afterNextRender(() => this.drawerLoading.set(false));
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

  operationTypeLabel(code: string): string {
    return this.operationTypeOptions.find((o) => o.value === code)?.label ?? code;
  }

  tenureRecurringAmountLabel(): string {
    return this.trailerTenureMode() === 'leased' ? 'Monto de renta' : 'Monto por cuota';
  }

  tenureInstallmentOrTermLabel(): string {
    return this.trailerTenureMode() === 'leased'
      ? 'Plazos o meses de contrato'
      : 'Total de cuotas del crédito';
  }

  private buildMaintenanceEntries(
    typeLabel: string | undefined,
    cost: number | undefined,
  ): MaintenanceEntry[] | undefined {
    const date = this.lastMaintenanceDate().trim();
    const notes = this.lastMaintenanceNotes().trim();
    const docs = this.filesMaintenance().map((f) => f.name);
    const hasData = !!(
      date ||
      (typeLabel && typeLabel.trim()) ||
      cost !== undefined ||
      notes ||
      docs.length > 0
    );
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

  onFiles(ev: Event, which: 'maint' | 'verif' | 'policy' | 'ownership'): void {
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
          : which === 'policy'
            ? this.filesPolicy
            : this.filesOwnership;
    target.update((prev) => [...prev, ...list]);
    input.value = '';
  }

  removeFile(which: 'maint' | 'verif' | 'policy' | 'ownership', index: number): void {
    const target =
      which === 'maint'
        ? this.filesMaintenance
        : which === 'verif'
          ? this.filesVerification
          : which === 'policy'
            ? this.filesPolicy
            : this.filesOwnership;
    target.update((prev) => prev.filter((_, i) => i !== index));
  }

  submit(): void {
    const uid = this.unitId().trim();
    const brand = this.brandCode().trim();
    const year = this.modelYear().trim();
    const opType = this.operationTypeCode().trim();
    const plate = this.plate().trim();
    const serial = this.serialNumber().trim();

    if (!brand || !year || !opType || !plate || !serial) {
      this.toast.show(
        'Marca, año modelo, tipo de unidad, placa y número de serie son obligatorios.',
        'warning',
      );
      return;
    }

    const maintCost = parseOptionalAmount(this.lastMaintenanceCost());
    const insCost = parseOptionalAmount(this.insuranceCost());
    const physCost = parseOptionalAmount(this.verificationPhysMechCost());
    const axles = parseOptionalPositiveInt(this.equipmentAxleCount());
    const tires = parseOptionalPositiveInt(this.equipmentTireCount());
    if (
      maintCost === 'invalid' ||
      insCost === 'invalid' ||
      physCost === 'invalid' ||
      axles === 'invalid' ||
      tires === 'invalid'
    ) {
      this.toast.show(
        'Revisa montos, número de ejes o número de llantas (entero ≥ 1 o vacío).',
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
    const cadenceLabel =
      this.cadenceOptions.find((o) => o.value === this.insurancePaymentCadence())?.label ??
      this.insurancePaymentCadence();
    const slotLabel =
      this.containerSlotOptions.find((o) => o.value === this.equipmentContainerSlot())?.label ??
      this.equipmentContainerSlot();

    const meta: EquipmentFleetMeta = {
      trailerBrandName: this.brandLabel(brand),
      trailerVersion: this.trailerVersion().trim() || undefined,
      trailerColor: this.trailerColor().trim() || undefined,
      trailerTenureMode: tenureMode,
      trailerCommercialValue,
      trailerRecurringPaymentAmount,
      trailerRecurringPaymentDate,
      trailerRecurringInstallmentCount,
      trailerManagementOwnerPayout,
      equipmentCapacityTons: this.equipmentCapacityTons().trim() || undefined,
      equipmentAxleCount: axles === undefined ? undefined : axles,
      equipmentTireCount: tires === undefined ? undefined : tires,
      equipmentContainerSlotConfig: slotLabel,
      lastMaintenanceDate: this.lastMaintenanceDate().trim() || undefined,
      lastMaintenanceType: maintTypeLabel,
      lastMaintenanceCost: maintCost === undefined ? undefined : maintCost,
      lastMaintenanceNotes: this.lastMaintenanceNotes().trim() || undefined,
      maintenanceEntries: this.buildMaintenanceEntries(
        maintTypeLabel,
        maintCost === undefined ? undefined : maintCost,
      ),
      tireCondition: tireLabel,
      insurancePolicyNumber: this.insurancePolicyNumber().trim() || undefined,
      insurancePaymentCadence: cadenceLabel,
      insuranceContractDate: this.insuranceContractDate().trim() || undefined,
      insuranceCost: insCost === undefined ? undefined : insCost,
      documentMaintenanceNames: this.filesMaintenance().map((f) => f.name),
      documentPolicyNames: this.filesPolicy().map((f) => f.name),
      documentOwnershipNames: this.filesOwnership().map((f) => f.name),
      verificationPhysMechDate: this.verificationPhysMechDate().trim() || undefined,
      verificationPhysMechCost: physCost === undefined ? undefined : physCost,
      documentVerificationNames:
        this.filesVerification().length > 0
          ? this.filesVerification().map((f) => f.name)
          : undefined,
    };

    const lastSvc = this.lastMaintenanceDate().trim() || new Date().toISOString().slice(0, 10);

    this.saving.set(true);
    this.equipmentRepo
      .create({
        unitId: uid || undefined,
        name: this.name().trim() || serial,
        serialNumber: serial,
        lastServiceDate: lastSvc,
        plate,
        type: this.operationTypeLabel(opType),
        status: this.status(),
        trailerBrandAbbr: brand,
        trailerYear: year,
        fleetMeta: meta,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.show('Equipo registrado.', 'success');
          this.saved.emit();
          this.dismiss.emit();
        },
        error: () => {
          this.toast.show('No se pudo guardar el equipo.', 'error');
          this.saving.set(false);
        },
      });
  }
}
