import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  model,
  OnInit,
  signal,
} from '@angular/core';
import { OperatorsDetailDrawerComponent } from '@features/operators/components/operators-detail-drawer/operators-detail-drawer.component';
import { OperatorsNewDrawerComponent } from '@features/operators/components/operators-new-drawer/operators-new-drawer.component';
import { OperatorsFeatureService } from '@features/operators/services/operators.service';
import { completedManeuverCountsByOperatorId } from '@features/operators/utils/completed-maneuver-counts-by-operator-id';
import { OperationalTripsFeatureService } from '@features/trips/services/operational-trips.service';
import { deriveOperatorOperationalStatus } from '@features/trips/utils/trip-derived-operational-status';
import {
  operatorInsuranceKindLabel,
  operatorOperationalStatusLabel,
} from '@shared/catalogs/operator-form-options';
import type {
  Operator,
  OperatorOperationalStatus,
  Trip,
} from '@shared/models/logistics.models';
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
  providers: [OperatorsFeatureService, OperationalTripsFeatureService],
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
export class OperatorsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly operatorsFeature = inject(OperatorsFeatureService);
  private readonly operationalTrips = inject(OperationalTripsFeatureService);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.operatorsFeature.dispose();
      this.operationalTrips.dispose();
    });
  }

  readonly loading = computed(
    () => this.operatorsFeature.loading() || this.operationalTrips.loading(),
  );
  readonly completedManeuverCounts = computed(() =>
    completedManeuverCountsByOperatorId([...this.operationalTrips.trips()]),
  );
  readonly rows = computed(() => {
    const counts = this.completedManeuverCounts();
    const trips = this.operationalTrips.trips();
    return this.operatorsFeature
      .operators()
      .map((o) => OperatorsPageComponent.mapRow(o, counts, trips));
  });
  readonly searchQuery = model('');
  readonly newOperatorOpen = signal(false);

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

  readonly displayedOperatorRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.rows();
    if (!q) {
      return all;
    }
    return all.filter((row) => OperatorsPageComponent.rowMatchesQuery(row, q));
  });

  ngOnInit(): void {
    this.operatorsFeature.loadOperators();
    this.operationalTrips.loadTrips();
  }

  onRowClick(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    if (!id) {
      return;
    }
    this.operatorsFeature.selectOperator(id);
  }

  onDetailDismiss(): void {
    this.operatorsFeature.clearSelection();
  }

  onOperatorCreated(_op: Operator): void {
    this.newOperatorOpen.set(false);
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

  private static mapRow(
    o: Operator,
    maneuverCounts: Map<string, number>,
    trips: readonly Trip[],
  ): Record<string, unknown> {
    const n = maneuverCounts.get(o.id) ?? 0;
    return {
      id: o.id,
      name: o.name,
      licenseNumber: o.licenseNumber,
      licenseExpiresOn: formatIsoDateEs(o.licenseExpiresOn),
      operationalStatus: deriveOperatorOperationalStatus(o, trips),
      coverageKind: operatorInsuranceKindLabel(o.insuranceKind),
      maneuverCount: String(n),
    };
  }
}
