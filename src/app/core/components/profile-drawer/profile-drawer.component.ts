import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import type { UserProfile } from '@core/models/user-profile.models';
import {
  defaultUserProfile,
  initialsFromDisplayName,
  UserProfileStore,
} from '@core/services/user-profile.store';
import { SessionStore } from '@core/services/session.store';
import { ThemeService, type ThemePreset } from '@core/services/theme.service';
import { ToastService } from '@core/notifications/toast.service';
import {
  formatMemberSinceLong,
  formatTenureLabel,
} from '@core/utils/user-profile-tenure';
import { ToDrawerSkeletonComponent } from '@shared/ui/to-drawer-skeleton/to-drawer-skeleton.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconButtonComponent } from '@shared/ui/to-icon-button/to-icon-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';

type ProfileEditSection = 'collaborator' | 'personal' | 'password';

@Component({
  selector: 'app-profile-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    ToButtonComponent,
    ToIconButtonComponent,
    ToInputComponent,
    ToDrawerSkeletonComponent,
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
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly profileStore = inject(UserProfileStore);
  private readonly session = inject(SessionStore);
  readonly theme = inject(ThemeService);

  readonly dismiss = output<void>();
  readonly saved = output<UserProfile>();
  readonly sessionEnd = output<void>();

  readonly drawerLoading = signal(true);
  readonly editingSection = signal<ProfileEditSection | null>(null);
  readonly saving = signal(false);
  readonly photoSaving = signal(false);

  readonly displayName = model('');
  readonly username = model('');
  readonly jobTitle = model('');
  readonly email = model('');
  readonly phone = model('');
  readonly newPassword = model('');
  readonly confirmPassword = model('');
  readonly photoDataUrl = signal('');
  readonly memberSince = signal('');
  readonly department = model('');
  readonly employeeId = model('');
  readonly workLocation = model('');

  constructor() {
    this.doc.body.style.overflow = 'hidden';
    this.destroyRef.onDestroy(() => {
      this.doc.body.style.overflow = '';
    });
    this.reloadFromStore();
    afterNextRender(() => this.drawerLoading.set(false));
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
    const iso = this.memberSince().trim();
    return iso ? formatMemberSinceLong(iso) : '—';
  }

  tenureLine(): string {
    const iso = this.memberSince().trim();
    return iso ? formatTenureLabel(iso) : '—';
  }

  passwordStatusLabel(): string {
    return 'Configurada';
  }

  isThemeActive(preset: ThemePreset): boolean {
    return this.theme.activePreset() === preset;
  }

  setTheme(preset: ThemePreset): void {
    this.theme.setPreset(preset);
  }

  logout(): void {
    this.sessionEnd.emit();
  }

  startEditSection(section: ProfileEditSection): void {
    if (section === 'password') {
      this.newPassword.set('');
      this.confirmPassword.set('');
    }
    this.editingSection.set(section);
  }

  cancelSectionEdit(): void {
    this.reloadFromStore();
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
      this.savePhotoOnly('Foto de perfil actualizada.');
    };
    reader.onerror = () => {
      this.photoSaving.set(false);
      this.toast.show('No se pudo leer la imagen.', 'warning');
    };
    reader.readAsDataURL(file);
  }

  removePhotoAndSave(): void {
    this.photoDataUrl.set('');
    this.savePhotoOnly('Foto de perfil eliminada.');
  }

  saveCollaboratorSection(): void {
    this.persistProfile(
      {
        department: this.department().trim(),
        employeeId: this.employeeId().trim(),
        workLocation: this.workLocation().trim(),
      },
      'Datos de colaborador actualizados.',
    );
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

    this.persistProfile(
      { displayName, username, jobTitle, email, phone },
      'Datos personales actualizados.',
      username,
    );
  }

  savePasswordSection(): void {
    const np = this.newPassword().trim();
    const cp = this.confirmPassword().trim();
    if (!np && !cp) {
      this.toast.show('Indica la nueva contraseña.', 'warning');
      return;
    }
    if (np.length < 6) {
      this.toast.show('La contraseña debe tener al menos 6 caracteres.', 'warning');
      return;
    }
    if (np !== cp) {
      this.toast.show('Las contraseñas no coinciden.', 'warning');
      return;
    }

    const prev = this.currentProfile();
    this.persistProfile({ password: np }, 'Contraseña actualizada.');
    this.newPassword.set('');
    this.confirmPassword.set('');
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
    const u = this.session.username();
    const p = u ? this.profileStore.load(u) : defaultUserProfile('gvelasco');
    this.patchForm(p);
  }

  private currentProfile(): UserProfile {
    const u = this.username().trim().toLowerCase() || this.session.username() || 'gvelasco';
    return this.profileStore.profile() ?? defaultUserProfile(u);
  }

  private savePhotoOnly(successMessage: string): void {
    const prev = this.currentProfile();
    const next: UserProfile = {
      ...prev,
      photoDataUrl: this.photoDataUrl().trim(),
    };
    this.profileStore.save(next);
    this.patchForm(next);
    this.photoSaving.set(false);
    this.toast.show(successMessage, 'success');
    this.saved.emit(next);
  }

  private persistProfile(
    patch: Partial<UserProfile>,
    successMessage: string,
    sessionUsername?: string,
  ): void {
    this.saving.set(true);
    const prev = this.currentProfile();
    const next: UserProfile = { ...prev, ...patch };
    this.profileStore.save(next);
    this.patchForm(next);

    const userForSession = sessionUsername ?? next.username;
    const sessionUser = this.session.username();
    if (sessionUser && sessionUser !== userForSession) {
      this.session.setLocalSession(userForSession);
    }

    this.editingSection.set(null);
    this.saving.set(false);
    this.toast.show(successMessage, 'success');
    this.saved.emit(next);
  }

  private patchForm(p: UserProfile): void {
    this.displayName.set(p.displayName);
    this.username.set(p.username);
    this.jobTitle.set(p.jobTitle);
    this.email.set(p.email);
    this.phone.set(p.phone);
    this.photoDataUrl.set(p.photoDataUrl ?? '');
    this.memberSince.set(p.memberSince ?? '');
    this.department.set(p.department ?? '');
    this.employeeId.set(p.employeeId ?? '');
    this.workLocation.set(p.workLocation ?? '');
  }
}
