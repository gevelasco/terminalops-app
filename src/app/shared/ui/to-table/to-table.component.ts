import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OperationConfigurationResolverService } from '@shared/services/operation-configuration-resolver.service';
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
  fleetOperationalKeyLabel,
  type FleetOperationalKey,
} from '@features/fleet/utils/fleet-unit-table-row';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';
import {
  roleDisplayLabel,
  userRolePillClass as resolveUserRolePillClass,
  userRoleTableIcon,
  userStatusPillClass as resolveUserStatusPillClass,
  userStatusPillLabel as resolveUserStatusPillLabel,
} from '@shared/utils/access-control';

export type ToTableCellKind =
  | 'text'
  | 'nowrap'
  | 'maniobra-status'
  | 'incident-dot'
  | 'muted-badge'
  | 'operation-type'
  | 'operation-type-badges'
  | 'datetime-stacked'
  | 'fleet-op-pill'
  | 'fleet-maintenance-icon'
  | 'fleet-verification-icon'
  | 'fleet-insurance-icon'
  | 'operator-op-pill'
  | 'client-health-pill'
  | 'rate-availability-pill'
  | 'module-access-icons'
  | 'user-role-pill'
  | 'user-status-pill'
  | 'trip-collected-icon'
  | 'expense-invoice-icon';

/** Valor en la fila para `cell: 'module-access-icons'`. */
export interface ToTableModuleAccessIcon {
  label: string;
  icon: string;
  active: boolean;
}

/** Valor en la fila para `cell: 'datetime-stacked'` (fecha + hora en dos líneas). */
export interface ToTableStackedDatetime {
  date: string;
  time: string;
}

/** Valor en la fila para `cell: 'operation-type-badges'`. */
export interface ToTableOperationTypeBadge {
  label: string;
  badgeClass: string;
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
  providers: [OperationConfigurationResolverService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToIconComponent, FormsModule],
  templateUrl: './to-table.component.html',
  styleUrl: './to-table.component.scss',
})
export class ToTableComponent {
  private readonly opResolver = inject(OperationConfigurationResolverService);

  readonly columns = input<ToTableColumn[]>([]);
  readonly rows = input<ReadonlyArray<Record<string, unknown>>>([]);
  readonly trackByKey = input<string>('id');

  /** Filas clicables (p. ej. abrir detalle). */
  readonly interactiveRows = input(false);

  /** Filas visibles por página. ≤0 desactiva paginación y muestra todas las filas. */
  readonly pageSize = model<number>(15);

  /** Total de filas (paginación en servidor). Si se define, `rows` ya viene paginado. */
  readonly totalItems = input<number | null>(null);

  /** Opciones del selector de tamaño de página (p. ej. 10, 15, 25, 50, 100). */
  readonly pageSizeOptions = input<readonly number[] | null>(null);

  /** Índice de página actual (0-based). */
  readonly pageIndex = model(0);

  /** Contenedor con scroll vertical y encabezados sticky. */
  readonly scrollable = input(false);

  /** Fila de resumen al final de la tabla (`tfoot`). */
  readonly footerRow = input<Record<string, unknown> | null>(null);

  /** Hover tooltip en celdas de mantenimiento, verificación y seguro de flota. */
  readonly fleetIconTooltips = input(true);

  readonly pageSizeChange = output<number>();
  readonly pageIndexChange = output<number>();
  readonly rowClick = output<Record<string, unknown>>();

  private prevRowsLength = -1;
  private prevTotalItems = -1;

