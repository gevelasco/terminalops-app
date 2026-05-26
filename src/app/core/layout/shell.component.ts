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
import { IncidentsNotificationsDrawerComponent } from '@core/components/incidents-notifications-drawer/incidents-notifications-drawer.component';
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
import { SessionService } from '@core/services/state/session';
import {
  initialsFromDisplayName,
  UserProfileStore,
} from '@core/services/state/user-profile';
import { UserPreferencesStore } from '@core/services/state/user-preferences';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ProfileDrawerComponent,
    IncidentsNotificationsDrawerComponent,
    ChecklistDrawerComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnDestroy {
  private readonly auth = inject(AuthFacade);
  private readonly session = inject(SessionService);
  private readonly profiles = inject(UserProfileStore);
  private readonly preferences = inject(UserPreferencesStore);
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
    const role = this.session.role();
    if (role === 'admin') {
      return 'Administrador';
    }
    if (role === 'coordinator') {
      return 'Coordinador';
    }
    if (role === 'viewer') {
      return 'Consulta';
    }
    return 'Operador';
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
      this.profiles.profile()?.photoDataUrl?.trim() ??
      this.session.photoDataUrl()?.trim() ??
      '',
  );

  readonly avatarInitials = computed(() => {
    const name = this.displayName();
    if (name) {
      return initialsFromDisplayName(name);
    }
    return '??';
  });

  readonly nav = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/maniobra', label: 'Maniobras' },
    { path: '/fleet', label: 'Flota' },
    { path: '/operators', label: 'Operadores' },
    { path: '/clients', label: 'Clientes' },
    { path: '/expenses', label: 'Gastos' },
    { path: '/reports', label: 'Reportes' },
  ] as const;

  /** Sin prefetch global de maniobras: el badge queda en 0 hasta integrar caché del módulo. */
  readonly notificationCount = computed(() => 0);

  readonly companyTitle = computed(
    () => this.session.companyName()?.trim() || 'Mi empresa',
  );

  constructor() {
    if (this.session.username()) {
      this.profiles.hydrateFromSession();
      this.preferences.ensureLoaded();
    }
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
    this.notificationsDrawerOpen.update((open) => !open);
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
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }
}
