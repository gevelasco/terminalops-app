import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  model,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { syncCompanySettingsFromProfile } from '@core/components/profile-drawer/profile-drawer-company-settings.util';
import {
  CompaniesService,
  type PatchCompanyOperationalSettings,
} from '@core/services/api/companies';
import { SessionService } from '@core/services/state/session';
import {
  cityMunicipalityLineFromSettlement,
  formatSettlementOptionLabel,
  geocodeQueryFromSettlement,
  localityKey,
  normalizeMxPostalCodeDigits,
} from '@features/trips/utils/mx-postal-settlement';
import {
  MexicoPostalCodeService,
  type MxPostalSettlement,
} from '@shared/services/mexico-postal-code.service';
import { PhotonPlaceSearchService } from '@shared/services/photon-place-search.service';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent } from '@shared/ui/to-select/to-select.component';

@Component({
  selector: 'app-profile-drawer-operation-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToInputComponent, ToSelectComponent],
  templateUrl: './profile-drawer-operation-tab.component.html',
  styleUrls: [
    '../../../features/fleet/components/fleet-drawer.shared.scss',
    '../../../features/fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    './profile-drawer-operation-tab.component.scss',
    './profile-drawer.component.scss',
  ],
})
export class ProfileDrawerOperationTabComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  private readonly companies = inject(CompaniesService);
  private readonly sepomex = inject(MexicoPostalCodeService);
  private readonly photon = inject(PhotonPlaceSearchService);

  readonly saving = signal(false);

  readonly centerCp = model('');
  readonly centerName = model('');
  readonly centerLocalityKey = model('');
  readonly centerSettlements = signal<MxPostalSettlement[]>([]);
  readonly centerCpLoading = signal(false);
  readonly centerLatitude = signal<number | null>(null);
  readonly centerLongitude = signal<number | null>(null);

  /** Centro operativo: el usuario está editando CP (muestra select SEPOMex). */
  readonly centerCpEditing = signal(false);
  /** Evita geocodificar mientras se muestran coords guardadas en sesión. */
  private readonly centerCoordsFromDb = signal(false);

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

  readonly centerLatDisplay = computed(() => this.formatCoord(this.centerLatitude()));
  readonly centerLonDisplay = computed(() => this.formatCoord(this.centerLongitude()));

  constructor() {
    this.loadDraftFromSession();
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

  saveOperationSettings(): void {
    const companyId = this.session.companyId();
    if (!companyId) {
      return;
    }

    const patch = this.buildOperationPatch();
    if (!patch) {
      this.toast.show('No hay cambios en el centro operativo.', 'warning');
      return;
    }

    const locationErr = this.validateLocationPatch(patch);
    if (locationErr) {
      this.toast.show(locationErr, 'warning');
      return;
    }

    this.saving.set(true);
    this.companies
      .updateOperationalSettings(companyId, patch)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          syncCompanySettingsFromProfile(this.session, result);
          this.loadDraftFromSession();
          this.saving.set(false);
          this.toast.show('Centro operativo guardado.', 'success');
        },
        error: () => {
          this.saving.set(false);
          this.loadDraftFromSession();
          this.toast.show('No se pudo guardar el centro operativo.', 'error');
        },
      });
  }

  private buildOperationPatch(): PatchCompanyOperationalSettings | null {
    const patch: PatchCompanyOperationalSettings = {};
    const savedName = this.savedCenterName();
    const draftName = this.centerName().trim() || 'Centro Principal';
    if (draftName !== savedName) {
      patch.operationalCenterName = draftName;
    }

    if (!this.locationSectionDirty()) {
      return Object.keys(patch).length > 0 ? patch : null;
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
    const lat = this.centerLatitude();
    const lon = this.centerLongitude();

    if (cpDigits.length === 5) {
      patch.operationalCenterPostalCode = cpDigits;
    }
    patch.operationalCenterCityMunicipality = settlement
      ? cityMunicipalityLineFromSettlement(settlement)
      : useSavedCenter
        ? this.session.operationalCenterCityMunicipality() ?? undefined
        : undefined;
    patch.operationalCenterLocality =
      settlement?.settlement ??
      (useSavedCenter ? this.session.operationalCenterLocality() ?? undefined : undefined);
    patch.operationalCenterSettlementConsId =
      settlement?.settlementConsId ??
      (useSavedCenter
        ? this.session.operationalCenterSettlementConsId() ?? undefined
        : undefined);
    patch.operationalCenterLatitude = lat ?? undefined;
    patch.operationalCenterLongitude = lon ?? undefined;

    return Object.keys(patch).length > 0 ? patch : null;
  }

  private validateLocationPatch(patch: PatchCompanyOperationalSettings): string | null {
    if (patch.operationalCenterPostalCode === undefined) {
      return null;
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
      return 'Elige la localidad del centro operativo.';
    }
    if (cpDigits.length === 5 && localityKeyVal && settlement == null && !useSavedCenter) {
      return 'La localidad del centro operativo no es válida.';
    }

    const lat = this.centerLatitude();
    const lon = this.centerLongitude();
    const hasCoords = lat != null && lon != null;
    if (cpDigits.length === 5 && (localityKeyVal || useSavedCenter) && !hasCoords) {
      return 'Espera a que se obtengan las coordenadas del centro operativo o revisa el CP.';
    }

    return null;
  }

  private locationSectionDirty(): boolean {
    const savedCp = this.session.operationalCenterPostalCode()?.trim() ?? '';
    const cpDigits = normalizeMxPostalCodeDigits(this.centerCp());
    if (cpDigits !== savedCp) {
      return true;
    }
    if (this.centerCpEditing()) {
      return true;
    }
    const savedLocKey = this.savedLocalityKey();
    if (this.centerLocalityKey().trim() !== savedLocKey) {
      return true;
    }
    return false;
  }

  private savedCenterName(): string {
    return this.session.operationalCenterName()?.trim() || 'Centro Principal';
  }

  private savedLocalityKey(): string {
    return (
      this.session.operationalCenterSettlementConsId()?.trim() ||
      this.buildLocalityKeyFromSession()
    );
  }

  private loadDraftFromSession(): void {
    const cp = this.session.operationalCenterPostalCode()?.trim() ?? '';
    this.centerCp.set(cp);
    this.centerName.set(this.savedCenterName());
    const savedLat = this.session.operationalCenterLatitude();
    const savedLon = this.session.operationalCenterLongitude();
    this.centerLocalityKey.set(this.savedLocalityKey());
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
