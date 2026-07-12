import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  output,
} from '@angular/core';
import { Router } from '@angular/router';
import { NotificationsDrawerFacade } from './notifications-drawer.facade';
import {
  isNotificationNavigable,
  resolveNotificationNavigation,
} from './notification-navigation.util';
import type { NotificationFeedItem } from '@core/services/api/notifications';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';

@Component({
  selector: 'app-notifications-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NotificationsDrawerFacade, DateShortPipe],
  imports: [ToSideDrawerComponent, ToIconComponent],
  templateUrl: './notifications-drawer.component.html',
  styleUrls: [
    '../../../features/fleet/components/fleet-drawer.shared.scss',
    './notifications-drawer.component.scss',
  ],
})
export class NotificationsDrawerComponent implements OnInit, OnDestroy {
  readonly facade = inject(NotificationsDrawerFacade);
  private readonly dateShort = inject(DateShortPipe);
  private readonly router = inject(Router);

  readonly dismiss = output<void>();
  readonly dayTotalChange = output<number>();

  ngOnInit(): void {
    this.facade.load({
      onLoaded: (response) => {
        if (response.period === 'day') {
          this.dayTotalChange.emit(response.total);
        }
      },
    });
  }

  ngOnDestroy(): void {
    this.facade.reset();
  }

  formatDate(iso: string): string {
    return this.dateShort.transform(iso) ?? iso;
  }

  iconName(icon: string): ToIconName {
    const map: Record<string, ToIconName> = {
      bell: 'updates',
      clients: 'client',
      trip: 'route',
    };
    if (map[icon]) {
      return map[icon];
    }
    const allowed = new Set<string>([
      ...Object.keys(map),
      'document',
      'warning',
      'unit',
      'equipment',
      'client',
      'settlement',
      'route',
      'person',
      'tracking',
      'maintenance',
      'updates',
    ]);
    return allowed.has(icon) ? (icon as ToIconName) : 'updates';
  }

  isNavigable(item: NotificationFeedItem): boolean {
    return isNotificationNavigable(item);
  }

  onItemActivate(item: NotificationFeedItem): void {
    const target = resolveNotificationNavigation(item);
    if (!target) {
      return;
    }
    this.dismiss.emit();
    void this.router.navigate(target.commands, {
      queryParams: target.queryParams,
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.dismiss.emit();
    }
  }
}
