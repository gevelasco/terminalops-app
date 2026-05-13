import { Component, input, output } from '@angular/core';
import type { TripOperationType, TripStatus } from '@shared/models/logistics.models';

export type ToTableCellKind =
  | 'text'
  | 'maniobra-status'
  | 'incident-dot'
  | 'muted-badge'
  | 'operation-type'
  | 'datetime-stacked'
  | 'fleet-op-pill'
  | 'fleet-maintenance-icon'
  | 'fleet-verification-icon'
  | 'fleet-insurance-icon';

/** Valor en la fila para `cell: 'datetime-stacked'` (fecha + hora en dos líneas). */
export interface ToTableStackedDatetime {
  date: string;
  time: string;
}

export interface ToTableColumn {
  key: string;
  label: string;
  /** Por defecto texto plano vía `cellValue`. */
  cell?: ToTableCellKind;
}

@Component({
  selector: 'to-table',
  standalone: true,
  templateUrl: './to-table.component.html',
  styleUrl: './to-table.component.scss',
})
export class ToTableComponent {
  readonly columns = input<ToTableColumn[]>([]);
  readonly rows = input<ReadonlyArray<Record<string, unknown>>>([]);
  readonly trackByKey = input<string>('id');

  /** Filas clicables (p. ej. abrir detalle). */
  readonly interactiveRows = input(false);

  readonly rowClick = output<Record<string, unknown>>();

  trackRow = (index: number, row: Record<string, unknown>): string => {
    const k = this.trackByKey();
    const id = row[k];
    return typeof id === 'string' || typeof id === 'number' ? String(id) : String(index);
  };

  cellValue(row: Record<string, unknown>, key: string): string {
    const v = row[key];
    if (v == null) {
      return '—';
    }
    return String(v);
  }

  maniobraStatusPillClass(
    status: unknown,
    row?: Record<string, unknown>,
  ): string {
    const base = 'to-table-pill';
    const s = status as TripStatus;
    if (s === 'cancelled' && row?.['falseManeuver'] === true) {
      return `${base} ${base}--false-maneuver`;
    }
    switch (s) {
      case 'in_transit':
        return `${base} ${base}--course`;
      case 'completed':
        return `${base} ${base}--done`;
      case 'scheduled':
        return `${base} ${base}--delayed`;
      case 'cancelled':
        return `${base} ${base}--cancelled`;
      default:
        return `${base} ${base}--unknown`;
    }
  }

  maniobraStatusLabel(status: unknown, row?: Record<string, unknown>): string {
    const s = status as TripStatus;
    if (s === 'cancelled' && row?.['falseManeuver'] === true) {
      return 'En falso';
    }
    switch (s) {
      case 'in_transit':
        return 'En curso';
      case 'completed':
        return 'Completado';
      case 'scheduled':
        return 'Programado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return '—';
    }
  }

  incidentHasIssue(row: Record<string, unknown>, key: string): boolean {
    return row[key] === true;
  }

  /** Badge sobrio por tipo de maniobra (valor en fila: `TripOperationType`). */
  operationTypeBadgeClass(op: unknown): string {
    const base = 'to-table-badge to-table-badge--op';
    switch (op as TripOperationType) {
      case 'sencillo':
        return `${base} to-table-badge--op-sencillo`;
      case 'full':
        return `${base} to-table-badge--op-full`;
      case 'plana':
        return `${base} to-table-badge--op-plana`;
      default:
        return `${base} to-table-badge--op-unknown`;
    }
  }

  operationTypeCellLabel(op: unknown): string {
    switch (op as TripOperationType) {
      case 'sencillo':
        return 'Sencillo';
      case 'full':
        return 'Full';
      case 'plana':
        return 'Plana';
      default:
        return '—';
    }
  }

  fleetOpPillClass(v: unknown): string {
    const base = 'to-table-pill';
    switch (v) {
      case 'on_route':
        return `${base} to-table-pill--fleet-maneuver`;
      case 'available':
        return `${base} to-table-pill--fleet-available`;
      case 'in_use':
        return `${base} to-table-pill--fleet-in-use`;
      case 'maintenance':
        return `${base} to-table-pill--fleet-maintenance`;
      case 'scheduled':
        return `${base} to-table-pill--fleet-scheduled`;
      default:
        return `${base} to-table-pill--fleet-unknown`;
    }
  }

  fleetOpLabel(v: unknown): string {
    switch (v) {
      case 'on_route':
        return 'En Maniobra';
      case 'available':
        return 'Disponible';
      case 'in_use':
        return 'Asignada';
      case 'maintenance':
        return 'Mantenimiento';
      case 'scheduled':
        return 'Programado';
      default:
        return '—';
    }
  }

