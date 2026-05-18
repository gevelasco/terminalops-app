import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import type { OperatorOperationalStatus, TripStatus } from '@shared/models/logistics.models';
import type { ClientCommercialHealth } from '@shared/models/client.models';
import { clientCommercialHealthLabel } from '@shared/catalogs/client-form-options';
import { operatorOperationalStatusLabel } from '@shared/catalogs/operator-form-options';
import { operatorOperationalPillClass as operatorOpPillClass } from '@shared/utils/operator-operational-pill';
import {
  maneuverStatusPillClass,
  maneuverStatusPillLabel,
} from '@shared/utils/maneuver-status-pill';
import {
  tripOperationTypeBadgeClass,
  tripOperationTypeBadgeLabel,
} from '@shared/utils/trip-operation-type-badge';
import {
  fleetOperationalKeyLabel,
  type FleetOperationalKey,
} from '@features/fleet/utils/fleet-unit-table-row';

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
  | 'fleet-insurance-icon'
  | 'operator-op-pill'
  | 'client-health-pill';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './to-table.component.html',
  styleUrl: './to-table.component.scss',
})
export class ToTableComponent {
  readonly columns = input<ToTableColumn[]>([]);
  readonly rows = input<ReadonlyArray<Record<string, unknown>>>([]);
  readonly trackByKey = input<string>('id');

  /** Filas clicables (p. ej. abrir detalle). */
  readonly interactiveRows = input(false);

  /** Filas visibles por página. ≤0 desactiva paginación y muestra todas las filas. */
  readonly pageSize = input<number>(12);

  readonly rowClick = output<Record<string, unknown>>();

  protected readonly pageIndex = signal(0);
  private prevRowsLength = -1;

  constructor() {
    effect(() => {
      const n = this.rows().length;
      const ps = this.pageSize();
      const lenChanged = n !== this.prevRowsLength;
      if (lenChanged) {
        this.prevRowsLength = n;
        this.pageIndex.set(0);
        return;
      }
      if (ps != null && ps > 0 && n > 0) {
        const pages = Math.max(1, Math.ceil(n / ps));
        const pi = this.pageIndex();
        if (pi >= pages) {
          this.pageIndex.set(pages - 1);
        }
      }
    });
  }

  protected readonly showPagination = computed(() => {
    const ps = this.pageSize();
    const n = this.rows().length;
    return ps > 0 && n > ps;
  });

  protected readonly pagedRows = computed(() => {
    const all = this.rows();
    const ps = this.pageSize();
    if (ps == null || ps <= 0) {
      return [...all];
    }
    const n = all.length;
    if (n === 0) {
      return [];
    }
    const pages = Math.max(1, Math.ceil(n / ps));
    const idx = Math.min(this.pageIndex(), pages - 1);
    const start = idx * ps;
    return all.slice(start, start + ps);
  });

  protected readonly paginationRange = computed(() => {
    const all = this.rows();
    const ps = this.pageSize();
    const n = all.length;
    if (ps <= 0 || n === 0) {
      return null;
    }
    const pages = Math.max(1, Math.ceil(n / ps));
    const idx = Math.min(this.pageIndex(), pages - 1);
    return {
      from: idx * ps + 1,
      to: Math.min(n, (idx + 1) * ps),
      total: n,
      page: idx + 1,
      pages,
    };
  });

  prevTablePage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }

  nextTablePage(): void {
    const ps = this.pageSize();
    const n = this.rows().length;
    if (ps <= 0) {
      return;
    }
    const pages = Math.max(1, Math.ceil(n / ps));
    this.pageIndex.update((i) => Math.min(pages - 1, i + 1));
  }

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
    return maneuverStatusPillClass(status as TripStatus, {
      falseManeuver: row?.['falseManeuver'] === true,
    });
  }

  maniobraStatusLabel(status: unknown, row?: Record<string, unknown>): string {
    return maneuverStatusPillLabel(status as TripStatus, {
      falseManeuver: row?.['falseManeuver'] === true,
    });
  }

  incidentHasIssue(row: Record<string, unknown>, key: string): boolean {
    return row[key] === true;
  }

  operationTypeBadgeClass(op: unknown): string {
    return tripOperationTypeBadgeClass(op);
  }

  operationTypeCellLabel(op: unknown): string {
    return tripOperationTypeBadgeLabel(op);
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
    return fleetOperationalKeyLabel(v as FleetOperationalKey);
  }

  operatorOperationalPillClass(v: unknown): string {
    return operatorOpPillClass(v as OperatorOperationalStatus);
  }

  operatorOperationalPillLabel(v: unknown): string {
    return operatorOperationalStatusLabel(v as OperatorOperationalStatus);
  }

  clientHealthPillClass(v: unknown): string {
    const base = 'to-table-pill';
    switch (v as ClientCommercialHealth) {
      case 'good_standing':
        return `${base} to-table-pill--client-good`;
      case 'watch_list':
        return `${base} to-table-pill--client-watch`;
      case 'restricted':
        return `${base} to-table-pill--client-restricted`;
      case 'not_evaluated':
      default:
        return `${base} to-table-pill--client-na`;
    }
  }

  clientHealthPillLabel(v: unknown): string {
    return clientCommercialHealthLabel(v as string | undefined);
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

  /** Resumen para `title` y `aria-label` (fallback nativo + lectores de pantalla). */
  fleetIconAccessibleSummary(row: Record<string, unknown>, colKey: string): string {
    const sev = this.fleetIconNextTitle(row, colKey).trim();
    const detail = this.fleetIconTooltip(row, colKey).trim();
    const nextRaw = this.fleetIconNextCell(row, colKey).trim();
    const nextPart =
      nextRaw && nextRaw !== '—' ? `Fecha en tabla: ${nextRaw}.` : '';
    return [sev, detail, nextPart].filter(Boolean).join(' ');
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
