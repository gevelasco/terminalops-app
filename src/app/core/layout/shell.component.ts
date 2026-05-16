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
import { forkJoin } from 'rxjs';
import { ChecklistDrawerComponent } from '@core/components/checklist-drawer/checklist-drawer.component';
import { IncidentsNotificationsDrawerComponent } from '@core/components/incidents-notifications-drawer/incidents-notifications-drawer.component';
import { ManiobraRepository } from '@features/maniobra/data/maniobra.repository';
import { OperatorRepository } from '@features/operators/data/operator.repository';
import { buildTripIncidentFeed } from '@shared/utils/trip-incident-feed';
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
import { SessionStore } from '@core/services/session.store';
import {
  initialsFromDisplayName,
  UserProfileStore,
} from '@core/services/user-profile.store';
import { environment } from '../../../environments/environment';

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
  private readonly session = inject(SessionStore);
  private readonly profiles = inject(UserProfileStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly maniobrasRepo = inject(ManiobraRepository);
  private readonly operatorsRepo = inject(OperatorRepository);

  readonly profileDrawerOpen = signal(false);
  readonly notificationsDrawerOpen = signal(false);
  readonly checklistDrawerOpen = signal(false);
  private readonly incidentFeedCount = signal(0);
  /** Drawer lateral en viewport estrecho (móvil / tablet) */
  readonly navOpen = signal(false);

  readonly displayName = computed(() => {
    const p = this.profiles.profile();
    if (p?.displayName?.trim()) {
      return p.displayName.trim();
    }
    if (environment.authDevBypass) {
      return 'Admin Cargo';
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
    return environment.authDevBypass ? 'Supervisor' : 'Operador';
  });

  readonly email = computed(() => {
    const p = this.profiles.profile();
    if (p?.email?.trim()) {
      return p.email.trim();
    }
    if (environment.authDevBypass) {
      return 'admin@cargo.mx';
    }
    const u = this.session.username();
    return u ? `${u}@terminalops.local` : 'usuario@terminalops.local';
  });

  readonly avatarPhotoUrl = computed(() => this.profiles.profile()?.photoDataUrl?.trim() ?? '');

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

  readonly notificationCount = computed(() => this.incidentFeedCount());

  constructor() {
    const u = this.session.username();
    if (u) {
      this.profiles.load(u);
    }
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.closeNav());

    this.refreshIncidentFeedCount();
  }

  private refreshIncidentFeedCount(): void {
    forkJoin({
      trips: this.maniobrasRepo.list(),
      operators: this.operatorsRepo.list(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ trips, operators }) => {
          this.incidentFeedCount.set(buildTripIncidentFeed(trips, operators).length);
        },
        error: () => this.incidentFeedCount.set(0),
      });
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
    if (this.notificationsDrawerOpen()) {
      this.refreshIncidentFeedCount();
    }
  }

  closeNotificationsDrawer(): void {
    this.notificationsDrawerOpen.set(false);
    this.refreshIncidentFeedCount();
  }

  openProfileDrawer(): void {
    if (this.profileDrawerOpen()) {
      this.closeProfileDrawer();
      return;
    }
    const u = this.session.username();
    if (u) {
      this.profiles.load(u);
    }
    this.notificationsDrawerOpen.set(false);
    this.checklistDrawerOpen.set(false);
    this.profileDrawerOpen.set(true);
  }

  closeProfileDrawer(): void {
    this.profileDrawerOpen.set(false);
  }

  onProfileSaved(): void {
    const u = this.session.username();
    if (u) {
      this.profiles.load(u);
    }
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
