import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
  signal,
} from '@angular/core';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { ManiobraRepository } from '@features/maniobra/data/maniobra.repository';
import { OperatorsDetailDrawerComponent } from '@features/operators/components/operators-detail-drawer/operators-detail-drawer.component';
import { OperatorsNewDrawerComponent } from '@features/operators/components/operators-new-drawer/operators-new-drawer.component';
import { OperatorRepository } from '@features/operators/data/operator.repository';
import {
  operatorInsuranceKindLabel,
  operatorOperationalStatusLabel,
} from '@shared/catalogs/operator-form-options';
import type {
  Operator,
  OperatorOperationalStatus,
  Trip,
} from '@shared/models/logistics.models';
import { completedManeuverCountsByOperatorId } from '@features/operators/utils/completed-maneuver-counts-by-operator-id';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

function formatIsoDateEs(iso: string): string {
  const t = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return iso || '—';
  }
  const d = new Date(t + 'T12:00:00');
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(d);
}

@Component({
  selector: 'app-operators-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToPageHeaderComponent,
    ToInputComponent,
    ToTableComponent,
    ToSkeletonComponent,
    ToButtonComponent,
    OperatorsNewDrawerComponent,
    OperatorsDetailDrawerComponent,
  ],
  templateUrl: './operators-page.component.html',
  styleUrl: './operators-page.component.scss',
})
export class OperatorsPageComponent {
  private readonly repo = inject(OperatorRepository);
  private readonly maniobrasRepo = inject(ManiobraRepository);

  readonly loading = signal(true);
  readonly rows = signal<Record<string, unknown>[]>([]);
  readonly searchQuery = model('');
  readonly newOperatorOpen = signal(false);
  readonly detailOperator = signal<Operator | null>(null);
  /** Conteo de maniobras `completed` por id de operador (última carga de lista). */
  readonly completedManeuverCounts = signal<Map<string, number>>(new Map());

  readonly columns: ToTableColumn[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'licenseNumber', label: 'Licencia' },
    { key: 'licenseExpiresOn', label: 'Vigencia' },
    {
      key: 'operationalStatus',
      label: 'Estado operativo',
      cell: 'operator-op-pill',
    },
    { key: 'coverageKind', label: 'Tipo de cobertura', cell: 'muted-badge' },
    { key: 'maneuverCount', label: 'Maniobras' },
  ];

  /** Filas visibles según caja de búsqueda (nombre, licencia, fechas, estado, cobertura, id). */
  readonly displayedOperatorRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.rows();
    if (!q) {
      return all;
    }
    return all.filter((row) => OperatorsPageComponent.rowMatchesQuery(row, q));
  });

  constructor() {
    this.loadOperators();
  }

  loadOperators(): void {
    this.loading.set(true);
    forkJoin({
      ops: this.repo.list().pipe(catchError(() => of([] as Operator[]))),
      trips: this.maniobrasRepo
        .list()
        .pipe(catchError(() => of([] as Trip[]))),
    }).subscribe({
      next: ({ ops, trips }) => {
        const counts = completedManeuverCountsByOperatorId(trips);
        this.completedManeuverCounts.set(counts);
        this.rows.set(ops.map((o) => this.mapRow(o, counts)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onRowClick(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    if (!id) {
      return;
    }
    void firstValueFrom(this.repo.get(id)).then((op) => {
      if (op) {
        this.detailOperator.set(op);
      }
    });
  }

  onDetailDismiss(): void {
    this.detailOperator.set(null);
  }

  onDetailOperatorChange(op: Operator): void {
    this.detailOperator.set(op);
    this.loadOperators();
  }

  onOperatorCreated(_op: Operator): void {
    this.newOperatorOpen.set(false);
    this.loadOperators();
  }

  private static rowMatchesQuery(
    row: Record<string, unknown>,
    q: string,
  ): boolean {
    const opSt = row['operationalStatus'];
    const statusKey = typeof opSt === 'string' ? opSt : '';
    const statusLabel =
      statusKey !== ''
        ? operatorOperationalStatusLabel(
            opSt as OperatorOperationalStatus,
          ).toLowerCase()
        : '';
    const haystack = [
      row['id'],
      row['name'],
      row['licenseNumber'],
      row['licenseExpiresOn'],
      statusKey,
      statusLabel,
      row['coverageKind'],
      row['maneuverCount'],
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');
    return haystack.includes(q);
  }

  private mapRow(
    o: Operator,
    maneuverCounts: Map<string, number>,
  ): Record<string, unknown> {
    const n = maneuverCounts.get(o.id) ?? 0;
    return {
      id: o.id,
      name: o.name,
      licenseNumber: o.licenseNumber,
      licenseExpiresOn: formatIsoDateEs(o.licenseExpiresOn),
      operationalStatus: o.status,
      coverageKind: operatorInsuranceKindLabel(o.insuranceKind),
      maneuverCount: String(n),
    };
  }
}
