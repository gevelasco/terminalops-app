import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
  signal,
} from '@angular/core';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { ClientsDetailDrawerComponent } from '@features/clients/components/clients-detail-drawer/clients-detail-drawer.component';
import { ClientsNewDrawerComponent } from '@features/clients/components/clients-new-drawer/clients-new-drawer.component';
import { tripCountByClientId } from '@features/clients/utils/trip-count-by-client-name';
import { ManiobraRepository } from '@features/maniobra/data/maniobra.repository';
import { ClientRepository } from '@shared/data/client.repository';
import { clientCommercialHealthLabel } from '@shared/catalogs/client-form-options';
import type { Client } from '@shared/models/client.models';
import type { Trip } from '@shared/models/logistics.models';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

function formatRelationshipDateEs(ymd: string | undefined): string {
  const t = (ymd ?? '').trim();
  if (!t) {
    return '—';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return t;
  }
  const d = new Date(`${t}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return t;
  }
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(d);
}

@Component({
  selector: 'app-clients-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToPageHeaderComponent,
    ToInputComponent,
    ToTableComponent,
    ToSkeletonComponent,
    ToButtonComponent,
    ClientsNewDrawerComponent,
    ClientsDetailDrawerComponent,
  ],
  templateUrl: './clients-page.component.html',
  styleUrl: './clients-page.component.scss',
})
export class ClientsPageComponent {
  private readonly repo = inject(ClientRepository);
  private readonly maniobrasRepo = inject(ManiobraRepository);

  readonly loading = signal(true);
  readonly rows = signal<Record<string, unknown>[]>([]);
  readonly searchQuery = model('');
  readonly newClientOpen = signal(false);
  readonly detailClient = signal<Client | null>(null);
  readonly tripRows = signal<Trip[]>([]);

  readonly columns: ToTableColumn[] = [
    { key: 'name', label: 'Cliente' },
    { key: 'rfc', label: 'RFC', cell: 'muted-badge' },
    {
      key: 'relationshipLabel',
      label: 'Sociedad desde',
    },
    {
      key: 'commercialHealth',
      label: 'Estatus',
      cell: 'client-health-pill',
    },
    { key: 'maneuverCount', label: 'Maniobras' },
  ];

  readonly displayedClientRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.rows();
    if (!q) {
      return all;
    }
    return all.filter((row) => ClientsPageComponent.rowMatchesQuery(row, q));
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    forkJoin({
      clients: this.repo.list().pipe(catchError(() => of([] as Client[]))),
      trips: this.maniobrasRepo
        .list()
        .pipe(catchError(() => of([] as Trip[]))),
    }).subscribe({
      next: ({ clients, trips }) => {
        this.tripRows.set(trips);
        this.rows.set(
          clients.map((c) => this.mapRow(c, trips)),
        );
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
    void firstValueFrom(this.repo.get(id)).then((c) => {
      if (c) {
        this.detailClient.set(c);
      }
    });
  }

  onDetailDismiss(): void {
    this.detailClient.set(null);
  }

  onDetailClientChange(c: Client): void {
    this.detailClient.set(c);
    this.reload();
  }

  onClientCreated(_c: Client): void {
    this.newClientOpen.set(false);
    this.reload();
  }

  maneuverCountForClient(c: Client): number {
    return tripCountByClientId(this.tripRows(), c.id);
  }

  private static rowMatchesQuery(
    row: Record<string, unknown>,
    q: string,
  ): boolean {
    const healthCode = row['commercialHealth'];
    const healthLabel =
      typeof healthCode === 'string'
        ? clientCommercialHealthLabel(healthCode).toLowerCase()
        : '';
    const haystack = [
      row['id'],
      row['name'],
      row['rfc'],
      row['relationshipLabel'],
      healthCode,
      healthLabel,
      row['maneuverCount'],
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');
    return haystack.includes(q);
  }

  private mapRow(c: Client, trips: readonly Trip[]): Record<string, unknown> {
    const n = tripCountByClientId(trips, c.id);
    return {
      id: c.id,
      name: c.name,
      rfc: c.rfc?.trim() || '—',
      relationshipLabel: formatRelationshipDateEs(c.relationshipStartedOn),
      commercialHealth:
        (c.payment?.commercialHealth as string | undefined) ?? 'not_evaluated',
      maneuverCount: String(n),
    };
  }
}
