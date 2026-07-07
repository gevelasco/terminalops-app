import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  model,
  OnInit,
  signal,
} from '@angular/core';
import { OperationalFleetSyncService } from '@core/services/state/operational-fleet-sync.service';
import { SessionService } from '@core/services/state/session';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { OperatorsDetailDrawerComponent } from '@features/operators/components/operators-detail-drawer/operators-detail-drawer.component';
import { OperatorsNewDrawerComponent } from '@features/operators/components/operators-new-drawer/operators-new-drawer.component';
import { OperatorsOverviewComponent } from '@features/operators/components/operators-overview/operators-overview.component';
import { OperatorsFeatureService } from '@features/operators/services/operators.service';
import {
  buildOperatorsOverviewCard,
  operatorOverviewMatchesQuery,
} from '@features/operators/utils/operators-overview-card';
import {
  operatorInsuranceKindLabel,
  operatorOperationalStatusLabel,
} from '@shared/catalogs/operator-form-options';
import type { Operator, OperatorOperationalStatus } from '@shared/models/logistics.models';
import { compareByOperatorOperationalStatus } from '@shared/utils/operator-operational-status-sort';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import {
  ToSegmentControlComponent,
  type ToSegmentTab,
} from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

export type OperatorsPageTab = 'operators' | 'list';

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
  providers: [OperatorsFeatureService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToPageHeaderComponent,
    ToInputComponent,
    ToTableComponent,
    ToSkeletonComponent,
    ToButtonComponent,
    ToSegmentControlComponent,
    OperatorsNewDrawerComponent,
    OperatorsDetailDrawerComponent,
    OperatorsOverviewComponent,
  ],
  templateUrl: './operators-page.component.html',
  styleUrl: './operators-page.component.scss',
})
export class OperatorsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly operatorsFeature = inject(OperatorsFeatureService);
  private readonly operationalSync = inject(OperationalFleetSyncService);
  private readonly session = inject(SessionService);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.operatorsFeature.dispose();
    });

    let operatorsEpochBaseline = this.operationalSync.operatorsMutationEpoch();
    effect(() => {
      const epoch = this.operationalSync.operatorsMutationEpoch();
      if (epoch === operatorsEpochBaseline) {
        return;
      }
      operatorsEpochBaseline = epoch;
      this.operatorsFeature.refreshOperators();
    });
  }

  readonly pageTab = signal<OperatorsPageTab>('operators');
  readonly viewSegmentTabs: readonly ToSegmentTab<OperatorsPageTab>[] = [
    {
      id: 'operators',
      label: 'Operadores',
      icon: 'groups',
      htmlId: 'operators-tab-operators',
    },
    {
      id: 'list',
      label: 'Lista',
      icon: 'list',
      htmlId: 'operators-tab-list',
    },
  ];

  readonly loading = computed(() => this.operatorsFeature.loading());
  readonly overviewCards = computed(() =>
    this.operatorsFeature
      .operators()
      .map((o) => buildOperatorsOverviewCard(o)),
  );

  readonly displayedOverviewCards = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.overviewCards();
    if (!q) {
      return all;
    }
    return all.filter((card) => operatorOverviewMatchesQuery(card, q));
  });
  readonly hasOperators = computed(
    () => this.operatorsFeature.operators().length > 0,
  );

  readonly rows = computed(() =>
    [...this.operatorsFeature.operators()]
      .sort(compareByOperatorOperationalStatus)
      .map((o) => OperatorsPageComponent.mapRow(o)),
  );
  readonly searchQuery = model('');
  readonly newOperatorOpen = signal(false);
  readonly canWriteOperators = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.OPERATORS),
  );

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
  }

  onPageTabSelect(tab: OperatorsPageTab): void {
    this.pageTab.set(tab);
    this.searchQuery.set('');
    if (tab === 'operators') {
      this.operatorsFeature.clearSelection();
    }
  }

  onOperatorCardClick(operatorId: string): void {
    if (!operatorId) {
      return;
    }
    this.operatorsFeature.selectOperator(operatorId);
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

  private static mapRow(o: Operator): Record<string, unknown> {
    return {
      id: o.id,
      name: o.name,
      licenseNumber: o.licenseNumber,
      licenseExpiresOn: formatIsoDateEs(o.licenseExpiresOn),
      operationalStatus: o.status,
      coverageKind: operatorInsuranceKindLabel(o.insuranceKind),
      maneuverCount: String(o.maneuverCount ?? 0),
    };
  }
}
