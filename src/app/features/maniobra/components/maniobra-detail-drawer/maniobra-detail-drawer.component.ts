import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SimulatedDbService } from '@app/sim-db/simulated-db.service';
import { SessionStore } from '@core/services/session.store';
import { ToastService } from '@core/notifications/toast.service';
import { OperatorRepository } from '@features/operators/data/operator.repository';
import { tripIncidentPostedBy } from '@features/maniobra/utils/trip-incidents';
import { tripStatusUiLabel } from '@shared/utils/trip-status-ui';
import { ManiobraRepository } from '@features/maniobra/data/maniobra.repository';
import {
  snapshotTextOrDash,
  storedRouteDistanceKmLabel,
} from '@features/maniobra/utils/maniobra-route-display';
import {
  Operator,
  Trip,
  TripContainerType,
  TripIncident,
  TripLoadType,
  TripOperationType,
} from '@shared/models/logistics.models';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import { ToDrawerSkeletonComponent } from '@shared/ui/to-drawer-skeleton/to-drawer-skeleton.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';

@Component({
  selector: 'app-maniobra-detail-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToDrawerSkeletonComponent, ToIconButtonComponent, ToButtonComponent],
  providers: [DateShortPipe],
  templateUrl: './maniobra-detail-drawer.component.html',
  styleUrls: [
    '../maniobra-new-drawer/maniobra-new-drawer.component.scss',
    '../../../../shared/ui/to-table/to-table.component.scss',
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    './maniobra-detail-drawer.component.scss',
  ],
})
export class ManiobraDetailDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly dateShort = inject(DateShortPipe);
  private readonly maniobrasRepo = inject(ManiobraRepository);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(ToastService);
  private readonly simDb = inject(SimulatedDbService);
  private readonly operatorsRepo = inject(OperatorRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly operators = signal<Operator[]>([]);
  readonly drawerLoading = signal(true);

  readonly trip = input.required<Trip>();
  readonly operatorName = input.required<string>();

  readonly dismiss = output<void>();
  /** Viaje actualizado (p. ej. tras registrar incidente); nombre evita conflicto de tipos con el input `trip`. */
  readonly maniobraTripChange = output<Trip>();

  readonly incidentDraft = signal('');
  readonly incidentSaving = signal(false);
  readonly cancelSubmitting = signal(false);
  /** Pestañas del panel: datos de la maniobra vs. seguimiento (actualizaciones e incidentes). */
  readonly detailTab = signal<'maneuver' | 'tracking'>('maneuver');
  private detailTabTripId: string | undefined;
  /** `operative` = cancelación sin cobro por no ejecución; `false` = maniobra en falso (con cobro). */
  readonly cancelKind = signal<'operative' | 'false'>('operative');
  readonly cancelNoteDraft = signal('');

  private readonly cancelDialog = viewChild<ElementRef<HTMLDialogElement>>(
    'cancelDialog',
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.doc.body.style.overflow = '';
    });
    this.doc.body.style.overflow = 'hidden';

    this.operatorsRepo
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rows) => {
        this.operators.set(rows);
        this.drawerLoading.set(false);
      });

    effect(() => {
      const trip = this.trip();
      if (trip.id === this.detailTabTripId) {
        return;
      }
      this.detailTabTripId = trip.id;
      this.detailTab.set(defaultDetailTabForTrip(trip));
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key !== 'Escape') {
      return;
    }
    const d = this.cancelDialog()?.nativeElement;
    if (d?.open) {
      ev.preventDefault();
      d.close();
      return;
    }
    this.dismiss.emit();
  }

  canCancelManiobra(): boolean {
    const s = this.trip().status;
    return s === 'scheduled' || s === 'in_transit';
  }

  openCancelDialog(): void {
    this.cancelKind.set('operative');
    this.cancelNoteDraft.set('');
    queueMicrotask(() => this.cancelDialog()?.nativeElement.showModal());
  }

  closeCancelDialog(): void {
    this.cancelDialog()?.nativeElement.close();
  }

  /** Limpia el estado del modal al cerrar (ESC, «No», éxito, etc.). */
  resetCancelModalForm(): void {
    this.cancelSubmitting.set(false);
    this.cancelKind.set('operative');
    this.cancelNoteDraft.set('');
  }

  onCancelNoteInput(ev: Event): void {
    this.cancelNoteDraft.set((ev.target as HTMLTextAreaElement).value);
  }

  confirmCancelManiobra(): void {
    const falseM = this.cancelKind() === 'false';
    const note = this.cancelNoteDraft().trim();
    if (falseM && note === '') {
      this.toast.show(
        'Describe brevemente el motivo para registrar una maniobra en falso.',
        'warning',
      );
      return;
    }
    this.cancelSubmitting.set(true);
    this.maniobrasRepo
      .cancelManiobra(this.trip().id, {
        falseManeuver: falseM,
        note: falseM ? note : undefined,
      })
      .subscribe({
        next: (updated) => {
          this.cancelSubmitting.set(false);
          this.closeCancelDialog();
          this.maniobraTripChange.emit(updated);
          const enFalso = updated.falseManeuver === true;
          this.toast.show(
            enFalso
              ? `Maniobra ${updated.maneuverCode} registrada en falso (se mantiene el cobro).`
              : `Maniobra ${updated.maneuverCode} cancelada correctamente.`,
            'success',
          );
          this.dismiss.emit();
        },
        error: (err: unknown) => {
          this.cancelSubmitting.set(false);
          const detail =
            err instanceof Error
              ? err.message.trim()
              : typeof err === 'string'
                ? err.trim()
                : '';
          this.toast.show(
            detail || 'No se pudo cancelar la maniobra. Inténtalo de nuevo.',
            'error',
          );
        },
      });
  }

  cancellationNoteDisplay(): string {
    const n = this.trip().cancellationNote?.trim();
    return n ?? '';
  }

  fmt(iso: string | null | undefined): string {
    return this.dateShort.transform(iso ?? undefined);
  }

  /** Fecha de salida real; `-` si aún no inicia. */
  enCursoDisplay(): string {
    const t = this.trip().departureAt;
    return t ? this.fmt(t) : '-';
  }

  /** Fecha de llegada / término de ruta; `-` si aún no termina. */
  completadaDisplay(): string {
    const t = this.trip().arrivedAt;
    return t ? this.fmt(t) : '-';
  }

  /** Misma etiqueta que en «Nueva maniobra» al elegir unidad. */
  unitDisplay(unitId: string): string {
    return this.simDb.labelForUnitId(unitId);
  }

  isFullTrip(): boolean {
    return this.trip().operationType === 'full';
  }

  /** `false` solo si se marcó explícitamente como maniobra sin cobro/cliente externo. */
  showsClientBillingBlock(): boolean {
    return this.trip().hasClientBilling !== false;
  }

  /** Badge de estado en cabecera del detalle (incluye variante «en falso»). */
  detailStatusPillClasses(): string {
    const t = this.trip();
    const base = 'to-table-pill maniobra-detail__status-pill';
    if (t.status === 'cancelled' && t.falseManeuver === true) {
      return `${base} to-table-pill--false-maneuver`;
    }
    switch (t.status) {
      case 'in_transit':
        return `${base} to-table-pill--course`;
      case 'completed':
        return `${base} to-table-pill--done`;
      case 'scheduled':
        return `${base} to-table-pill--delayed`;
      case 'cancelled':
        return `${base} to-table-pill--cancelled`;
      default:
        return `${base} to-table-pill--unknown`;
    }
  }

  detailStatusLabel(): string {
    const t = this.trip();
    return tripStatusUiLabel(t.status, {
      falseManeuver: t.falseManeuver === true,
    });
  }

  operationLabel(op: TripOperationType): string {
    const labels: Record<TripOperationType, string> = {
      sencillo: 'Sencillo',
      full: 'Full',
      plana: 'Plana',
    };
    return labels[op];
  }

  loadLabel(load: TripLoadType): string {
    return load === 'vacio' ? 'Vacío' : 'Lleno';
  }

  containerLabel(c: TripContainerType): string {
    const labels: Record<TripContainerType, string> = {
      '20ft': '20 pies',
      '40ft': '40 pies',
      '40hc': '40 pies HC (High Cube)',
      na: 'N/A',
    };
    return labels[c];
  }

  distanceDisplay(): string {
    return storedRouteDistanceKmLabel(this.trip().routeDistanceKm);
  }

  routeSnapshotOrDash(value: string | undefined): string {
    return snapshotTextOrDash(value);
  }

  maneuverKindDisplay(): string {
    const k = this.trip().maneuverKind?.trim();
    return k ? k : '—';
  }

  weightDisplay(): string {
    const t = this.trip().approximateWeightTons?.trim() ?? '';
    return t.length > 0 ? `${t} Ton` : '—';
  }

  paymentLabel(method?: Trip['paymentMethod']): string {
    switch (method) {
      case 'transfer':
        return 'Transferencia';
      case 'check':
        return 'Cheque';
      case 'cash':
        return 'Efectivo';
      default:
        return '—';
    }
  }

  /** Muestra valor numérico con formato es-MX o el texto guardado si no parsea. */
  displayGroupedNumber(raw: string | undefined): string {
    if (raw === undefined) {
      return '—';
    }
    const t = raw.replace(/\s/g, '').replace(/,/g, '').trim();
    if (t === '') {
      return '—';
    }
    const n = Number(t);
    if (!Number.isFinite(n)) {
      return raw.trim() || '—';
    }
    return new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(n);
  }

  /** Precio / monto con prefijo `$`. */
  displayMoney(raw: string | undefined): string {
    const s = this.displayGroupedNumber(raw);
    return s === '—' ? '—' : `$${s}`;
  }

  litersDisplay(raw: string | undefined): string {
    const s = this.displayGroupedNumber(raw);
    return s === '—' ? '—' : `${s} L`;
  }

  invoiceLabel(): string {
    return this.trip().requiresInvoice === true ? 'Sí' : 'No';
  }

  equipmentAt(index: number): string {
    const list = this.trip().equipment;
    const row = list[index];
    const s = row?.trim();
    return s ? this.simDb.labelForEquipmentId(s) : '—';
  }

  incidentAuthorLabel(inc: TripIncident): string {
    return tripIncidentPostedBy(inc, this.operators());
  }

  incidentsSorted(): TripIncident[] {
    const list = this.trip().incidents ?? [];
    return [...list].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
  }

  onIncidentDraftInput(ev: Event): void {
    this.incidentDraft.set((ev.target as HTMLTextAreaElement).value);
  }

  registerIncident(): void {
    const text = this.incidentDraft().trim();
    if (!text) {
      this.toast.show('Describe brevemente el incidente antes de registrarlo.', 'warning');
      return;
    }
    const postedBy = this.session.username()?.trim();
    if (!postedBy) {
      this.toast.show('Inicia sesión para registrar incidentes.', 'warning');
      return;
    }
    this.incidentSaving.set(true);
    this.maniobrasRepo.addIncident(this.trip().id, text, postedBy).subscribe({
      next: (updated) => {
        this.incidentDraft.set('');
        this.incidentSaving.set(false);
        this.maniobraTripChange.emit(updated);
        this.toast.show('Incidente registrado con la fecha y hora actual.', 'success');
      },
      error: () => {
        this.incidentSaving.set(false);
        this.toast.show('No se pudo registrar el incidente. Inténtalo de nuevo.', 'error');
      },
    });
  }
}

/** Pestaña inicial al abrir el detalle: seguimiento si está en curso, si no datos de maniobra. */
function defaultDetailTabForTrip(trip: Trip): 'maneuver' | 'tracking' {
  return trip.status === 'in_transit' ? 'tracking' : 'maneuver';
}
