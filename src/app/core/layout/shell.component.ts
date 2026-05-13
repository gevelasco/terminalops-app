import {
  Component,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { AuthFacade } from '@core/services/auth.facade';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);

  readonly theme = inject(ThemeService);

  readonly userMenuOpen = signal(false);
  /** Drawer lateral en viewport estrecho (móvil / tablet) */
  readonly navOpen = signal(false);

  readonly displayName = 'Admin Cargo';
  readonly roleLabel = 'Supervisor';
  readonly email = 'admin@cargo.mx';
  readonly avatarInitials = 'AC';

  readonly nav = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/maniobra', label: 'Maniobras' },
    { path: '/fleet', label: 'Flota' },
    { path: '/operators', label: 'Operadores' },
    { path: '/expenses', label: 'Gastos' },
    { path: '/reports', label: 'Reportes' },
  ] as const;

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
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

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen.update((open) => !open);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.userMenuOpen()) {
      return;
    }
    const panel = this.host.nativeElement.querySelector('[data-user-area]');
    if (panel && !panel.contains(event.target as Node)) {
      this.userMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.userMenuOpen.set(false);
    this.closeNav();
  }

  toggleTheme(event: Event): void {
    event.stopPropagation();
    this.theme.toggleScheme();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  logout(): void {
    this.auth.logout();
    this.closeUserMenu();
    void this.router.navigate(['/login']);
  }
}
