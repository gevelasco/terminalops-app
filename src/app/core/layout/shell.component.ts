import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChecklistDrawerComponent } from '@core/components/checklist-drawer/checklist-drawer.component';
import { NotificationsDrawerComponent } from '@core/components/notifications-drawer/notifications-drawer.component';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { ProfileDrawerComponent } from '@core/components/profile-drawer/profile-drawer.component';
import { AuthFacade } from '@core/services/auth.facade';
import { SessionLifecycleService } from '@core/services/session-lifecycle.service';
import { SessionService } from '@core/services/state/session';
import { NotificationsUnreadStore } from '@core/services/state/notifications-unread.store';
import { ChecklistTodosStore } from '@core/services/state/checklist-todos';
import {
  initialsFromDisplayName,
  UserProfileStore,
} from '@core/services/state/user-profile';
import { WebPushDeviceService } from '@core/services/web-push-device.service';
import { APP_NAV_ITEMS } from '@shared/models/app-modules.models';
import { roleDisplayLabel, visibleNavItems } from '@shared/utils/access-control';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ProfileDrawerComponent,
    NotificationsDrawerComponent,
    ChecklistDrawerComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnDestroy {
  private readonly auth = inject(AuthFacade);
  private readonly session = inject(SessionService);
  private readonly sessionLifecycle = inject(SessionLifecycleService);
  private readonly profiles = inject(UserProfileStore);
  private readonly notificationsUnread = inject(NotificationsUnreadStore);
  private readonly checklist = inject(ChecklistTodosStore);
  private readonly webPush = inject(WebPushDeviceService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly profileDrawerOpen = signal(false);
  readonly notificationsDrawerOpen = signal(false);
  readonly checklistDrawerOpen = signal(false);
  /** Drawer lateral en viewport estrecho (móvil / tablet) */
  readonly navOpen = signal(false);

  readonly displayName = computed(() => {
    const p = this.profiles.profile();
    if (p?.displayName?.trim()) {
      return p.displayName.trim();
    }
    const name = this.session.name()?.trim();
    if (name) {
      return name;
    }
    const u = this.session.username();
    if (!u) {
      return 'Usuario';
    }
    return u.charAt(0).toUpperCase() + u.slice(1).toLowerCase();
  });

  readonly roleLabel = computed(() => {
    const p = this.profiles.profile();
    if (p?.jobTitle?.trim()) {
      return p.jobTitle.trim();
    }
    return roleDisplayLabel(this.session.role());
  });

  readonly email = computed(() => {
    const p = this.profiles.profile();
    if (p?.email?.trim()) {
      return p.email.trim();
    }
    const fromSession = this.session.email()?.trim();
    if (fromSession) {
      return fromSession;
    }
    const u = this.session.username();
    return u ? `${u}@terminalops.local` : '';
  });

  readonly avatarPhotoUrl = computed(
    () =>
      this.profiles.profile()?.photoDataUrl?.trim() ||
      this.session.photoDataUrl()?.trim() ||
      '',
  );

  readonly avatarInitials = computed(() => {
    const name = this.displayName();
    if (name) {
      return initialsFromDisplayName(name);
    }
    return '??';
  });

  readonly mainNav = computed(() =>
    visibleNavItems(this.session.allowedModules(), 'main', APP_NAV_ITEMS, {
      role: this.session.role(),
      grants: this.session.moduleGrants(),
    }),
  );

  readonly bottomNav = computed(() =>
    visibleNavItems(this.session.allowedModules(), 'bottom', APP_NAV_ITEMS, {
      role: this.session.role(),
      grants: this.session.moduleGrants(),
    }),
  );

  readonly notificationCount = computed(() => this.notificationsUnread.badgeCount());

  readonly notificationBadgeLabel = computed(() => {
    const n = this.notificationCount();
    if (n > 99) {
      return '99+';
    }
    return String(n);
  });

  readonly checklistPendingCount = computed(() => this.checklist.pendingCount());

  readonly checklistBadgeLabel = computed(() => {
    const n = this.checklistPendingCount();
    if (n > 99) {
      return '99+';
    }
    return String(n);
  });

  readonly companyTitle = computed(
    () => this.session.companyName()?.trim() || 'Mi empresa',
  );

  readonly companyLegend = computed(
    () => this.session.companyTagline()?.trim() || 'Operaciones Logísticas',
  );

  readonly companyLogoUrl = computed(
    () => this.session.companyLogoDataUrl()?.trim() || null,
  );

  /** Fallback cuando la empresa aún no tiene logo. */
  readonly companyInitials = computed(() =>
    initialsFromDisplayName(this.companyTitle()),
  );

  constructor() {
    if (this.session.username()) {
      this.profiles.hydrateFromSession();
    }
    this.notificationsUnread.start();
    this.sessionLifecycle.start();
    this.webPush.bindNotificationClicks();
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.closeNav());
  }

  toggleNav(): void {
    this.navOpen.update((open) => !open);
    document.body.style.overflow = this.navOpen() ? 'hidden' : '';
  }

  closeNav(): void {
    this.navOpen.set(false);
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.profileDrawerOpen.set(false);
    this.notificationsDrawerOpen.set(false);
    this.checklistDrawerOpen.set(false);
    this.closeNav();
  }

  toggleChecklistDrawer(): void {
    this.checklistDrawerOpen.update((open) => !open);
    if (this.checklistDrawerOpen()) {
      this.profileDrawerOpen.set(false);
      this.notificationsDrawerOpen.set(false);
    }
  }

  closeChecklistDrawer(): void {
    this.checklistDrawerOpen.set(false);
  }

  toggleNotificationsDrawer(): void {
    this.profileDrawerOpen.set(false);
    this.checklistDrawerOpen.set(false);
    const next = !this.notificationsDrawerOpen();
    this.notificationsDrawerOpen.set(next);
    if (next) {
      this.notificationsUnread.markSeen();
    }
  }

  closeNotificationsDrawer(): void {
    this.notificationsDrawerOpen.set(false);
  }

  openProfileDrawer(): void {
    if (this.profileDrawerOpen()) {
      this.closeProfileDrawer();
      return;
    }
    this.profiles.hydrateFromSession();
    this.notificationsDrawerOpen.set(false);
    this.checklistDrawerOpen.set(false);
    this.profileDrawerOpen.set(true);
  }

  closeProfileDrawer(): void {
    this.profileDrawerOpen.set(false);
  }

  onProfileSaved(): void {
    this.profiles.hydrateFromSession();
  }

  onProfileSessionEnd(): void {
    this.closeProfileDrawer();
    try {
      this.auth.logout();
    } catch {
      /* clearClientState no debe impedir salir */
    }
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  ngOnDestroy(): void {
    this.sessionLifecycle.stop();
    this.notificationsUnread.stop();
    document.body.style.overflow = '';
  }
}
