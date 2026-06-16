import {
  afterNextRender,
  ChangeDetectionStrategy,
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
import { ToastService } from '@core/notifications/toast.service';
import { FleetFeatureService } from '@features/fleet/services/fleet.service';
import { UnitsFeatureService } from '@features/fleet/services/units.service';
import { trackFileEntry } from '@features/fleet/utils/list-trackers';
import {
  MaintenanceEntry,
  TrailerTenureMode,
  UnitFleetMeta,
} from '@shared/models/logistics.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
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
  FLEET_TRANSMISSION_SPEED_OPTIONS,
  FLEET_TRANSMISSION_TYPE_OPTIONS,
  FLEET_UNIT_STATUS_OPTIONS,
} from '@shared/catalogs/fleet-form-options';

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
    ToSideDrawerComponent,
    FormsModule,
    
    ToButtonComponent,
    ToIconComponent,
    ToInputComponent,
    ToSelectComponent,
    ToFleetBrandComboboxComponent,
    ToFleetVersionComboboxComponent,
    ToTextareaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-new-unit-drawer.component.html',
  styleUrls: [
    '../fleet-drawer.shared.scss',
    '../styles/fleet-drawer-unit-sec.shared.scss',
    './fleet-new-unit-drawer.component.scss',
  ],
})
export class FleetNewUnitDrawerComponent {
  readonly trackFileEntry = trackFileEntry;

  private readonly destroyRef = inject(DestroyRef);
  private readonly fleetFeature = inject(FleetFeatureService);
  private readonly unitsFeature = inject(UnitsFeatureService);
  private readonly toast = inject(ToastService);

  readonly dismiss = output<void>();
  readonly drawerLoading = signal(true);
  readonly saved = output<void>();

  readonly brandName = model('');
  readonly trailerVersion = model('');
  readonly modelYear = model('');
  readonly plate = model('');
  readonly trailerColor = model('');
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
  readonly insuranceCarrierName = model('');
  readonly insurancePolicyNumber = model('');
  readonly insurancePaymentCadence = model('annual');
  readonly insuranceContractDate = model('');
  readonly insuranceCost = model('');
  readonly hasGps = model(false);
  readonly gpsProviderBrand = model('');
  readonly gpsPaymentCadence = model('annual');
  readonly gpsContractDate = model('');
  readonly gpsPrice = model('');
  readonly gpsTrackingPortalUrl = model('');
  readonly gpsCoveredByInsuranceEndorsement = model(false);
  readonly trailerTenureMode = model('owned');
  readonly trailerCommercialValue = model('');
  readonly trailerRecurringPaymentAmount = model('');
  readonly trailerRecurringPaymentDate = model('');
  readonly trailerRecurringInstallmentCount = model('');
  readonly trailerManagementOwnerPayout = model('');
  readonly status = model('available');
  /** Número de serie / VIN (opcional en alta). */
  readonly serialNumber = model('');
  /** Nombre comercial o alias interno (opcional). */
  readonly unitAlias = model('');
  readonly saving = model(false);

  readonly filesMaintenance = signal<File[]>([]);
  readonly filesVerification = signal<File[]>([]);
  readonly filesPolicy = signal<File[]>([]);
  readonly filesOwnership = signal<File[]>([]);

  readonly unitBrandNames = this.fleetFeature.unitBrandNames;
  readonly unitVersionNames = computed(() =>
    this.fleetFeature.versionNamesFor('UNIT', this.brandName()),
  );

  readonly modelYearOptions = buildFleetModelYearSelectOptions();

  readonly transmissionOptions = FLEET_TRANSMISSION_TYPE_OPTIONS;

  readonly speedOptions = FLEET_TRANSMISSION_SPEED_OPTIONS;

  readonly maintenanceTypeOptions = FLEET_MAINTENANCE_TYPE_OPTIONS;

  readonly tireOptions = FLEET_TIRE_CONDITION_OPTIONS;

  readonly cadenceOptions = FLEET_PAYMENT_CADENCE_OPTIONS;

  readonly statusOptions = FLEET_UNIT_STATUS_OPTIONS;

