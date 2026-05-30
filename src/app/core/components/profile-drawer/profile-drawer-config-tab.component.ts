import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { CompaniesService, type CompanyProfile } from '@core/services/api/companies';
import { SessionService } from '@core/services/state/session';
import { formatOperationalSettingChangedAt } from '@core/services/state/user-preferences';
import {
  cityMunicipalityLineFromSettlement,
  formatSettlementOptionLabel,
  geocodeQueryFromSettlement,
  localityKey,
  normalizeMxPostalCodeDigits,
} from '@features/trips/utils/mx-postal-settlement';
import {
  MAINTENANCE_DATE_PERIOD_OPTIONS,
  type MaintenanceDatePeriod,
} from '@shared/models/company-operational-settings.models';
import {
  MexicoPostalCodeService,
  type MxPostalSettlement,
} from '@shared/services/mexico-postal-code.service';
import { PhotonPlaceSearchService } from '@shared/services/photon-place-search.service';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent } from '@shared/ui/to-select/to-select.component';

type DisableConfirmKind = 'km' | 'date' | 'intelligent' | 'diesel';

@Component({
  selector: 'app-profile-drawer-config-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToButtonComponent, ToIconComponent, ToInputComponent, ToSelectComponent],
  templateUrl: './profile-drawer-config-tab.component.html',
  styleUrls: [
    '../../../features/fleet/components/fleet-drawer.shared.scss',
    '../../../features/fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    './profile-drawer-config-tab.component.scss',
    './profile-drawer.component.scss',
  ],
})
export class ProfileDrawerConfigTabComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  private readonly companies = inject(CompaniesService);
  private readonly sepomex = inject(MexicoPostalCodeService);
  private readonly photon = inject(PhotonPlaceSearchService);

  readonly maintDatePeriodOptions = [...MAINTENANCE_DATE_PERIOD_OPTIONS];
  readonly saving = signal(false);

  readonly draftKmEnabled = model(false);
  readonly draftKmInterval = model('');
  readonly draftDateEnabled = model(false);
  readonly draftDatePeriod = model<MaintenanceDatePeriod>('semiannual');
  readonly draftIntelligentEnabled = model(false);
  readonly draftDieselControlEnabled = model(true);

  readonly centerCp = model('');
  readonly centerLocalityKey = model('');
  readonly centerSettlements = signal<MxPostalSettlement[]>([]);
  readonly centerCpLoading = signal(false);
  readonly centerLatitude = signal<number | null>(null);
  readonly centerLongitude = signal<number | null>(null);

  readonly pendingDisableKind = signal<DisableConfirmKind | null>(null);
  private readonly disableConfirmDialog = viewChild<ElementRef<HTMLDialogElement>>(
    'disableConfirmDialog',
  );

  readonly centerLocalityOptions = computed(() =>
    this.centerSettlements().map((s) => ({
      value: localityKey(s),
      label: formatSettlementOptionLabel(s),
    })),
  );

  readonly centerCityLine = computed(() => {
    const saved = this.session.operationalCenterCityMunicipality()?.trim() ?? '';
    const rows = this.centerSettlements();
    if (rows.length > 0) {
      const key = this.centerLocalityKey();
      const row =
        (key ? rows.find((s) => localityKey(s) === key) : undefined) ?? rows[0];
      return cityMunicipalityLineFromSettlement(row);
    }
    return saved;
  });

  readonly centerLocalityLabel = computed(() => {
    const key = this.centerLocalityKey().trim();
    const rows = this.centerSettlements();
    if (key && rows.length > 0) {
      const row = rows.find((s) => localityKey(s) === key);
      if (row) {
        return formatSettlementOptionLabel(row);
      }
    }
    return this.session.operationalCenterLocality()?.trim() ?? '';
  });

  readonly showCenterCoords = computed(
    () => this.centerLatitude() != null && this.centerLongitude() != null,
  );

  /** Centro operativo: el usuario está editando CP (muestra select SEPOMex). */
  readonly centerCpEditing = signal(false);
  /** Evita geocodificar mientras se muestran coords guardadas en sesión. */
  private readonly centerCoordsFromDb = signal(false);

  readonly centerLatDisplay = computed(() => this.formatCoord(this.centerLatitude()));
  readonly centerLonDisplay = computed(() => this.formatCoord(this.centerLongitude()));

  constructor() {
    this.loadDraftFromSession();
  }

  kmStatusLabel(): string {
    return this.controlStatusLabel(
      this.session.maintenanceKmControlEnabled(),
      this.session.maintenanceKmControlChangedAt(),
    );
  }

  dateStatusLabel(): string {
    return this.controlStatusLabel(
      this.session.maintenanceDateControlEnabled(),
      this.session.maintenanceDateControlChangedAt(),
    );
  }

  intelligentStatusLabel(): string {
    return this.controlStatusLabel(
      this.session.operationalAnalysisEnabled(),
      this.session.operationalAnalysisChangedAt(),
    );
  }

  dieselControlStatusLabel(): string {
    return this.controlStatusLabel(
      this.session.dieselControlEnabled(),
      this.session.dieselControlChangedAt(),
    );
  }

  toggleDraftKm(): void {
    const next = !this.draftKmEnabled();
    if (!next && this.draftKmEnabled()) {
      this.pendingDisableKind.set('km');
      queueMicrotask(() => this.disableConfirmDialog()?.nativeElement.showModal());
      return;
    }
    this.draftKmEnabled.set(next);
  }

  toggleDraftDate(): void {
    const next = !this.draftDateEnabled();
    if (!next && this.draftDateEnabled()) {
      this.pendingDisableKind.set('date');
      queueMicrotask(() => this.disableConfirmDialog()?.nativeElement.showModal());
      return;
    }
    this.draftDateEnabled.set(next);
  }

  toggleDraftIntelligent(): void {
    const next = !this.draftIntelligentEnabled();
    if (!next && this.draftIntelligentEnabled()) {
      this.pendingDisableKind.set('intelligent');
      queueMicrotask(() => this.disableConfirmDialog()?.nativeElement.showModal());
      return;
    }
    this.draftIntelligentEnabled.set(next);
  }

  toggleDraftDieselControl(): void {
    const next = !this.draftDieselControlEnabled();
    if (!next && this.draftDieselControlEnabled()) {
      this.pendingDisableKind.set('diesel');
      queueMicrotask(() => this.disableConfirmDialog()?.nativeElement.showModal());
      return;
    }
    this.draftDieselControlEnabled.set(next);
  }

  closeDisableConfirm(): void {
    this.pendingDisableKind.set(null);
    this.disableConfirmDialog()?.nativeElement.close();
  }

  confirmDisableControl(): void {
    const kind = this.pendingDisableKind();
    if (kind === 'km') {
      this.draftKmEnabled.set(false);
      this.draftKmInterval.set('');
    } else if (kind === 'date') {
      this.draftDateEnabled.set(false);
    } else if (kind === 'intelligent') {
      this.draftIntelligentEnabled.set(false);
    } else if (kind === 'diesel') {
      this.draftDieselControlEnabled.set(false);
    }
    this.closeDisableConfirm();
  }

  onCenterCpBlur(): void {
    const digits = normalizeMxPostalCodeDigits(this.centerCp());
    if (digits !== this.centerCp()) {
      this.centerCp.set(digits);
    }
    if (digits.length === 0) {
      this.clearCenterCpFields();
      return;
    }
    if (digits.length !== 5) {
      this.toast.show('El código postal debe tener 5 dígitos.', 'warning');
      return;
    }
    const savedCp = this.session.operationalCenterPostalCode()?.trim() ?? '';
    if (digits === savedCp) {
      return;
    }
    this.centerCpEditing.set(true);
    this.centerCoordsFromDb.set(false);
    this.centerLocalityKey.set('');
    this.centerLatitude.set(null);
    this.centerLongitude.set(null);
    this.fetchCenterCpSettlements(digits);
  }

  onCenterLocalityChange(value: string): void {
    this.centerLocalityKey.set(value);
    this.centerCoordsFromDb.set(false);
    this.geocodeSelectedSettlement();
  }

  onDraftDatePeriodChange(value: string): void {
    const period = value as MaintenanceDatePeriod;
    if (MAINTENANCE_DATE_PERIOD_OPTIONS.some((o) => o.value === period)) {
      this.draftDatePeriod.set(period);
    }
  }

  saveCompanyConfiguration(): void {
    const companyId = this.session.companyId();
    if (!companyId) {
      return;
    }
    const kmRaw = this.draftKmInterval().trim().replace(/,/g, '');
    const kmN = kmRaw === '' ? undefined : Number(kmRaw);
    if (
      this.draftKmEnabled() &&
      (kmN === undefined || !Number.isFinite(kmN) || kmN <= 0)
    ) {
      this.toast.show(
        'Activa el control por km e indica los kilómetros estándar entre servicios.',
        'warning',
      );
      return;
    }
    const cpDigits = normalizeMxPostalCodeDigits(this.centerCp());
    const localityKeyVal = this.centerLocalityKey().trim();
    const settlement = this.centerSettlements().find(
      (s) => localityKey(s) === localityKeyVal,
    );
    const savedCp = this.session.operationalCenterPostalCode()?.trim() ?? '';
    const useSavedCenter =
      cpDigits.length === 5 &&
      cpDigits === savedCp &&
      !localityKeyVal &&
      !!this.session.operationalCenterLocality()?.trim();
    if (cpDigits.length === 5 && !localityKeyVal && !useSavedCenter) {
      this.toast.show('Elige la localidad del centro operativo.', 'warning');
      return;
    }
    if (cpDigits.length === 5 && localityKeyVal && settlement == null && !useSavedCenter) {
      this.toast.show('La localidad del centro operativo no es válida.', 'warning');
      return;
    }
    const lat = this.centerLatitude();
    const lon = this.centerLongitude();
    const hasCoords = lat != null && lon != null;
    if (cpDigits.length === 5 && (localityKeyVal || useSavedCenter) && !hasCoords) {
      this.toast.show(
        'Espera a que se obtengan las coordenadas del centro operativo o revisa el CP.',
        'warning',
      );
      return;
    }

    this.saving.set(true);
    this.companies
      .updateOperationalSettings(companyId, {
        operationalAnalysisEnabled: this.draftIntelligentEnabled(),
        dieselControlEnabled: this.draftDieselControlEnabled(),
        maintenanceKmControlEnabled: this.draftKmEnabled(),
        maintenanceKmIntervalDefault: this.draftKmEnabled() ? kmN : undefined,
        maintenanceDateControlEnabled: this.draftDateEnabled(),
        maintenanceDatePeriodDefault: this.draftDateEnabled()
          ? this.draftDatePeriod()
          : undefined,
        operationalCenterPostalCode:
          cpDigits.length === 5 ? cpDigits : undefined,
        operationalCenterCityMunicipality: settlement
          ? cityMunicipalityLineFromSettlement(settlement)
          : useSavedCenter
            ? this.session.operationalCenterCityMunicipality() ?? undefined
            : undefined,
        operationalCenterLocality: settlement?.settlement
          ?? (useSavedCenter ? this.session.operationalCenterLocality() ?? undefined : undefined),
        operationalCenterSettlementConsId: settlement?.settlementConsId
          ?? (useSavedCenter
            ? this.session.operationalCenterSettlementConsId() ?? undefined
            : undefined),
        operationalCenterLatitude: lat ?? undefined,
        operationalCenterLongitude: lon ?? undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.applyCompanyResult(result),
        error: () => {
          this.saving.set(false);
          this.loadDraftFromSession();
          this.toast.show('No se pudo guardar la configuración de la empresa.', 'error');
        },
      });
  }

  private applyCompanyResult(result: CompanyProfile): void {
    this.session.syncCompanyOperationalSettings({
      operationalAnalysisEnabled: result.operationalAnalysisEnabled,
      operationalAnalysisChangedAt: result.operationalAnalysisChangedAt,
      dieselControlEnabled: result.dieselControlEnabled,
      dieselControlChangedAt: result.dieselControlChangedAt,
      maintenanceKmControlEnabled: result.maintenanceKmControlEnabled,
      maintenanceKmIntervalDefault: result.maintenanceKmIntervalDefault,
      maintenanceKmControlChangedAt: result.maintenanceKmControlChangedAt,
      maintenanceDateControlEnabled: result.maintenanceDateControlEnabled,
      maintenanceDatePeriodDefault: result.maintenanceDatePeriodDefault,
      maintenanceDateControlChangedAt: result.maintenanceDateControlChangedAt,
      operationalCenterPostalCode: result.operationalCenterPostalCode,
      operationalCenterCityMunicipality: result.operationalCenterCityMunicipality,
      operationalCenterLocality: result.operationalCenterLocality,
      operationalCenterSettlementConsId: result.operationalCenterSettlementConsId,
      operationalCenterLatitude: result.operationalCenterLatitude,
      operationalCenterLongitude: result.operationalCenterLongitude,
    });
    this.loadDraftFromSession();
    this.saving.set(false);
    this.toast.show('Configuración guardada.', 'success');
  }

  private loadDraftFromSession(): void {
    this.draftKmEnabled.set(this.session.maintenanceKmControlEnabled());
    const km = this.session.maintenanceKmIntervalDefault();
    this.draftKmInterval.set(
      km != null && Number.isFinite(km) && km > 0 ? String(Math.round(km)) : '',
    );
    this.draftDateEnabled.set(this.session.maintenanceDateControlEnabled());
    this.draftDatePeriod.set(
      this.session.maintenanceDatePeriodDefault() ?? 'semiannual',
    );
    this.draftIntelligentEnabled.set(this.session.operationalAnalysisEnabled());
    this.draftDieselControlEnabled.set(this.session.dieselControlEnabled());

    const cp = this.session.operationalCenterPostalCode()?.trim() ?? '';
    this.centerCp.set(cp);
    const savedLat = this.session.operationalCenterLatitude();
    const savedLon = this.session.operationalCenterLongitude();
    this.centerLocalityKey.set(
      this.session.operationalCenterSettlementConsId()?.trim() ||
        this.buildLocalityKeyFromSession(),
    );
    this.centerLatitude.set(savedLat);
    this.centerLongitude.set(savedLon);
    this.centerCoordsFromDb.set(
      cp.length === 5 &&
        savedLat != null &&
        savedLon != null &&
        !!this.session.operationalCenterLocality()?.trim(),
    );
    this.centerCpEditing.set(false);
    this.centerSettlements.set([]);
  }

  private fetchCenterCpSettlements(cpDigits: string): void {
    this.centerCpLoading.set(true);
    this.sepomex
      .lookupByPostalCode(cpDigits)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.centerCpLoading.set(false)),
      )
      .subscribe((rows) => {
        this.centerSettlements.set(rows);
        if (rows.length === 0) {
          this.centerLocalityKey.set('');
          this.centerLatitude.set(null);
          this.centerLongitude.set(null);
          this.centerCoordsFromDb.set(false);
          this.toast.show('Código postal no encontrado.', 'warning');
          return;
        }
        this.centerLocalityKey.set('');
        this.centerLatitude.set(null);
        this.centerLongitude.set(null);
        this.centerCoordsFromDb.set(false);
      });
  }

  private geocodeSelectedSettlement(): void {
    if (this.centerCoordsFromDb()) {
      return;
    }
    const cp = normalizeMxPostalCodeDigits(this.centerCp());
    const key = this.centerLocalityKey().trim();
    const settlement =
      key && this.centerSettlements().length > 0
        ? (this.centerSettlements().find((r) => localityKey(r) === key) ?? null)
        : null;
    if (!settlement || cp.length !== 5) {
      return;
    }
    this.photon
      .firstCoordinatesForMexicanSepomex(
        geocodeQueryFromSettlement(settlement, cp),
        {
          state: settlement.state,
          municipality: settlement.municipality,
          settlement: settlement.settlement,
        },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((coords) => {
        this.centerLatitude.set(coords?.lat ?? null);
        this.centerLongitude.set(coords?.lon ?? null);
      });
  }

  private clearCenterCpFields(): void {
    this.centerSettlements.set([]);
    this.centerLocalityKey.set('');
    this.centerLatitude.set(null);
    this.centerLongitude.set(null);
    this.centerCoordsFromDb.set(false);
    this.centerCpEditing.set(false);
  }

  private buildLocalityKeyFromSession(): string {
    const cp = this.session.operationalCenterPostalCode()?.trim() ?? '';
    const loc = this.session.operationalCenterLocality()?.trim() ?? '';
    const muni =
      this.session.operationalCenterCityMunicipality()?.split(',')[0]?.trim() ?? '';
    if (!cp || !loc) {
      return '';
    }
    return `${cp}|${loc}|${muni}`;
  }

  private controlStatusLabel(enabled: boolean, changedAt: string | null | undefined): string {
    const at = formatOperationalSettingChangedAt(changedAt ?? '');
    if (at === '—') {
      return enabled ? 'Activado' : 'Desactivado';
    }
    return enabled ? `Activado el ${at}` : `Desactivado el ${at}`;
  }

  private formatCoord(n: number | null): string {
    if (n == null || !Number.isFinite(n)) {
      return '—';
    }
    return new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 6,
      minimumFractionDigits: 0,
    }).format(n);
  }
}