  constructor() {
    effect(() => {
      const opts = this.pageSizeOptions();
      if (!opts?.length) {
        return;
      }
      const ps = this.pageSize();
      if (opts.includes(ps)) {
        return;
      }
      const max = Math.max(...opts);
      const total = this.totalItems();
      const outOfRange = ps > max || ps < opts[0];
      const matchesTotal = total != null && total > 0 && ps === total;
      if (!outOfRange && !matchesTotal) {
        return;
      }
      const resolved = nearestPageSizeOption(ps, opts);
      if (resolved === ps) {
        return;
      }
      this.pageSize.set(resolved);
      this.pageSizeChange.emit(resolved);
    });

    effect(() => {
      const serverTotal = this.totalItems();
      const n = serverTotal ?? this.rows().length;
      const ps = this.pageSize();
      const lenChanged = n !== this.prevRowsLength;
      const totalChanged =
        serverTotal != null && serverTotal !== this.prevTotalItems;
      if (lenChanged || totalChanged) {
        this.prevRowsLength = n;
        this.prevTotalItems = serverTotal ?? -1;
        if (serverTotal == null) {
          this.pageIndex.set(0);
        }
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

  protected readonly serverSidePagination = computed(
    () => this.totalItems() != null,
  );

  protected readonly effectiveTotal = computed(
    () => this.totalItems() ?? this.rows().length,
  );

  protected readonly showPageSizeSelect = computed(() => {
    const opts = this.pageSizeOptions();
    return opts != null && opts.length > 0;
  });

  protected readonly showPagination = computed(() => {
    const ps = this.pageSize();
    const n = this.effectiveTotal();
    if (ps <= 0 || n <= 0) {
      return false;
    }
    if (this.serverSidePagination()) {
      const pageRows = this.pagedRows().length;
      if (pageRows === 0) {
        return false;
      }
      const idx = this.pageIndex();
      return idx > 0 || idx * ps + pageRows < n;
    }
    return n > ps;
  });

  protected readonly pagedRows = computed(() => {
    const all = this.rows();
    if (this.serverSidePagination()) {
      return [...all];
    }
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
    const ps = this.pageSize();
    const n = this.effectiveTotal();
    const pageRows = this.pagedRows();
    if (ps <= 0 || n === 0) {
      return null;
    }
    const pages = Math.max(1, Math.ceil(n / ps));
    const idx = Math.min(this.pageIndex(), pages - 1);
    const from = pageRows.length === 0 ? 0 : idx * ps + 1;
    const to =
      pageRows.length === 0
        ? 0
        : this.serverSidePagination()
          ? idx * ps + pageRows.length
          : Math.min(n, (idx + 1) * ps);
    return {
      from,
      to,
      total: n,
      page: idx + 1,
      pages,
    };
  });

  prevTablePage(): void {
    const next = Math.max(0, this.pageIndex() - 1);
    this.pageIndex.set(next);
    this.pageIndexChange.emit(next);
  }

  nextTablePage(): void {
    const ps = this.pageSize();
    const n = this.effectiveTotal();
    if (ps <= 0) {
      return;
    }
    const pages = Math.max(1, Math.ceil(n / ps));
    const next = Math.min(pages - 1, this.pageIndex() + 1);
    this.pageIndex.set(next);
    this.pageIndexChange.emit(next);
  }

  onPageSizeModelChange(raw: number | string): void {
    const next = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(next) || next <= 0 || next === this.pageSize()) {
      return;
    }
    this.pageSize.set(next);
    this.pageIndex.set(0);
    this.pageSizeChange.emit(next);
    this.pageIndexChange.emit(0);
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

  operationTypeBadgeClass(op: unknown, row?: Record<string, unknown>): string {
    return this.opResolver.resolveCellDisplay(op, row).badgeClass;
  }

  operationTypeCellLabel(op: unknown, row?: Record<string, unknown>): string {
    return this.opResolver.resolveCellDisplay(op, row).label;
  }

  operationTypeBadges(
    row: Record<string, unknown>,
    key: string,
  ): readonly ToTableOperationTypeBadge[] {
    const v = row[key];
    if (!Array.isArray(v)) {
      return [];
    }
    return v.filter(
      (item): item is ToTableOperationTypeBadge =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as ToTableOperationTypeBadge).label === 'string' &&
        typeof (item as ToTableOperationTypeBadge).badgeClass === 'string',
    );
  }

  fleetOpPillClass(v: unknown): string {
    const base = 'to-table-pill';
    switch (v) {
      case 'on_route':
        return `${base} to-table-pill--fleet-maneuver`;
      case 'available':
        return `${base} to-table-pill--fleet-available`;
      case 'in_use':
        return `${base} to-table-pill--fleet-maneuver`;
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

  rateAvailabilityPillClass(v: unknown): string {
    const base = 'to-table-pill';
    return v === 'available'
      ? `${base} to-table-pill--rate-available`
      : `${base} to-table-pill--rate-inactive`;
  }

  rateAvailabilityPillLabel(v: unknown): string {
    return v === 'available' ? 'Disponible' : 'Inactiva';
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
        return 'Verificaciones: próximas a vencer (menos de 10 días)';
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
        return 'Seguro: próximo pago o vigencia en menos de 10 días';
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

  moduleAccessIcons(
    row: Record<string, unknown>,
    key: string,
  ): readonly ToTableModuleAccessIcon[] {
    const v = row[key];
    if (!Array.isArray(v)) {
      return [];
    }
    return v.filter(
      (item): item is ToTableModuleAccessIcon =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as ToTableModuleAccessIcon).label === 'string' &&
        typeof (item as ToTableModuleAccessIcon).icon === 'string' &&
        typeof (item as ToTableModuleAccessIcon).active === 'boolean',
    );
  }

  moduleAccessIconName(icon: string): ToIconName {
    return icon as ToIconName;
  }

  userRolePillClass(role: unknown): string {
    return resolveUserRolePillClass(typeof role === 'string' ? role : '');
  }

  userRolePillLabel(role: unknown): string {
    return roleDisplayLabel(typeof role === 'string' ? role : '');
  }

  userRolePillIcon(role: unknown): ToIconName {
    return userRoleTableIcon(typeof role === 'string' ? role : '');
  }

  userStatusPillClass(status: unknown): string {
    return resolveUserStatusPillClass(typeof status === 'string' ? status : '');
  }

  userStatusPillLabel(status: unknown): string {
    return resolveUserStatusPillLabel(typeof status === 'string' ? status : '');
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
      cell === 'trip-collected-icon' ||
      cell === 'expense-invoice-icon' ||
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

function nearestPageSizeOption(
  pageSize: number,
  options: readonly number[],
): number {
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    return options[0];
  }
  if (options.includes(pageSize)) {
    return pageSize;
  }
  return options.reduce((best, option) =>
    Math.abs(option - pageSize) < Math.abs(best - pageSize) ? option : best,
  );
}
