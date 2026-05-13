import { DOCUMENT } from '@angular/common';
import {
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
import { MOCK_UNITS, formatUnitTrailerLabel } from '@app/mock-data/mock-units';
import { ToastService } from '@core/notifications/toast.service';
import { CreateTripPayload } from '@features/maniobra/data/maniobra.repository';
import {
  TripContainerType,
  TripLoadType,
} from '@shared/models/logistics.models';
import {
  LatLon,
  OsrmDrivingRouteService,
} from '@shared/services/osrm-driving-route.service';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToPlaceInputComponent } from '@shared/ui/to-place-input/to-place-input.component';
import {
  ToSelectComponent,
  ToSelectOption,
} from '@shared/ui/to-select/to-select.component';
import { ToClientInputComponent } from '@shared/ui/to-client-input/to-client-input.component';
import { ToOperatorInputComponent } from '@shared/ui/to-operator-input/to-operator-input.component';
import { combineLatest, of } from 'rxjs';
import {
  catchError,
  debounceTime,
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
    ToPlaceInputComponent,
    ToSelectComponent,
    ToClientInputComponent,
    ToOperatorInputComponent,
  ],
  templateUrl: './maniobra-new-drawer.component.html',
  styleUrl: './maniobra-new-drawer.component.scss',
})
export class ManiobraNewDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly osrm = inject(OsrmDrivingRouteService);
  private readonly toast = inject(ToastService);

  readonly dismiss = output<void>();
  readonly saved = output<CreateTripPayload>();

  /** Escaneos / fotos adjuntos (solo en cliente hasta envío al backend). */
  readonly attachedFiles = signal<File[]>([]);

  readonly origin = model('');
  readonly destination = model('');

  readonly originCoords = signal<LatLon | null>(null);
  readonly destinationCoords = signal<LatLon | null>(null);

  /** Distancia por carretera (OSRM), solo si hay coordenadas de ambos puntos. */
  readonly routeKm = signal<number | null>(null);
  readonly routeLoading = signal(false);
  readonly routeFailed = signal(false);
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
  readonly unitId = model('');
  /** Valores internos de `ASSIGNABLE_EQUIPMENT_OPTIONS`; en Full se usan dos filas. */
  readonly equipmentPrimary = model('');
  readonly equipmentSecondary = model('');
  /** `yyyy-mm-ddTHH:mm` para datetime-local */
  readonly departureDateTime = model('');
  readonly arrivalDateTime = model('');
  readonly clientName = model('');

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

  readonly unitOptions: ToSelectOption[] = [...MOCK_UNITS]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((u) => ({
      value: u.id,
      label: formatUnitTrailerLabel(u),
    }));

  private formatKm(km: number): string {
    return km.toLocaleString('es-MX', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  /** Valor mostrado en el campo solo lectura «Distancia» (OSRM). */
  readonly distanceInputValue = computed(() => {
    if (this.routeLoading()) {
      return 'Calculando…';
    }
    const km = this.routeKm();
    if (km !== null) {
      return `${this.formatKm(km)} km`;
    }
    if (this.routeFailed() && this.originCoords() && this.destinationCoords()) {
      return 'No disponible';
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

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.doc.body.style.overflow = '';
    });
    this.doc.body.style.overflow = 'hidden';

    effect(() => {
      if (this.operationType() !== 'full') {
        this.equipmentSecondary.set('');
      }
    });

    combineLatest([
      toObservable(this.originCoords),
      toObservable(this.destinationCoords),
    ])
      .pipe(
        debounceTime(200),
        switchMap(([o, d]) => {
          if (!o || !d) {
            return of(null).pipe(tap(() => this.routeLoading.set(false)));
          }
          this.routeLoading.set(true);
          return this.osrm.drivingKm(o, d).pipe(
            map((km) => ({ km, failed: km === null })),
            catchError(() => of({ km: null, failed: true })),
            finalize(() => this.routeLoading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        if (r === null) {
          this.routeKm.set(null);
          this.routeFailed.set(false);
          return;
        }
        this.routeKm.set(r.km);
        this.routeFailed.set(r.failed);
      });
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

  /** Quita separadores de miles para enviar al backend. */
  private stripGroupedNumber(raw: string): string {
    return raw.replace(/\s/g, '').replace(/,/g, '').trim();
  }

  private parseRequiredNonNegativeNumber(raw: string, fieldLabel: string): number | null {
    const s = this.stripGroupedNumber(raw);
    if (s === '') {
      this.toast.show(`El campo «${fieldLabel}» es obligatorio.`, 'warning');
      return null;
    }
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) {
      this.toast.show(`«${fieldLabel}» no tiene un valor numérico válido.`, 'warning');
      return null;
    }
    return n;
  }

  private dateTimeLocalToIso(local: string): string | null {
    const t = local.trim();
    if (!t) {
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) {
      return null;
    }
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) {
      return null;
    }
    return d.toISOString();
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
    const s = this.stripGroupedNumber(raw);
    if (s === '') {
      this.toast.show(`El campo «${fieldLabel}» es obligatorio.`, 'warning');
      return true;
    }
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) {
      this.toast.show(`«${fieldLabel}» no tiene un valor numérico válido.`, 'warning');
      return true;
    }
    return false;
  }

  private maybeToastDateOrder(): void {
    const depIso = this.dateTimeLocalToIso(this.departureDateTime());
    const arrIso = this.dateTimeLocalToIso(this.arrivalDateTime());
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

  onOriginBlur(): void {
    this.toastIfRequiredEmpty(this.origin(), 'Origen');
  }

  onDestinationBlur(): void {
    this.toastIfRequiredEmpty(this.destination(), 'Destino');
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
    if (!this.dateTimeLocalToIso(t)) {
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
    if (!this.dateTimeLocalToIso(t)) {
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
    const origin = this.origin().trim();
    const destination = this.destination().trim();
    if (!origin || !destination) {
      this.toast.show('Indica origen y destino.', 'warning');
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

    const depIso = this.dateTimeLocalToIso(this.departureDateTime());
    const arrIso = this.dateTimeLocalToIso(this.arrivalDateTime());
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
      equipment: equipmentLabels,
      departureAt: depIso,
      arrivedAt: arrIso,
      attachedDocumentFileNames: this.attachedFiles().map((f) => f.name),
    };
    this.saved.emit(payload);
  }
}
