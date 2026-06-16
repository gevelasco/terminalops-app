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
import { EQUIPMENT_CONTAINER_SLOT_OPTIONS, EQUIPMENT_OPERATION_TYPE_OPTIONS } from '@shared/catalogs/fleet-form-options';
import { FleetFeatureService } from '@features/fleet/services/fleet.service';
import { FleetHitchValidationBlockComponent } from '@features/fleet/components/fleet-hitch-validation-block/fleet-hitch-validation-block.component';
import { registerFleetHitchSlotSync } from '@app/features/fleet/utils/fleet-drawer-form.utils';
import { fleetUnitIdIsOnRoute } from '@features/fleet/utils/fleet-operational-status';
import { validateEquipmentHitchAssignment, hitchPositionForNewEquipmentOnUnit, unitsEligibleForEquipmentHitch } from '@shared/utils/fleet/equipment-hitch-assignment';
import { formatUnitTrailerLabel } from '@shared/utils/fleet/unit-label';
import { Equipment, Unit } from '@shared/models/logistics.models';
import { ToastService } from '@core/notifications/toast.service';
import { EquipmentFeatureService } from '@features/fleet/services/equipment.service';
import { trackFileEntry } from '@features/fleet/utils/list-trackers';
import {
  EquipmentFleetMeta,
  MaintenanceEntry,
  TrailerTenureMode,
} from '@shared/models/logistics.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToFleetUnitInputComponent } from '@shared/ui/to-fleet-unit-input/to-fleet-unit-input.component';
import { ToSelectComponent } from '@shared/ui/to-select/to-select.component';
import { ToFleetBrandComboboxComponent } from '@shared/ui/to-fleet-brand-combobox/to-fleet-brand-combobox.component';
import { ToFleetVersionComboboxComponent } from '@shared/ui/to-fleet-version-combobox/to-fleet-version-combobox.component';
import { deriveFleetBrandAbbr } from '@shared/utils/fleet/derive-fleet-brand-abbr';
import { registerFleetVersionResetOnBrandChange } from '@shared/utils/fleet/fleet-brand-version-link';
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
    ToSideDrawerComponent,
    FormsModule,
    
    ToButtonComponent,
    ToIconComponent,
    ToInputComponent,
    FleetHitchValidationBlockComponent,
    ToFleetUnitInputComponent,
    ToSelectComponent,
    ToFleetBrandComboboxComponent,
    ToFleetVersionComboboxComponent,
    ToTextareaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-new-equipment-drawer.component.html',
  styleUrls: [
    '../fleet-drawer.shared.scss',
    '../styles/fleet-drawer-unit-sec.shared.scss',
    './fleet-new-equipment-drawer.component.scss',
  ],
})
export class FleetNewEquipmentDrawerComponent {
  readonly trackFileEntry = trackFileEntry;

  private readonly destroyRef = inject(DestroyRef);
  private readonly fleetFeature = inject(FleetFeatureService);
  private readonly equipmentFeature = inject(EquipmentFeatureService);
  private readonly toast = inject(ToastService);

  readonly units = input<Unit[]>([]);
  readonly equipmentCatalog = input<Equipment[]>([]);

  readonly dismiss = output<void>();

  readonly hitchSelectableUnits = computed(() =>
    unitsEligibleForEquipmentHitch(this.units(), this.equipmentCatalog()),
  );

  readonly hitchValidation = computed(() => {
    const uid = this.unitId().trim();
    if (!uid) {
      return validateEquipmentHitchAssignment({
        unitId: '',
        catalog: this.equipmentCatalog(),
        isSecondTrailer: false,
      });
    }
    const unit = this.units().find((u) => u.id === uid);
    const unitLabel = unit ? formatUnitTrailerLabel(unit) : uid;
    return validateEquipmentHitchAssignment({
      unitId: uid,
      catalog: this.equipmentCatalog(),
      isSecondTrailer: this.isSecondTrailer(),
      unitLabel,
    });
  });

  readonly hitchUnitOnRoute = computed(() =>
    fleetUnitIdIsOnRoute(this.unitId(), this.units()),
  );

  readonly drawerLoading = signal(true);
  readonly saved = output<void>();

  readonly unitId = model('');
  readonly isSecondTrailer = signal(false);

  constructor() {
    this.fleetFeature.ensureFleetCatalogLoaded();
    registerFleetVersionResetOnBrandChange({
      brandName: () => this.brandName(),
      versionName: this.trailerVersion,
    });
    afterNextRender(() => this.drawerLoading.set(false));
    registerFleetHitchSlotSync({
      isActive: () => Boolean(this.unitId().trim()),
      catalog: () => this.equipmentCatalog(),
      unitId: () => this.unitId(),
      isSecondTrailer: this.isSecondTrailer,
    });
  }

  readonly brandName = model('');
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

  readonly insuranceCarrierName = model('');
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

  readonly equipmentBrandNames = this.fleetFeature.equipmentBrandNames;
  readonly equipmentVersionNames = computed(() =>
    this.fleetFeature.versionNamesFor('EQUIPMENT', this.brandName()),
  );
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

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }

  brandLabel(name: string): string {
    return name.trim();
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
    const brandName = this.brandName().trim();
    const year = this.modelYear().trim();
    const opType = this.operationTypeCode().trim();
    const plate = this.plate().trim();
    const serial = this.serialNumber().trim();

    if (!brandName || !year || !opType || !plate || !serial) {
      this.toast.show(
        'Marca, año modelo, tipo de unidad, placa y número de serie son obligatorios.',
        'warning',
      );
      return;
    }

    if (uid) {
      if (this.hitchUnitOnRoute()) {
        this.toast.show(
          'No puede enganchar equipos a una unidad que está en curso.',
          'warning',
        );
        return;
      }
      const hitch = this.hitchValidation();
      if (!hitch.canSave) {
        this.toast.show(
          hitch.blockMessage ?? hitch.infoMessage ?? 'Revise el enganche a la tractora.',
          'warning',
        );
        return;
      }
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
      trailerBrandName: this.brandLabel(brandName),
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
      insuranceCarrierName: this.insuranceCarrierName().trim() || undefined,
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

    const brandAbbr = deriveFleetBrandAbbr(brandName);

    this.saving.set(true);
    this.equipmentFeature
      .createEquipment({
        unitId: uid || undefined,
        hitchPosition: uid
          ? hitchPositionForNewEquipmentOnUnit(this.equipmentCatalog(), uid) ?? undefined
          : undefined,
        name: this.name().trim() || serial,
        serialNumber: serial,
        lastServiceDate: lastSvc,
        plate,
        type: this.operationTypeLabel(opType),
        status: this.status(),
        trailerBrandAbbr: brandAbbr || undefined,
        trailerYear: year,
        fleetMeta: meta,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.fleetFeature.registerLocalCatalogEntry(
            'EQUIPMENT',
            brandName,
            this.trailerVersion().trim() || undefined,
          );
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
