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
import { parseFleetRequiredDigits } from '@features/fleet/utils/fleet-drawer-form.utils';
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
  FLEET_MAINTENANCE_TYPE_OPTIONS,
  FLEET_PAYMENT_CADENCE_OPTIONS,
  FLEET_SERVICE_MODALITY_OPTIONS,
  FLEET_TIRE_CONDITION_OPTIONS,
  FLEET_TRANSPORT_TYPE_OPTIONS,
  FLEET_TRAILER_TENURE_OPTIONS,
  FLEET_TRANSMISSION_SPEED_OPTIONS,
  FLEET_TRANSMISSION_TYPE_OPTIONS,
} from '@shared/catalogs/fleet-form-options';
import { EXPENSE_PAYMENT_METHOD_OPTIONS } from '@shared/catalogs/expense-form-options';
import { gpsFleetFormHasContent } from '@features/fleet/utils/fleet-gps-payment.util';
import { cyclicRenewalHint } from '@features/fleet/utils/fleet-cyclic-renewal-hint';

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
  readonly transportType = model('tractocamion');
  readonly trailerColor = model('');
  readonly serviceModality = model('');
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
  readonly insurancePaymentMethod = model('transfer');
  readonly insuranceInvoiceRequired = model(false);
  readonly insuranceContractDate = model('');
  readonly insuranceCost = model('');
  readonly gpsProviderBrand = model('');
  readonly gpsPaymentCadence = model('annual');
  readonly gpsPaymentMethod = model('transfer');
  readonly gpsInvoiceRequired = model(false);
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
  /** Número de serie / VIN (opcional en alta). */
  readonly serialNumber = model('');
  /** Número de motor (obligatorio en alta). */
  readonly motorNumber = model('');
  /** Capacidad de carga en toneladas (obligatorio en alta). */
  readonly capacityTons = model('');
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

  readonly transmissionOptions = FLEET_TRANSMISSION_TYPE_OPTIONS;

  readonly speedOptions = FLEET_TRANSMISSION_SPEED_OPTIONS;

  readonly serviceModalityOptions = FLEET_SERVICE_MODALITY_OPTIONS;

  readonly transportTypeOptions = FLEET_TRANSPORT_TYPE_OPTIONS;

  readonly maintenanceTypeOptions = FLEET_MAINTENANCE_TYPE_OPTIONS;

  readonly tireOptions = FLEET_TIRE_CONDITION_OPTIONS;

  readonly cadenceOptions = FLEET_PAYMENT_CADENCE_OPTIONS;
  readonly insurancePaymentMethodOptions = EXPENSE_PAYMENT_METHOD_OPTIONS.filter(
    (o) => o.value !== '',
  );

  readonly tenureOptions = FLEET_TRAILER_TENURE_OPTIONS;

  readonly physRenewal = computed(() =>
    renewalFromLastDate(this.verificationPhysMechDate(), 6),
  );
  readonly emissionsRenewal = computed(() =>
    renewalFromLastDate(this.verificationEmissionsDate(), 6),
  );

  readonly insuranceRenewHint = computed(() =>
    cyclicRenewalHint(this.insuranceContractDate().trim(), this.insurancePaymentCadence()),
  );

  readonly gpsRenewHint = computed(() =>
    cyclicRenewalHint(this.gpsContractDate().trim(), this.gpsPaymentCadence()),
  );

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
    const hasData = !!(date || cost !== undefined || notes || docs.length > 0);
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
    const yearRaw = this.modelYear().trim();
    const plate = this.plate().trim().toUpperCase();
    const motorNumber = this.motorNumber().trim().toUpperCase();
    const lbRaw = this.grossVehicleWeightLb().trim().replace(/,/g, '');
    const tonsRaw = this.capacityTons().trim().replace(/,/g, '');

    if (!brandName || !plate) {
      this.toast.show('Marca y placa son obligatorios.', 'warning');
      return;
    }
    const yearParsed = parseFleetRequiredDigits(yearRaw, { maxLength: 4 });
    if (yearParsed === 'empty') {
      this.toast.show('Modelo (año) es obligatorio.', 'warning');
      return;
    }
    if (yearParsed === 'invalid') {
      this.toast.show('Modelo (año) debe ser un número de máximo 4 dígitos.', 'warning');
      return;
    }
    const year = yearParsed;
    if (!motorNumber) {
      this.toast.show('Número de motor es obligatorio.', 'warning');
      return;
    }
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
    if (lbRaw) {
      const lb = Number(lbRaw);
      if (!Number.isFinite(lb) || lb <= 0 || !Number.isInteger(lb)) {
        this.toast.show('Ejes de tracción debe ser un número entero válido.', 'warning');
        return;
      }
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

    const gpsHasContent = gpsFleetFormHasContent({
      brand: this.gpsProviderBrand(),
      contractDate: this.gpsContractDate(),
      price: this.gpsPrice(),
      portal: this.gpsTrackingPortalUrl(),
    });
    const gpsPriceParsed = gpsHasContent ? parseOptionalAmount(this.gpsPrice()) : undefined;
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
    const modalityLabel =
      this.serviceModalityOptions.find((o) => o.value === this.serviceModality())?.label ??
      (this.serviceModality().trim() || undefined);
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
      serviceModality: modalityLabel,
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
      maintenanceKmCounter: 0,
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
      insurancePaymentMethod: this.insurancePaymentMethod().trim() || undefined,
      insuranceInvoiceRequired: this.insuranceInvoiceRequired(),
      insuranceContractDate: this.insuranceContractDate().trim() || undefined,
      insuranceCost: insCost === undefined ? undefined : insCost,
      ...(gpsHasContent
        ? {
            hasGps: true,
            gpsProviderBrand: this.gpsProviderBrand().trim() || undefined,
            gpsPaymentCadence: gpsCadenceLabel,
            gpsPaymentMethod: this.gpsPaymentMethod().trim() || undefined,
            gpsInvoiceRequired: this.gpsInvoiceRequired(),
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
        transportType: this.transportType().trim() || undefined,
        capacityKg,
        capacityTons,
        motorNumber,
        trailerBrandAbbr: brandAbbr || undefined,
        trailerYear: year,
        serialNumber: this.serialNumber().trim().toUpperCase() || undefined,
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
