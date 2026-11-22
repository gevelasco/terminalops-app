import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, finalize, of, switchMap } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { type PatchCompanyOperationalSettings } from '@core/services/api/companies';
import { SessionService } from '@core/services/state/session';
import { formatOperationalSettingChangedAt } from '@core/services/state/user-preferences';
import { parseMexicanCityMunicipalityLine } from '@features/clients/utils/destination-rate-state-resolve.util';
import {
  cityMunicipalityLineFromSettlement,
  formatSettlementOptionLabel,
  geocodeQueryFromSettlement,
  localityKey,
  municipalityFromSepomexSettlements,
  normalizeMxPostalCodeDigits,
} from '@features/trips/utils/mx-postal-settlement';
import {
  MexicoPostalCodeService,
  type MxPostalSettlement,
} from '@shared/services/mexico-postal-code.service';
import { PhotonPlaceSearchService } from '@shared/services/photon-place-search.service';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToSelectComponent } from '@shared/ui/to-select/to-select.component';

const OPERATIONAL_CENTER_TOOLTIP =
  'Ubicación base de la empresa para referencia operativa y cálculos de distancia.';

@Component({
  selector: 'app-profile-drawer-operation-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToIconComponent, ToInputComponent, ToSelectComponent],
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
  private readonly sepomex = inject(MexicoPostalCodeService);
  private readonly photon = inject(PhotonPlaceSearchService);

  /** Guardado unificado desde configuración → Controles. */
  readonly externalSaving = input(false);

  readonly fieldsDisabled = computed(
    () => this.externalSaving() || this.centerCpLoading(),
  );

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

  /** CP en curso: `switchMap` cancela consultas SEPOMex anteriores. */
  private readonly cpLookupRequest$ = new Subject<string>();
  /** Localidad elegida: `switchMap` cancela geocodificación Photon anterior. */
  private readonly geocodeRequest$ = new Subject<void>();

  readonly centerLocalityOptions = computed(() =>
    this.centerSettlements().map((s) => ({
      value: localityKey(s),
      label: formatSettlementOptionLabel(s),
    })),
  );

  readonly operationalCenterTooltip = OPERATIONAL_CENTER_TOOLTIP;

  readonly centerMunicipalityDisplay = computed(() =>
    this.resolveCenterMunicipalityDisplay(),
  );

  readonly centerStateDisplay = computed(() => this.resolveCenterStateDisplay());

  operationalCenterStatusLabel(): string {
    const configured = !!this.session.operationalCenterPostalCode()?.trim();
    const at = formatOperationalSettingChangedAt(
      this.session.operationalCenterChangedAt() ?? '',
    );
    if (!configured) {
      return 'Sin ubicación configurada';
    }
    if (at === '—') {
      return 'Ubicación configurada';
    }
    return `Actualizado el ${at}`;
  }

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

  readonly centerLatDisplay = computed(() => this.formatCoord(this.centerLatitude()));
  readonly centerLonDisplay = computed(() => this.formatCoord(this.centerLongitude()));

  constructor() {
    this.loadDraftFromSession();
    this.bindCpLookupPipeline();
    this.bindGeocodePipeline();
  }

  onCenterCpSearch(): void {
    if (this.externalSaving() || this.centerCpLoading()) {
      return;
    }
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
    this.cpLookupRequest$.next(digits);
  }

  onCenterLocalityChange(value: string): void {
    this.centerLocalityKey.set(value);
    this.centerCoordsFromDb.set(false);
    this.requestGeocodeForSelectedSettlement();
  }

  collectOperationPatch(): PatchCompanyOperationalSettings | null {
    return this.buildOperationPatch();
  }

  operationPatchError(patch: PatchCompanyOperationalSettings): string | null {
    return this.validateLocationPatch(patch);
  }

  reloadOperationFromSession(): void {
    this.loadDraftFromSession();
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

    const ctx = this.resolveCenterLocationDraft();

    if (ctx.cpDigits.length === 5) {
      patch.operationalCenterPostalCode = ctx.cpDigits;
    }
    patch.operationalCenterCityMunicipality = ctx.settlement
      ? cityMunicipalityLineFromSettlement(ctx.settlement)
      : ctx.useSavedCenter
        ? this.session.operationalCenterCityMunicipality() ?? undefined
        : undefined;
    patch.operationalCenterLocality =
      ctx.settlement?.settlement ??
      (ctx.useSavedCenter
        ? this.session.operationalCenterLocality() ?? undefined
        : undefined);
    patch.operationalCenterSettlementConsId =
      ctx.settlement?.settlementConsId ??
      (ctx.useSavedCenter
        ? this.session.operationalCenterSettlementConsId() ?? undefined
        : undefined);
    patch.operationalCenterLatitude = ctx.lat ?? undefined;
    patch.operationalCenterLongitude = ctx.lon ?? undefined;

    return Object.keys(patch).length > 0 ? patch : null;
  }

  private validateLocationPatch(patch: PatchCompanyOperationalSettings): string | null {
    if (patch.operationalCenterPostalCode === undefined) {
      return null;
    }

    const ctx = this.resolveCenterLocationDraft();

    if (ctx.cpDigits.length === 5 && !ctx.localityKeyVal && !ctx.useSavedCenter) {
      return 'Elige la localidad del centro operativo.';
    }
    if (
      ctx.cpDigits.length === 5 &&
      ctx.localityKeyVal &&
      ctx.settlement == null &&
      !ctx.useSavedCenter
    ) {
      return 'La localidad del centro operativo no es válida.';
    }

    const hasCoords = ctx.lat != null && ctx.lon != null;
    if (
      ctx.cpDigits.length === 5 &&
      (ctx.localityKeyVal || ctx.useSavedCenter) &&
      !hasCoords
    ) {
      return 'Espera a que se obtengan las coordenadas del centro operativo o revisa el CP.';
    }

    return null;
  }

  private resolveCenterLocationDraft(): {
    cpDigits: string;
    localityKeyVal: string;
    settlement: MxPostalSettlement | undefined;
    useSavedCenter: boolean;
    lat: number | null;
    lon: number | null;
  } {
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
    return {
      cpDigits,
      localityKeyVal,
      settlement,
      useSavedCenter,
      lat: this.centerLatitude(),
      lon: this.centerLongitude(),
    };
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

  private bindCpLookupPipeline(): void {
    this.cpLookupRequest$
      .pipe(
        switchMap((cpDigits) => {
          this.centerCpLoading.set(true);
          return this.sepomex.lookupByPostalCode(cpDigits).pipe(
            catchError(() => of([] as MxPostalSettlement[])),
            finalize(() => this.centerCpLoading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
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

  private bindGeocodePipeline(): void {
    this.geocodeRequest$
      .pipe(
        switchMap(() => {
          if (this.centerCoordsFromDb()) {
            return EMPTY;
          }
          const cp = normalizeMxPostalCodeDigits(this.centerCp());
          const key = this.centerLocalityKey().trim();
          const settlement =
            key && this.centerSettlements().length > 0
              ? (this.centerSettlements().find((r) => localityKey(r) === key) ?? null)
              : null;
          if (!settlement || cp.length !== 5) {
            return EMPTY;
          }
          return this.photon
            .firstCoordinatesForMexicanSepomex(
              geocodeQueryFromSettlement(settlement, cp),
              {
                state: settlement.state,
                municipality: settlement.municipality,
                settlement: settlement.settlement,
              },
            )
            .pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((coords) => {
        this.centerLatitude.set(coords?.lat ?? null);
        this.centerLongitude.set(coords?.lon ?? null);
      });
  }

  private requestGeocodeForSelectedSettlement(): void {
    if (this.centerCoordsFromDb()) {
      return;
    }
    this.geocodeRequest$.next();
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

  private selectedSettlementRow(): MxPostalSettlement | undefined {
    const rows = this.centerSettlements();
    if (rows.length === 0) {
      return undefined;
    }
    const key = this.centerLocalityKey().trim();
    return (
      (key ? rows.find((s) => localityKey(s) === key) : undefined) ?? rows[0]
    );
  }

  private resolveCenterMunicipalityDisplay(): string {
    const row = this.selectedSettlementRow();
    if (row) {
      const fromLoc = municipalityFromSepomexSettlements(
        this.centerSettlements(),
        row.settlement,
      );
      if (fromLoc) {
        return fromLoc;
      }
      return (row.municipality.trim() || row.city.trim()) || '—';
    }
    const saved = this.session.operationalCenterCityMunicipality()?.trim() ?? '';
    if (!saved) {
      return '—';
    }
    const { municipality } = parseMexicanCityMunicipalityLine(saved);
    return municipality || '—';
  }

  private resolveCenterStateDisplay(): string {
    const row = this.selectedSettlementRow();
    if (row?.state.trim()) {
      return row.state.trim();
    }
    const saved = this.session.operationalCenterCityMunicipality()?.trim() ?? '';
    if (!saved) {
      return '—';
    }
    const { state } = parseMexicanCityMunicipalityLine(saved);
    return state || '—';
  }
}
