import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { CRITICAL_ALERT_ICON_PATHS } from '@features/dashboard/critical-alert-icon-paths';
import { ManiobraRepository } from '@features/maniobra/data/maniobra.repository';
import { OperatorRepository } from '@features/operators/data/operator.repository';
import type { CriticalAlertKind, IncidentSeverity } from '@shared/models/logistics.models';
import {
  buildTripIncidentFeed,
  type TripIncidentFeedItem,
} from '@shared/utils/trip-incident-feed';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import {
  ToBadgeComponent,
  ToBadgeVariant,
} from '@shared/ui/to-badge/to-badge.component';
import { ToDrawerSkeletonComponent } from '@shared/ui/to-drawer-skeleton/to-drawer-skeleton.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';

export type IncidentSeverityFilter = 'all' | IncidentSeverity;

/** Iconos Material para tabs de prioridad (misma escala que alertas críticas). */
const SEVERITY_FILTER_ICON_PATHS: Record<IncidentSeverityFilter, string> = {
  all: 'M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z',
  critical: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  high: 'M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6L12 2z',
  medium:
    'M11 7h2v2h-2V7zm0 4h2v6h-2v-6zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z',
  low: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
};

@Component({
  selector: 'app-incidents-notifications-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DateShortPipe],
  imports: [ToDrawerSkeletonComponent, ToIconButtonComponent, ToBadgeComponent],
  templateUrl: './incidents-notifications-drawer.component.html',
  styleUrls: [
    '../../../features/fleet/components/fleet-drawer.shared.scss',
    './incidents-notifications-drawer.component.scss',
  ],
})
export class IncidentsNotificationsDrawerComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly maniobrasRepo = inject(ManiobraRepository);
  private readonly operatorsRepo = inject(OperatorRepository);
  private readonly dateShort = inject(DateShortPipe);

  readonly dismiss = output<void>();

  readonly severityFilter = model<IncidentSeverityFilter>('all');
  readonly loading = signal(true);
  private readonly feed = signal<TripIncidentFeedItem[]>([]);

  readonly criticalIconPaths = CRITICAL_ALERT_ICON_PATHS;

  readonly filterChips: { value: IncidentSeverityFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'critical', label: 'Crítico' },
    { value: 'high', label: 'Alto' },
    { value: 'medium', label: 'Medio' },
    { value: 'low', label: 'Bajo' },
  ];

  readonly filteredFeed = computed(() => {
    const f = this.severityFilter();
    const list = this.feed();
    if (f === 'all') {
      return list;
    }
    return list.filter((item) => item.severity === f);
  });

  constructor() {
    this.doc.body.style.overflow = 'hidden';
    this.destroyRef.onDestroy(() => {
      this.doc.body.style.overflow = '';
    });

    forkJoin({
      trips: this.maniobrasRepo.list(),
      operators: this.operatorsRepo.list(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ trips, operators }) => {
          this.feed.set(buildTripIncidentFeed(trips, operators));
          this.loading.set(false);
        },
        error: () => {
          this.feed.set([]);
          this.loading.set(false);
        },
      });
  }

  setFilter(value: IncidentSeverityFilter): void {
    this.severityFilter.set(value);
  }

  iconPath(kind: CriticalAlertKind): string {
    return this.criticalIconPaths[kind];
  }

  filterTabIconPath(filter: IncidentSeverityFilter): string {
    return SEVERITY_FILTER_ICON_PATHS[filter];
  }

  formatDate(iso: string): string {
    return this.dateShort.transform(iso) ?? iso;
  }

  filterEmptySuffix(): string {
    const f = this.severityFilter();
    if (f === 'all') {
      return 'registrados.';
    }
    const chip = this.filterChips.find((c) => c.value === f);
    return `con prioridad «${chip?.label ?? f}».`;
  }

  severityLabel(s: IncidentSeverity): string {
    switch (s) {
      case 'critical':
        return 'Crítico';
      case 'high':
        return 'Alto';
      case 'medium':
        return 'Medio';
      case 'low':
        return 'Bajo';
    }
  }

  badgeVariant(s: IncidentSeverity): ToBadgeVariant {
    switch (s) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'neutral';
      case 'low':
        return 'success';
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }
}
