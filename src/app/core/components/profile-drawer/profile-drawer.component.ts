import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { UserProfile } from '@core/models/user-profile.models';
import {
  initialsFromDisplayName,
  UserProfileStore,
} from '@core/services/state/user-profile';
import { SessionService } from '@core/services/state/session';
import { ThemeService, type ThemePreset } from '@core/services/state/theme';
import { ToastService } from '@core/notifications/toast.service';
import { isNumericPublicId } from '@core/utils/api-date';
import {
  formatMemberSinceLong,
  formatTenureLabel,
} from '@core/utils/user-profile-tenure';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSegmentControlComponent,
  type ToSegmentTab,
} from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import { ProfileDrawerConfigTabComponent } from './profile-drawer-config-tab.component';

type ProfileEditSection = 'personal' | 'password';
type ProfileDrawerTab = 'perfil' | 'config';

@Component({
  selector: 'app-profile-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToSideDrawerComponent,
    ToSegmentControlComponent,
    ToIconComponent,
    ToButtonComponent,
    ToInputComponent,
    ProfileDrawerConfigTabComponent,
  ],
  templateUrl: './profile-drawer.component.html',
  styleUrls: [
    '../../../features/fleet/components/fleet-drawer.shared.scss',
    '../../../features/fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    '../../../features/fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    './profile-drawer.component.scss',
  ],
})
export class ProfileDrawerComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly profileStore = inject(UserProfileStore);
  private readonly session = inject(SessionService);
  readonly theme = inject(ThemeService);

  readonly themeSegmentTabs: readonly ToSegmentTab<ThemePreset>[] = [
    { id: 'light', label: 'Claro', icon: 'themeLight' },
    { id: 'dark', label: 'Oscuro', icon: 'themeDark' },
  ];
  readonly activeThemePreset = computed(() => this.theme.activePreset());

  readonly dismiss = output<void>();
  readonly saved = output<UserProfile>();
  readonly sessionEnd = output<void>();

  readonly drawerLoading = signal(true);
  readonly editingSection = signal<ProfileEditSection | null>(null);
  readonly saving = signal(false);
  readonly photoSaving = signal(false);
  readonly profileTab = signal<ProfileDrawerTab>('perfil');

  readonly displayName = model('');
  readonly username = model('');
  readonly jobTitle = model('');
  readonly email = model('');
  readonly phone = model('');
  readonly newPassword = model('');
  readonly confirmPassword = model('');
  readonly currentPassword = model('');
  readonly photoDataUrl = signal('');

  readonly canViewConfigTab = computed(() => {
    const role = this.session.role();
    return role === 'admin' || role === 'superadmin';
  });

  readonly profileDrawerTabs = computed((): readonly ToSegmentTab<ProfileDrawerTab>[] => {
    const tabs: ToSegmentTab<ProfileDrawerTab>[] = [
      { id: 'perfil', label: 'Perfil', icon: 'person', htmlId: 'profile-tab-perfil' },
    ];
    if (this.canViewConfigTab()) {
      tabs.push({
        id: 'config',
        label: 'Configuración',
        icon: 'maintenance',
        htmlId: 'profile-tab-config',
      });
    }
    return tabs;
  });

  readonly configTabRef = viewChild(ProfileDrawerConfigTabComponent);
  readonly configSaving = computed(() => this.configTabRef()?.saving() ?? false);

  constructor() {
    this.reloadFromStore();
    afterNextRender(() => this.drawerLoading.set(false));
  }

  selectProfileTab(tab: ProfileDrawerTab): void {
    this.profileTab.set(tab);
    if (this.editingSection()) {
      this.cancelSectionEdit();
    }
  }

  saveCompanyConfiguration(): void {
    this.configTabRef()?.saveCompanyConfiguration();
  }

  isEditing(section: ProfileEditSection): boolean {
    return this.editingSection() === section;
  }

  avatarPreview(): string {
    return initialsFromDisplayName(this.displayName() || this.username());
  }

  hasPhoto(): boolean {
    return this.photoDataUrl().trim().length > 0;
  }

  memberSinceLine(): string {
    const iso = this.session.memberSince()?.trim() ?? '';
    return iso ? formatMemberSinceLong(iso) : '—';
  }

  tenureLine(): string {
    const iso = this.session.memberSince()?.trim() ?? '';
    return iso ? formatTenureLabel(iso) : '—';
  }

  departmentLine(): string {
    return this.session.department()?.trim() || 'Gerencia';
  }

  workLocationLine(): string {
    return (
      this.session.workLocation()?.trim() ||
      this.session.companyName()?.trim() ||
      '—'
    );
  }

  employeeIdLine(): string {
    const id =
      this.session.employeeId()?.trim() ?? this.session.userId()?.trim() ?? '';
    return isNumericPublicId(id) ? id : '—';
  }

  passwordStatusLabel(): string {
    return 'Configurada';
  }

  setTheme(preset: ThemePreset): void {
    if (preset === this.theme.activePreset()) {
      return;
    }
    this.profileStore
      .patchProfile({ theme: preset })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.theme.setPreset(preset);
          this.toast.show('Tema actualizado.', 'success');
        },
        error: () => {
          this.toast.show('No se pudo guardar el tema.', 'warning');
        },
      });
  }

  logout(): void {
    this.sessionEnd.emit();
  }

  startEditSection(section: ProfileEditSection): void {
    if (section === 'password') {
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
    }
    this.editingSection.set(section);
  }

  cancelSectionEdit(): void {
    this.reloadFromStore();
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.editingSection.set(null);
  }

  onPhotoSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.toast.show('Selecciona un archivo de imagen.', 'warning');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.toast.show('La imagen debe pesar menos de 2 MB.', 'warning');
      return;
    }
    this.photoSaving.set(true);
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      this.photoDataUrl.set(url);
      this.savePhotoOnly(url);
    };
    reader.onerror = () => {
      this.photoSaving.set(false);
      this.toast.show('No se pudo leer la imagen.', 'warning');
    };
    reader.readAsDataURL(file);
  }

  removePhotoAndSave(): void {
    this.photoDataUrl.set('');
    this.savePhotoOnly('');
  }

  savePersonalSection(): void {
    const displayName = this.displayName().trim();
    const username = this.username().trim().toLowerCase();
    const jobTitle = this.jobTitle().trim();
    const email = this.email().trim();
    const phone = this.phone().trim();

    if (!displayName) {
      this.toast.show('Indica tu nombre.', 'warning');
      return;
    }
    if (!username) {
      this.toast.show('Indica tu usuario.', 'warning');
      return;
    }
    if (!email) {
      this.toast.show('Indica tu correo electrónico.', 'warning');
      return;
    }

    this.saving.set(true);
    this.profileStore
      .patchProfile({ displayName, username, jobTitle, email, phone })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.patchForm(profile);
          this.editingSection.set(null);
          this.saving.set(false);
          this.toast.show('Datos personales actualizados.', 'success');
          this.saved.emit(profile);
        },
        error: (err) => {
          this.saving.set(false);
          const msg =
            typeof err?.error?.message === 'string'
              ? err.error.message
              : 'No se pudieron guardar los datos personales.';
          this.toast.show(msg, 'warning');
        },
      });
  }

  savePasswordSection(): void {
    const current = this.currentPassword().trim();
    const next = this.newPassword().trim();
    const confirm = this.confirmPassword().trim();

    if (!current) {
      this.toast.show('Indica tu contraseña actual.', 'warning');
      return;
    }
    if (next.length < 6) {
      this.toast.show('La contraseña debe tener al menos 6 caracteres.', 'warning');
      return;
    }
    if (next !== confirm) {
      this.toast.show('Las contraseñas no coinciden.', 'warning');
      return;
    }

    this.saving.set(true);
    this.profileStore
      .patchPassword(current, next)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.currentPassword.set('');
          this.newPassword.set('');
          this.confirmPassword.set('');
          this.editingSection.set(null);
          this.saving.set(false);
          this.toast.show('Contraseña actualizada.', 'success');
        },
        error: (err) => {
          this.saving.set(false);
          const status = err?.status as number | undefined;
          const msg =
            typeof err?.error?.message === 'string'
              ? err.error.message
              : status === 401
                ? 'La contraseña actual no es correcta.'
                : 'No se pudo actualizar la contraseña.';
          this.toast.show(msg, 'warning');
        },
      });
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      if (this.editingSection()) {
        this.cancelSectionEdit();
        return;
      }
      this.dismiss.emit();
    }
  }

  private reloadFromStore(): void {
    const profile = this.profileStore.hydrateFromSession();
    if (profile) {
      this.patchForm(profile);
    }
  }

  private savePhotoOnly(photoDataUrl: string): void {
    this.profileStore
      .patchProfile({ photoDataUrl })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.patchForm(profile);
          this.photoSaving.set(false);
          this.toast.show(
            photoDataUrl ? 'Foto de perfil actualizada.' : 'Foto de perfil eliminada.',
            'success',
          );
          this.saved.emit(profile);
        },
        error: () => {
          this.photoSaving.set(false);
          this.toast.show('No se pudo guardar la foto de perfil.', 'warning');
        },
      });
  }

  private patchForm(p: UserProfile): void {
    this.displayName.set(p.displayName);
    this.username.set(p.username);
    this.jobTitle.set(p.jobTitle);
    this.email.set(p.email);
    this.phone.set(p.phone || this.session.phone()?.trim() || '');
    this.photoDataUrl.set(p.photoDataUrl ?? '');
  }
}
