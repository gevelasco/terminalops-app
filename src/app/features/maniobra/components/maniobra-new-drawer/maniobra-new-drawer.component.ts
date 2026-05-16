import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ASSIGNABLE_EQUIPMENT_OPTIONS } from '@app/mock-data/assignable-equipment';
import { formatUnitTrailerOperationalId } from '@app/sim-db/utils/unit-label';
import { ToastService } from '@core/notifications/toast.service';
import { CreateTripPayload } from '@features/maniobra/data/maniobra.repository';
import { trackFileEntry } from '@features/fleet/utils/list-trackers';
import { dateTimeLocalValueToIso } from '@features/maniobra/utils/datetime-local';
import {
  cityMunicipalityLineFromSettlement,
  formatLocationLabelFromSettlement,
  formatSettlementOptionLabel,
  geocodeQueryFromSettlement,
  localityKey,
  normalizeMxPostalCodeDigits,
} from '@features/maniobra/utils/mx-postal-settlement';
import {
  formatRouteKmEsMx,
  maneuverKindFromRouteKm,
} from '@features/maniobra/utils/maniobra-route-display';
import { operatorLicenseExpiresLabelFromIso } from '@features/maniobra/utils/operator-license-display';
import {
  parseNonNegativeNumber,
  stripGroupedNumberInput,
} from '@features/maniobra/utils/parse-non-negative';
import { OperatorRepository } from '@features/operators/data/operator.repository';
import { UnitRepository } from '@features/fleet/data/unit.repository';
import {
  Operator,
  TripContainerType,
  TripLoadType,
} from '@shared/models/logistics.models';
import {
  LatLon,
  OsrmDrivingRouteService,
} from '@shared/services/osrm-driving-route.service';
import {
  MexicoPostalCodeService,
  type MxPostalSettlement,
} from '@shared/services/mexico-postal-code.service';
import { PhotonPlaceSearchService } from '@shared/services/photon-place-search.service';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSelectComponent,
  ToSelectOption,
} from '@shared/ui/to-select/to-select.component';
import { ToDrawerSkeletonComponent } from '@shared/ui/to-drawer-skeleton/to-drawer-skeleton.component';
import { ToClientInputComponent } from '@shared/ui/to-client-input/to-client-input.component';
import { ToOperatorInputComponent } from '@shared/ui/to-operator-input/to-operator-input.component';
import { combineLatest, EMPTY, forkJoin, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';

@Component({
  selector: 'app-maniobra-new-drawer',
  standalone: true,
  imports: [
    FormsModule,
    ToButtonComponent,
    ToIconButtonComponent,
    ToInputComponent,
    ToSelectComponent,
    ToClientInputComponent,
    ToOperatorInputComponent,
    ToDrawerSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maniobra-new-drawer.component.html',
  styleUrl: './maniobra-new-drawer.component.scss',
})
export class ManiobraNewDrawerComponent {
  readonly trackFileEntry = trackFileEntry;

  private readonly doc = inject(DOCUMENT);
  private readonly osrm = inject(OsrmDrivingRouteService);
  private readonly photon = inject(PhotonPlaceSearchService);
  private readonly sepomex = inject(MexicoPostalCodeService);
  private readonly toast = inject(ToastService);
  private readonly operatorsRepo = inject(OperatorRepository);
  private readonly unitsRepo = inject(UnitRepository);

  readonly dismiss = output<void>();
  readonly saved = output<CreateTripPayload>();

  /** Escaneos / fotos adjuntos (solo en cliente hasta envío al backend). */
  readonly attachedFiles = signal<File[]>([]);

  /** Texto de ruta (origen/destino) derivado de CP + localidad + geocodificación. */
  readonly origin = model('');
  readonly destination = model('');

  readonly originCp = model('');
  readonly destinationCp = model('');

  readonly originSettlements = signal<MxPostalSettlement[]>([]);
  readonly destinationSettlements = signal<MxPostalSettlement[]>([]);

  readonly originLocalityKey = model('');
  readonly destinationLocalityKey = model('');

  readonly originCpLoading = signal(false);
  readonly destinationCpLoading = signal(false);

  readonly originCoords = signal<LatLon | null>(null);
  readonly destinationCoords = signal<LatLon | null>(null);

  /** Distancia por carretera (OSRM), solo si hay coordenadas de ambos puntos. */
  readonly routeKm = signal<number | null>(null);
  readonly routeLoading = signal(false);
  /** Solo fallo de OSRM (ruta), no de Photon. */
  readonly routeFailed = signal(false);
  /** Photon sin hit cuando el par origen/destino ya estaba completo en formulario. */
  readonly originGeocodeFailed = signal(false);
  readonly destinationGeocodeFailed = signal(false);
  readonly operationType = model('sencillo');
  readonly loadType = model<TripLoadType>('vacio');
  readonly containerType = model<TripContainerType>('na');
  readonly approximateWeightTons = model('');
  readonly dieselLiters = model('');
  readonly dieselAmount = model('');
  readonly casetasAmount = model('');
  readonly operatorQuota = model('');
  readonly clientCharge = model('');
  readonly creditDays = model('');
  readonly requiresInvoice = model(false);
  readonly paymentMethod = model<string>('cash');
  readonly assignedOperatorId = model('');
  /** Catálogo para enriquecer UI (licencia) al elegir operador. */
  readonly operatorsCatalog = signal<Operator[]>([]);
  readonly unitId = model('');
  /** Valores internos de `ASSIGNABLE_EQUIPMENT_OPTIONS`; en Full se usan dos filas. */
  readonly equipmentPrimary = model('');
  readonly equipmentSecondary = model('');
  /** `yyyy-mm-ddTHH:mm` para datetime-local */
  readonly departureDateTime = model('');
  readonly arrivalDateTime = model('');
  readonly clientName = model('');
  readonly clientId = model('');

  /**
   * Si es falso, la maniobra no registra cliente/cobro (p. ej. unidades propias).
   * Al activarse, se muestran y validan los campos de la sección.
   */
  readonly includeClientBilling = model(false);

  readonly equipmentOptions = ASSIGNABLE_EQUIPMENT_OPTIONS;

  readonly equipmentPlaceholder =
    'Porta contenedor, plataforma, góndola, etc.';

  /** Full → dos equipos obligatorios; sencillo/plana → uno. */
  readonly isFullOperation = computed(() => this.operationType() === 'full');

  readonly operationOptions: ToSelectOption[] = [
    { value: 'sencillo', label: 'Sencillo' },
    { value: 'full', label: 'Full' },
    { value: 'plana', label: 'Plana' },
  ];

  readonly loadTypeOptions: ToSelectOption[] = [
    { value: 'vacio', label: 'Vacío' },
    { value: 'lleno', label: 'Lleno' },
  ];

  readonly containerTypeOptions: ToSelectOption[] = [
    { value: '20ft', label: '20 pies' },
    { value: '40ft', label: '40 pies' },
    { value: '40hc', label: '40 pies HC (High Cube)' },
    { value: 'na', label: 'N/A' },
  ];

  readonly paymentMethodOptions: ToSelectOption[] = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'transfer', label: 'Transferencia' },
    { value: 'check', label: 'Cheque' },
  ];

  readonly unitPlaceholder = 'Tractocamión';

  readonly unitOptions = signal<ToSelectOption[]>([]);
  readonly drawerLoading = signal(true);

  /** CP + localidad válidos en origen y destino (listo para OSRM / mensajes de error de par). */
  readonly routePairReady = computed(() => {
    const oKey = this.originLocalityKey().trim();
    const dKey = this.destinationLocalityKey().trim();
    const oCp = normalizeMxPostalCodeDigits(this.originCp());
    const dCp = normalizeMxPostalCodeDigits(this.destinationCp());
    if (oCp.length !== 5 || dCp.length !== 5 || !oKey || !dKey) {
      return false;
    }
    const oRows = this.originSettlements();
    const dRows = this.destinationSettlements();
    const oS = oRows.find((r) => localityKey(r) === oKey) ?? null;
    const dS = dRows.find((r) => localityKey(r) === dKey) ?? null;
    return !!(oS && dS);
  });

  /** Valor mostrado en el campo solo lectura «Distancia» (OSRM, no Photon). */
  readonly distanceInputValue = computed(() => {
    if (this.routeLoading()) {
      return 'Calculando…';
    }
    const km = this.routeKm();
    if (km !== null) {
      return `${formatRouteKmEsMx(km)} km`;
    }
    if (this.routeFailed() && this.originCoords() && this.destinationCoords()) {
      return 'No disponible (ruta)';
    }
    if (
      this.routePairReady() &&
      (this.originGeocodeFailed() || this.destinationGeocodeFailed())
    ) {
      return 'No disponible (ubicación)';
    }
    return '';
  });

  /** Local si distancia ≤ 25 km; Foránea si mayor a 25 km (ruta OSRM). */
  readonly maneuverKindInputValue = computed(() => {
    if (this.routeLoading()) {
      return 'Calculando…';
    }
    const km = this.routeKm();
    if (km === null) {
      return '';
    }
    return km <= 25 ? 'Local' : 'Foránea';
  });

  readonly originLocalitySelectOptions = computed<ToSelectOption[]>(() =>
    this.originSettlements().map((row) => ({
      value: localityKey(row),
      label: formatSettlementOptionLabel(row),
    })),
  );

  readonly destinationLocalitySelectOptions = computed<ToSelectOption[]>(() =>
    this.destinationSettlements().map((row) => ({
      value: localityKey(row),
      label: formatSettlementOptionLabel(row),
    })),
  );

  readonly originCityLine = computed(() => {
    const rows = this.originSettlements();
    if (rows.length === 0) {
      return '';
    }
    const key = this.originLocalityKey();
    const s = rows.find((r) => localityKey(r) === key) ?? rows[0];
    return cityMunicipalityLineFromSettlement(s);
  });

  readonly destinationCityLine = computed(() => {
    const rows = this.destinationSettlements();
    if (rows.length === 0) {
      return '';
    }
    const key = this.destinationLocalityKey();
    const s = rows.find((r) => localityKey(r) === key) ?? rows[0];
    return cityMunicipalityLineFromSettlement(s);
  });

  readonly assignedOperator = computed(() => {
    const id = this.assignedOperatorId().trim();
    if (!id) {
      return null;
    }
    return this.operatorsCatalog().find((o) => o.id === id) ?? null;
  });

  readonly operatorLicenseReadonly = computed(
    () => this.assignedOperator()?.licenseNumber?.trim() ?? '',
  );

  readonly operatorLicenseExpiresReadonly = computed(() => {
    const iso = this.assignedOperator()?.licenseExpiresOn?.trim();
    if (!iso) {
      return '';
    }
    return operatorLicenseExpiresLabelFromIso(iso);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.doc.body.style.overflow = '';
    });
    this.doc.body.style.overflow = 'hidden';

    forkJoin({
      operators: this.operatorsRepo.list().pipe(catchError(() => of([] as Operator[]))),
      units: this.unitsRepo.list().pipe(catchError(() => of([]))),
    })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ({ operators, units }) => {
          this.operatorsCatalog.set(operators);
          this.unitOptions.set(
            [...units]
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((u) => ({
                value: u.id,
                label: formatUnitTrailerOperationalId(u),
              })),
          );
          this.drawerLoading.set(false);
        },
        error: () => {
          this.operatorsCatalog.set([]);
          this.unitOptions.set([]);
          this.drawerLoading.set(false);
        },
      });

    effect(() => {
      if (this.operationType() !== 'full') {
        this.equipmentSecondary.set('');
      }
    });

    combineLatest([
      toObservable(this.originLocalityKey),
      toObservable(this.originSettlements),
      toObservable(this.originCp),
      toObservable(this.destinationLocalityKey),
    ])
      .pipe(
        debounceTime(200),
        map(([oKey, oRows, rawOcp, dKeyPeer]) => {
          const oCp = normalizeMxPostalCodeDigits(rawOcp);
          const oS =
            oKey && oRows.length > 0
              ? (oRows.find((r) => localityKey(r) === oKey) ?? null)
              : null;
          return { oKey, oRows, oCp, oS, dKeyPeer };
        }),
        distinctUntilChanged(
          (a, b) =>
            a.oKey === b.oKey &&
            a.oCp === b.oCp &&
            a.dKeyPeer === b.dKeyPeer &&
            a.oRows.length === b.oRows.length &&
            a.oRows.map((r) => localityKey(r)).join('|') ===
              b.oRows.map((r) => localityKey(r)).join('|'),
        ),
        tap(({ oS, oKey, oRows, oCp }) => {
          const originGeoReady = !!(oKey && oS && oCp.length === 5);
          if (!originGeoReady) {
            this.originCoords.set(null);
            this.routeKm.set(null);
            this.routeLoading.set(false);
            this.routeFailed.set(false);
            this.originGeocodeFailed.set(false);
          }
          if (oS && oCp.length === 5) {
            this.origin.set(formatLocationLabelFromSettlement(oS, oCp));
          } else if (!oKey || oRows.length === 0) {
            this.origin.set('');
          }
        }),
        switchMap(({ oS, oKey, oCp }) => {
          if (!oKey || !oS || oCp.length !== 5) {
            return EMPTY;
          }
          return this.photon
            .firstCoordinatesForMexicanSepomex(geocodeQueryFromSettlement(oS, oCp), {
              state: oS.state,
              municipality: oS.municipality,
              settlement: oS.settlement,
            })
            .pipe(
              tap((ll) => {
                this.originCoords.set(ll);
                if (!ll) {
                  this.routeKm.set(null);
                  if (this.routePairReady()) {
                    this.originGeocodeFailed.set(true);
                  } else {
                    this.originGeocodeFailed.set(false);
                  }
                } else {
                  this.originGeocodeFailed.set(false);
                }
              }),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    combineLatest([
      toObservable(this.destinationLocalityKey),
      toObservable(this.destinationSettlements),
      toObservable(this.destinationCp),
      toObservable(this.originLocalityKey),
    ])
      .pipe(
        debounceTime(200),
        map(([dKey, dRows, rawDcp, oKeyPeer]) => {
          const dCp = normalizeMxPostalCodeDigits(rawDcp);
          const dS =
            dKey && dRows.length > 0
              ? (dRows.find((r) => localityKey(r) === dKey) ?? null)
              : null;
          return { dKey, dRows, dCp, dS, oKeyPeer };
        }),
        distinctUntilChanged(
          (a, b) =>
            a.dKey === b.dKey &&
            a.dCp === b.dCp &&
            a.oKeyPeer === b.oKeyPeer &&
            a.dRows.length === b.dRows.length &&
            a.dRows.map((r) => localityKey(r)).join('|') ===
              b.dRows.map((r) => localityKey(r)).join('|'),
        ),
        tap(({ dS, dKey, dRows, dCp }) => {
          const destGeoReady = !!(dKey && dS && dCp.length === 5);
          if (!destGeoReady) {
            this.destinationCoords.set(null);
            this.routeKm.set(null);
            this.routeLoading.set(false);
            this.routeFailed.set(false);
            this.destinationGeocodeFailed.set(false);
          }
          if (dS && dCp.length === 5) {
            this.destination.set(formatLocationLabelFromSettlement(dS, dCp));
          } else if (!dKey || dRows.length === 0) {
            this.destination.set('');
          }
        }),
        switchMap(({ dS, dKey, dCp }) => {
          if (!dKey || !dS || dCp.length !== 5) {
            return EMPTY;
          }
          return this.photon
            .firstCoordinatesForMexicanSepomex(geocodeQueryFromSettlement(dS, dCp), {
              state: dS.state,
              municipality: dS.municipality,
              settlement: dS.settlement,
            })
            .pipe(
              tap((ll) => {
                this.destinationCoords.set(ll);
                if (!ll) {
                  this.routeKm.set(null);
                  if (this.routePairReady()) {
                    this.destinationGeocodeFailed.set(true);
                  } else {
                    this.destinationGeocodeFailed.set(false);
                  }
                } else {
                  this.destinationGeocodeFailed.set(false);
                }
              }),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    const sameLatLon = (a: LatLon | null, b: LatLon | null): boolean => {
      if (a === b) {
        return true;
      }
      if (!a || !b) {
        return false;
      }
      return a.lat === b.lat && a.lon === b.lon;
    };

    combineLatest([toObservable(this.originCoords), toObservable(this.destinationCoords)])
      .pipe(
        debounceTime(100),
        distinctUntilChanged(([oa, da], [ob, db]) => sameLatLon(oa, ob) && sameLatLon(da, db)),
        tap(([o, d]) => {
          if (!o || !d) {
            this.routeKm.set(null);
            this.routeLoading.set(false);
          }
        }),
        filter((pair): pair is [LatLon, LatLon] => {
          const [o, d] = pair;
          return !!o && !!d;
        }),
        switchMap(([o, d]) => {
          this.routeLoading.set(true);
          this.routeFailed.set(false);
          return this.osrm.drivingKm(o, d).pipe(
            map((km) => ({ km, failed: km === null })),
            catchError(() => of({ km: null, failed: true })),
            finalize(() => this.routeLoading.set(false)),
          );
        }),
        tap((r) => {
          if (r !== null && typeof r === 'object' && 'km' in r) {
            const box = r as { km: number | null; failed: boolean };
            this.routeKm.set(box.km);
            this.routeFailed.set(box.failed);
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    toObservable(this.originCp)
      .pipe(
        map(() => normalizeMxPostalCodeDigits(this.originCp())),
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((cpDigits) => {
          if (cpDigits.length !== 5) {
            this.originCpLoading.set(false);
            this.originSettlements.set([]);
            this.originLocalityKey.set('');
            this.origin.set('');
            this.originCoords.set(null);
            return EMPTY;
          }
          this.originCpLoading.set(true);
          return this.sepomex.lookupByPostalCode(cpDigits).pipe(
            tap((rows) => {
              this.originSettlements.set(rows);
              if (rows.length === 0) {
                this.originLocalityKey.set('');
                this.origin.set('');
                this.originCoords.set(null);
                this.toast.show('Código postal de origen no encontrado.', 'warning');
              } else {
                this.originLocalityKey.set('');
              }
            }),
            finalize(() => this.originCpLoading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    toObservable(this.destinationCp)
      .pipe(
        map(() => normalizeMxPostalCodeDigits(this.destinationCp())),
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((cpDigits) => {
          if (cpDigits.length !== 5) {
            this.destinationCpLoading.set(false);
            this.destinationSettlements.set([]);
            this.destinationLocalityKey.set('');
            this.destination.set('');
            this.destinationCoords.set(null);
            return EMPTY;
          }
          this.destinationCpLoading.set(true);
          return this.sepomex.lookupByPostalCode(cpDigits).pipe(
            tap((rows) => {
              this.destinationSettlements.set(rows);
              if (rows.length === 0) {
                this.destinationLocalityKey.set('');
                this.destination.set('');
                this.destinationCoords.set(null);
                this.toast.show('Código postal de destino no encontrado.', 'warning');
              } else {
                this.destinationLocalityKey.set('');
              }
            }),
            finalize(() => this.destinationCpLoading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }

  onDocumentsSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    if (list.length === 0) {
      return;
    }
    this.attachedFiles.update((prev) => [...prev, ...list]);
    input.value = '';
  }

  removeAttachedFile(index: number): void {
    this.attachedFiles.update((prev) => prev.filter((_, i) => i !== index));
  }

  private parseRequiredNonNegativeNumber(raw: string, fieldLabel: string): number | null {
    const s = stripGroupedNumberInput(raw);
    if (s === '') {
      this.toast.show(`El campo «${fieldLabel}» es obligatorio.`, 'warning');
      return null;
    }
    const n = parseNonNegativeNumber(raw);
    if (n === null) {
      this.toast.show(`«${fieldLabel}» no tiene un valor numérico válido.`, 'warning');
      return null;
    }
    return n;
  }

  private parseCreditDays(raw: string): number {
    const t = raw.trim();
    if (t === '') {
      return 0;
    }
    const n = Number.parseInt(t, 10);
    if (!Number.isFinite(n) || n < 0) {
      return 0;
    }
    return n;
  }

  private normalizePaymentMethod(v: string): 'cash' | 'transfer' | 'check' {
    if (v === 'transfer' || v === 'check') {
      return v;
    }
    return 'cash';
  }

  private labelForEquipmentValue(value: string): string {
    const v = value.trim();
    if (!v) {
      return '';
    }
    const row = this.equipmentOptions.find((o) => o.value === v);
    return row?.label ?? v;
  }

  private toastIfRequiredEmpty(value: string, fieldLabel: string): boolean {
    if (value.trim() === '') {
      this.toast.show(`El campo «${fieldLabel}» es obligatorio.`, 'warning');
      return true;
    }
    return false;
  }

  private toastIfInvalidNonNegativeNumber(raw: string, fieldLabel: string): boolean {
    const s = stripGroupedNumberInput(raw);
    if (s === '') {
      this.toast.show(`El campo «${fieldLabel}» es obligatorio.`, 'warning');
      return true;
    }
    const n = parseNonNegativeNumber(raw);
    if (n === null) {
      this.toast.show(`«${fieldLabel}» no tiene un valor numérico válido.`, 'warning');
      return true;
    }
    return false;
  }

  private maybeToastDateOrder(): void {
    const depIso = dateTimeLocalValueToIso(this.departureDateTime());
    const arrIso = dateTimeLocalValueToIso(this.arrivalDateTime());
    if (!depIso || !arrIso) {
      return;
    }
    if (new Date(arrIso).getTime() <= new Date(depIso).getTime()) {
      this.toast.show(
        'La llegada debe ser posterior a la salida; no puede ser la misma fecha y hora.',
        'warning',
      );
    }
  }

  onOriginCpBlur(): void {
    const digits = normalizeMxPostalCodeDigits(this.originCp());
    if (digits !== this.originCp()) {
      this.originCp.set(digits);
    }
    if (digits.length === 0) {
      this.toast.show('Indica el código postal de origen (5 dígitos).', 'warning');
      return;
    }
    if (digits.length !== 5) {
      this.toast.show('El código postal de origen debe tener 5 dígitos.', 'warning');
    }
  }

  onDestinationCpBlur(): void {
    const digits = normalizeMxPostalCodeDigits(this.destinationCp());
    if (digits !== this.destinationCp()) {
      this.destinationCp.set(digits);
    }
    if (digits.length === 0) {
      this.toast.show('Indica el código postal de destino (5 dígitos).', 'warning');
      return;
    }
    if (digits.length !== 5) {
      this.toast.show('El código postal de destino debe tener 5 dígitos.', 'warning');
    }
  }

  onClientBlur(): void {
    if (!this.includeClientBilling()) {
      return;
    }
    this.toastIfRequiredEmpty(this.clientName(), 'Cliente');
  }

  onUnitBlur(): void {
    if (this.unitId().trim() === '') {
      this.toast.show('Selecciona una unidad.', 'warning');
    }
  }

  onEquipmentPrimaryBlur(): void {
    if (this.equipmentPrimary().trim() === '') {
      this.toast.show('Selecciona el equipo asignado.', 'warning');
    }
  }

  onEquipmentSecondaryBlur(): void {
    if (this.operationType() !== 'full') {
      return;
    }
    if (this.equipmentSecondary().trim() === '') {
      this.toast.show('En configuración Full debes elegir dos equipos.', 'warning');
    }
  }

  onDepartureBlur(): void {
    const t = this.departureDateTime().trim();
    if (!t) {
      this.toast.show('Indica fecha y hora de salida.', 'warning');
      this.maybeToastDateOrder();
      return;
    }
    if (!dateTimeLocalValueToIso(t)) {
      this.toast.show('La fecha y hora de salida no son válidas.', 'warning');
      return;
    }
    this.maybeToastDateOrder();
  }

  onArrivalBlur(): void {
    const t = this.arrivalDateTime().trim();
    if (!t) {
      this.toast.show('Indica fecha y hora de llegada.', 'warning');
      this.maybeToastDateOrder();
      return;
    }
    if (!dateTimeLocalValueToIso(t)) {
      this.toast.show('La fecha y hora de llegada no son válidas.', 'warning');
      return;
    }
    this.maybeToastDateOrder();
  }

  onDieselLitersBlur(): void {
    this.toastIfInvalidNonNegativeNumber(this.dieselLiters(), 'Diesel (litros)');
  }

  onDieselAmountBlur(): void {
    this.toastIfInvalidNonNegativeNumber(this.dieselAmount(), 'Diesel (monto)');
  }

  onCasetasBlur(): void {
    this.toastIfInvalidNonNegativeNumber(this.casetasAmount(), 'Casetas');
  }

  onOperatorQuotaBlur(): void {
    this.toastIfInvalidNonNegativeNumber(this.operatorQuota(), 'Operador');
  }

  onAssignedOperatorBlur(): void {
    if (this.assignedOperatorId().trim() === '') {
      this.toast.show('Selecciona un operador disponible.', 'warning');
    }
  }

  onClientChargeBlur(): void {
    if (!this.includeClientBilling()) {
      return;
    }
    this.toastIfInvalidNonNegativeNumber(this.clientCharge(), 'Cobro');
  }

  submit(): void {
    const oCp = normalizeMxPostalCodeDigits(this.originCp());
    const dCp = normalizeMxPostalCodeDigits(this.destinationCp());
    if (oCp.length !== 5 || dCp.length !== 5) {
      this.toast.show(
        'Indica códigos postales de origen y destino (5 dígitos, solo México).',
        'warning',
      );
      return;
    }
    if (this.originSettlements().length === 0 || this.destinationSettlements().length === 0) {
      this.toast.show(
        'No hay datos SEPOMex para uno de los códigos postales; revisa e intenta de nuevo.',
        'warning',
      );
      return;
    }
    const okO = this.originSettlements().some(
      (r) => localityKey(r) === this.originLocalityKey(),
    );
    const okD = this.destinationSettlements().some(
      (r) => localityKey(r) === this.destinationLocalityKey(),
    );
    if (!okO || !okD) {
      this.toast.show('Selecciona la localidad de origen y la de destino.', 'warning');
      return;
    }

    const oKey = this.originLocalityKey().trim();
    const dKey = this.destinationLocalityKey().trim();
    const oS =
      this.originSettlements().find((r) => localityKey(r) === oKey) ?? null;
    const dS =
      this.destinationSettlements().find((r) => localityKey(r) === dKey) ?? null;
    if (!oS || !dS) {
      this.toast.show('Selecciona la localidad de origen y la de destino.', 'warning');
      return;
    }

    const origin = this.origin().trim();
    const destination = this.destination().trim();
    if (!origin || !destination) {
      this.toast.show(
        'No se pudo armar la ruta; espera un momento tras elegir CP y localidad.',
        'warning',
      );
      return;
    }

    const includeBilling = this.includeClientBilling();
    let client: string | undefined;
    if (includeBilling) {
      const c = this.clientName().trim();
      if (!c) {
        this.toast.show('Selecciona o escribe un cliente.', 'warning');
        return;
      }
      client = c;
    }

    const uid = this.unitId().trim();
    if (!uid) {
      this.toast.show('Selecciona una unidad.', 'warning');
      return;
    }

    const oprId = this.assignedOperatorId().trim();
    if (!oprId) {
      this.toast.show('Selecciona un operador disponible.', 'warning');
      return;
    }

    const config = this.operationType();
    const eq1 = this.equipmentPrimary().trim();
    const eq2 = this.equipmentSecondary().trim();

    if (config === 'full') {
      if (!eq1 || !eq2) {
        this.toast.show('En configuración Full debes elegir dos equipos.', 'warning');
        return;
      }
    } else if (!eq1) {
      this.toast.show('Selecciona el equipo asignado.', 'warning');
      return;
    }

    const depIso = dateTimeLocalValueToIso(this.departureDateTime());
    const arrIso = dateTimeLocalValueToIso(this.arrivalDateTime());
    if (!depIso) {
      this.toast.show('Indica fecha y hora de salida.', 'warning');
      return;
    }
    if (!arrIso) {
      this.toast.show('Indica fecha y hora de llegada.', 'warning');
      return;
    }
    const depMs = new Date(depIso).getTime();
    const arrMs = new Date(arrIso).getTime();
    if (arrMs <= depMs) {
      this.toast.show(
        'La llegada debe ser posterior a la salida; no puede ser la misma fecha y hora.',
        'warning',
      );
      return;
    }

    const liters = this.parseRequiredNonNegativeNumber(this.dieselLiters(), 'Diesel (litros)');
    if (liters === null) {
      return;
    }
    const dieselAmt = this.parseRequiredNonNegativeNumber(this.dieselAmount(), 'Diesel (monto)');
    if (dieselAmt === null) {
      return;
    }
    const casetas = this.parseRequiredNonNegativeNumber(this.casetasAmount(), 'Casetas');
    if (casetas === null) {
      return;
    }
    const opQuota = this.parseRequiredNonNegativeNumber(this.operatorQuota(), 'Operador');
    if (opQuota === null) {
      return;
    }

    let cobro = 0;
    if (includeBilling) {
      const parsed = this.parseRequiredNonNegativeNumber(this.clientCharge(), 'Cobro');
      if (parsed === null) {
        return;
      }
      cobro = parsed;
    }

    const op = config;
    const equipmentLabels =
      config === 'full'
        ? [this.labelForEquipmentValue(eq1), this.labelForEquipmentValue(eq2)]
        : [this.labelForEquipmentValue(eq1)];

    const oCpDigits = normalizeMxPostalCodeDigits(this.originCp());
    const dCpDigits = normalizeMxPostalCodeDigits(this.destinationCp());
    const kmSnap = this.routeKm();
    const maneuverKindSnap = maneuverKindFromRouteKm(kmSnap);
    const opSnap = this.assignedOperator();
    const licNum = opSnap?.licenseNumber?.trim() ?? '';
    const licExp = this.operatorLicenseExpiresReadonly().trim();

    const payload: CreateTripPayload = {
      origin,
      destination,
      operationType: op === 'full' || op === 'plana' ? op : 'sencillo',
      loadType: this.loadType(),
      containerType: this.containerType(),
      approximateWeightTons: this.approximateWeightTons().trim(),
      dieselLiters: String(liters),
      dieselAmount: String(dieselAmt),
      casetasAmount: String(casetas),
      operatorQuota: String(opQuota),
      clientCharge: String(cobro),
      creditDays: includeBilling ? this.parseCreditDays(this.creditDays()) : 0,
      requiresInvoice: includeBilling ? this.requiresInvoice() : false,
      paymentMethod: includeBilling
        ? this.normalizePaymentMethod(this.paymentMethod())
        : 'cash',
      operatorId: oprId,
      unitId: uid,
      clientName: client,
      clientId: includeBilling
        ? this.clientId().trim() || undefined
        : undefined,
      equipment: equipmentLabels,
      departureAt: depIso,
      arrivedAt: arrIso,
      attachedDocumentFileNames: this.attachedFiles().map((f) => f.name),
      routeDistanceKm: kmSnap,
      maneuverKind: maneuverKindSnap,
      originPostalCode: oCpDigits.length === 5 ? oCpDigits : undefined,
      originCityMunicipality: cityMunicipalityLineFromSettlement(oS),
      originLocality: formatSettlementOptionLabel(oS),
      destinationPostalCode: dCpDigits.length === 5 ? dCpDigits : undefined,
      destinationCityMunicipality: cityMunicipalityLineFromSettlement(dS),
      destinationLocality: formatSettlementOptionLabel(dS),
      operatorLicenseNumber: licNum !== '' ? licNum : undefined,
      operatorLicenseExpiresLabel: licExp !== '' ? licExp : undefined,
    };
    this.saved.emit(payload);
  }
}