  /** Iconos de salud flota: al corriente / sin dato = apagado; próximo; vencido. */
  fleetIconHealthClass(v: unknown): string {
    const b = this.fleetHealthBucket(v);
    const base = 'to-table-fleet-icon';
    if (b === 'soon') {
      return `${base} ${base}--soon`;
    }
    if (b === 'due') {
      return `${base} ${base}--due`;
    }
    return `${base} ${base}--muted`;
  }

  fleetHealthBucket(v: unknown): 'ok' | 'soon' | 'due' | 'na' {
    if (v === 'ok' || v === 'soon' || v === 'due' || v === 'na') {
      return v;
    }
    return 'na';
  }

  fleetMaintAria(v: unknown): string {
    switch (this.fleetHealthBucket(v)) {
      case 'due':
        return 'Mantenimiento: vencido o pendiente';
      case 'soon':
        return 'Mantenimiento: próximo ciclo en menos de 45 días';
      case 'ok':
        return 'Mantenimiento: al corriente';
      default:
        return 'Mantenimiento: sin fecha registrada';
    }
  }

  fleetVerifAria(v: unknown): string {
    switch (this.fleetHealthBucket(v)) {
      case 'due':
        return 'Verificaciones: vencida o incompleta';
      case 'soon':
        return 'Verificaciones: próximas a vencer';
      case 'ok':
        return 'Verificaciones: al corriente';
      default:
        return 'Verificaciones: no registradas';
    }
  }

  fleetInsAria(v: unknown): string {
    switch (this.fleetHealthBucket(v)) {
      case 'due':
        return 'Seguro: póliza o pago vencido';
      case 'soon':
        return 'Seguro: próximo pago o vigencia en menos de 30 días';
      case 'ok':
        return 'Seguro: vigente';
      default:
        return 'Seguro: sin datos de póliza';
    }
  }

  /** Fecha próxima en fila (`fleetMaintNext`, …) para mostrar bajo el icono. */
  fleetIconNextCell(row: Record<string, unknown>, colKey: string): string {
    const v = row[`${colKey}Next`];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
    return '—';
  }

  /** Tooltip corto sobre la fecha (color = severidad). */
  fleetIconNextTitle(row: Record<string, unknown>, colKey: string): string {
    switch (this.fleetHealthBucket(row[colKey])) {
      case 'due':
        return 'Crítico: vencido. Acción inmediata.';
      case 'soon':
        return 'Advertencia: próxima a vencer.';
      case 'ok':
        return 'Al corriente: sin acción pendiente.';
      case 'na':
      default:
        return 'Sin dato: registra o revisa la información.';
    }
  }

  /** Tooltip largo desde la fila (`fleetMaintTip`, etc.) o texto corto de accesibilidad. */
  fleetIconTooltip(row: Record<string, unknown>, colKey: string): string {
    const tipKey = `${colKey}Tip`;
    const tip = row[tipKey];
    if (typeof tip === 'string' && tip.trim()) {
      return tip;
    }
    const v = row[colKey];
    if (colKey === 'fleetMaint') {
      return this.fleetMaintAria(v);
    }
    if (colKey === 'fleetVerif') {
      return this.fleetVerifAria(v);
    }
    if (colKey === 'fleetIns') {
      return this.fleetInsAria(v);
    }
    return '';
  }

  stackedDatetime(
    row: Record<string, unknown>,
    key: string,
  ): ToTableStackedDatetime | null {
    const v = row[key];
    if (v == null || typeof v !== 'object') {
      return null;
    }
    const o = v as { date?: unknown; time?: unknown };
    if (typeof o.date === 'string' && typeof o.time === 'string') {
      return { date: o.date, time: o.time };
    }
    return null;
  }

  onRowActivate(row: Record<string, unknown>): void {
    if (!this.interactiveRows()) {
      return;
    }
    this.rowClick.emit(row);
  }

  onRowKeydown(ev: KeyboardEvent, row: Record<string, unknown>): void {
    if (!this.interactiveRows()) {
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.rowClick.emit(row);
    }
  }

  tdCentered(cell: ToTableCellKind | undefined): boolean {
    return (
      cell === 'incident-dot' ||
      cell === 'fleet-maintenance-icon' ||
      cell === 'fleet-verification-icon' ||
      cell === 'fleet-insurance-icon'
    );
  }

  isFleetIconCell(cell: ToTableCellKind | undefined): boolean {
    return (
      cell === 'fleet-maintenance-icon' ||
      cell === 'fleet-verification-icon' ||
      cell === 'fleet-insurance-icon'
    );
  }
}