  readonly tenureOptions = FLEET_TRAILER_TENURE_OPTIONS;

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

  readonly gpsRenewHint = computed(() => {
    if (!this.hasGps()) {
      return null;
    }
    const iso = this.gpsContractDate().trim();
    const cad = this.gpsPaymentCadence();
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
    this.fleetFeature.ensureFleetCatalogLoaded();
    registerFleetVersionResetOnBrandChange({
      brandName: () => this.brandName(),
      versionName: this.trailerVersion,
    });
    afterNextRender(() => this.drawerLoading.set(false));
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }

  brandLabel(name: string): string {
    return name.trim();
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

  toggleDoubleArticSwitch(): void {
    this.doubleArticApplies.set(!this.doubleArticApplies());
  }

  toggleGpsSwitch(): void {
    this.hasGps.set(!this.hasGps());
  }

  toggleGpsEndorsementSwitch(): void {
    this.gpsCoveredByInsuranceEndorsement.set(!this.gpsCoveredByInsuranceEndorsement());
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
    const brandName = this.brandName().trim();
    const year = this.modelYear().trim();
    const plate = this.plate().trim();
    const lbRaw = this.grossVehicleWeightLb().trim().replace(/,/g, '');

    if (!brandName || !year || !plate) {
      this.toast.show('Marca, año modelo y placa son obligatorios.', 'warning');
      return;
    }
    let capacityKg = 0;
    if (lbRaw) {
      const lb = Number(lbRaw);
      if (!Number.isFinite(lb) || lb <= 0) {
        this.toast.show('GVWR en libras no es válido.', 'warning');
        return;
      }
      capacityKg = Math.round(lb * 0.45359237);
    }

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

    const gpsPriceParsed = this.hasGps() ? parseOptionalAmount(this.gpsPrice()) : undefined;
    if (gpsPriceParsed === 'invalid') {
      this.toast.show(
        'El precio del GPS debe ser un número válido (≥ 0) o dejarse vacío.',
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
    const gpsCadenceLabel =
      this.cadenceOptions.find((o) => o.value === this.gpsPaymentCadence())?.label ??
      this.gpsPaymentCadence();

    const meta: UnitFleetMeta = {
      trailerBrandName: this.brandLabel(brandName),
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
      insuranceCarrierName: this.insuranceCarrierName().trim() || undefined,
      insurancePolicyNumber: this.insurancePolicyNumber().trim() || undefined,
      insurancePaymentCadence: cadenceLabel,
      insuranceContractDate: this.insuranceContractDate().trim() || undefined,
      insuranceCost: insCost === undefined ? undefined : insCost,
      ...(this.hasGps()
        ? {
            hasGps: true,
            gpsProviderBrand: this.gpsProviderBrand().trim() || undefined,
            gpsPaymentCadence: gpsCadenceLabel,
            gpsContractDate: this.gpsContractDate().trim() || undefined,
            gpsPrice: gpsPriceParsed === undefined ? undefined : gpsPriceParsed,
            gpsTrackingPortalUrl: this.gpsTrackingPortalUrl().trim() || undefined,
            gpsCoveredByInsuranceEndorsement: this.gpsCoveredByInsuranceEndorsement()
              ? true
              : undefined,
          }
        : { hasGps: false }),
      documentMaintenanceNames: this.filesMaintenance().map((f) => f.name),
      documentVerificationNames: this.filesVerification().map((f) => f.name),
      documentPolicyNames: this.filesPolicy().map((f) => f.name),
      documentOwnershipNames: this.filesOwnership().map((f) => f.name),
    };

    const brandAbbr = deriveFleetBrandAbbr(brandName);

    this.saving.set(true);
    this.unitsFeature
      .createUnit({
        plate,
        capacityKg,
        status: this.status(),
        trailerBrandAbbr: brandAbbr || undefined,
        trailerYear: year,
        serialNumber: this.serialNumber().trim() || undefined,
        name: this.unitAlias().trim() || undefined,
        fleetMeta: meta,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.fleetFeature.registerLocalCatalogEntry(
            'UNIT',
            brandName,
            this.trailerVersion().trim() || undefined,
          );
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
