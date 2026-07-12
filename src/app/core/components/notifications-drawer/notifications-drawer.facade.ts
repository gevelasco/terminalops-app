import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NotificationsService,
  type NotificationFeedItem,
  type NotificationPeriod,
  type NotificationsFeedResponse,
} from '@core/services/api/notifications';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';

export type NotificationsLoadOptions = {
  onLoaded?: (response: NotificationsFeedResponse) => void;
};

/** Estado efímero del drawer: se crea y destruye con el componente (sin store global). */
@Injectable()
export class NotificationsDrawerFacade {
  private readonly notificationsApi = inject(NotificationsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly period = signal<NotificationPeriod>('day');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<NotificationFeedItem[]>([]);
  readonly total = signal(0);

  readonly periodTabs: {
    value: NotificationPeriod;
    label: string;
    icon: ToIconName;
  }[] = [
    { value: 'day', label: 'Día', icon: 'periodToday' },
    { value: 'week', label: 'Semana', icon: 'periodWeek' },
    { value: 'month', label: 'Mes', icon: 'calendar' },
  ];

  load(options?: NotificationsLoadOptions): void {
    this.loading.set(true);
    this.error.set(null);
    this.notificationsApi
      .getFeed({ period: this.period(), limit: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.items.set(response.items);
          this.total.set(response.total);
          this.loading.set(false);
          options?.onLoaded?.(response);
        },
        error: () => {
          this.items.set([]);
          this.total.set(0);
          this.error.set('No se pudieron cargar las notificaciones.');
          this.loading.set(false);
        },
      });
  }

  setPeriod(period: NotificationPeriod): void {
    if (this.period() === period) {
      return;
    }
    this.period.set(period);
    this.load();
  }

  reset(): void {
    this.period.set('day');
    this.loading.set(false);
    this.error.set(null);
    this.items.set([]);
    this.total.set(0);
  }
}
