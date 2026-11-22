import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionService } from '@core/services/state/session';
import { SettingsControlsTabComponent } from '@features/settings/components/settings-controls-tab/settings-controls-tab.component';
import { SettingsDataImportTabComponent } from '@features/settings/components/settings-data-import-tab/settings-data-import-tab.component';
import { UsersSettingsTabComponent } from '@features/users/components/users-settings-tab/users-settings-tab.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import {
  ToSegmentControlComponent,
  type ToSegmentTab,
} from '@shared/ui/to-segment-control/to-segment-control.component';

export type SettingsPageTab = 'controles' | 'users' | 'datos';

const SETTINGS_TABS = new Set<SettingsPageTab>(['controles', 'users', 'datos']);

function resolveSettingsTab(
  raw: string | null | undefined,
  canViewControls: boolean,
): SettingsPageTab {
  const tab = raw?.trim() as SettingsPageTab | undefined;
  if (tab && SETTINGS_TABS.has(tab)) {
    if ((tab === 'controles' || tab === 'datos') && !canViewControls) {
      return 'users';
    }
    return tab;
  }
  return canViewControls ? 'controles' : 'users';
}

@Component({
  selector: 'app-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'settings-page-host',
  },
  imports: [
    ToPageHeaderComponent,
    ToButtonComponent,
    ToIconComponent,
    ToSegmentControlComponent,
    SettingsControlsTabComponent,
    SettingsDataImportTabComponent,
    UsersSettingsTabComponent,
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  private readonly usersTabRef = viewChild(UsersSettingsTabComponent);
  private readonly controlsTabRef = viewChild(SettingsControlsTabComponent);

  readonly pageTab = signal<SettingsPageTab>('controles');

  readonly canViewControls = computed(() => {
    const role = this.session.role();
    return role === 'admin' || role === 'superadmin';
  });

  readonly viewSegmentTabs = computed(
    (): readonly ToSegmentTab<SettingsPageTab>[] => {
      const tabs: ToSegmentTab<SettingsPageTab>[] = [];
      if (this.canViewControls()) {
      tabs.push({
        id: 'controles',
        label: 'Controles',
        icon: 'maintenance',
        htmlId: 'settings-tab-controles',
      });
      tabs.push({
        id: 'datos',
        label: 'Datos',
        icon: 'upload',
        htmlId: 'settings-tab-datos',
      });
    }
    tabs.push({
      id: 'users',
      label: 'Usuarios',
      icon: 'person',
      htmlId: 'settings-tab-users',
    });
      return tabs;
    },
  );

  readonly usersTabLoading = computed(
    () => this.usersTabRef()?.loading() ?? true,
  );

  readonly controlsSaving = computed(
    () => this.controlsTabRef()?.saving() ?? false,
  );

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.applySettingsTabFromRoute(params.get('settingsTab'));
      });
  }

  ngOnInit(): void {
    this.applySettingsTabFromRoute(
      this.route.snapshot.paramMap.get('settingsTab'),
    );
  }

  private applySettingsTabFromRoute(rawTab: string | null): void {
    const tab = resolveSettingsTab(rawTab, this.canViewControls());
    if (rawTab != null && rawTab.trim() !== tab) {
      void this.router.navigate(['/settings', tab], { replaceUrl: true });
      return;
    }
    this.pageTab.set(tab);
  }

  onPageTabSelect(tab: SettingsPageTab): void {
    if (this.pageTab() === tab) {
      return;
    }
    void this.router.navigate(['/settings', tab]);
  }

  openNewUser(): void {
    this.usersTabRef()?.openNewUser();
  }

  saveControls(): void {
    this.controlsTabRef()?.saveCompanyConfiguration();
  }
}