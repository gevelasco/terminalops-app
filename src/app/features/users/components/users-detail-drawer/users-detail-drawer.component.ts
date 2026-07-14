import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CompanyUsersApiService,
  type CompanyUserRow,
} from '@core/services/api/company-users';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import { initialsFromDisplayName } from '@core/services/state/user-profile';
import { isNumericPublicId } from '@core/utils/api-date';
import {
  formatMemberSinceLong,
  formatTenureLabel,
} from '@core/utils/user-profile-tenure';
import {
  STAFF_MODULE_OPTIONS,
} from '@shared/models/app-modules.models';
import { roleDisplayLabel } from '@shared/utils/access-control';
import { staffModuleIcon } from '@shared/utils/staff-module-present';
import {
  emptyStaffModulePermissionDraftMap,
  staffModuleGrantsFromDraft,
  staffModulePermissionDraftFromGrants,
  staffModulePermissionSummary,
  type StaffModulePermissionDraftMap,
} from '@shared/utils/staff-module-permissions';
import { UsersModulePermissionsFieldsComponent } from '@features/users/components/users-module-permissions-fields/users-module-permissions-fields.component';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSegmentControlComponent,
  type ToSegmentTab,
} from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';

type UserEditSection = 'personal' | 'password' | 'permissions';

@Component({
  selector: 'app-users-detail-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToSideDrawerComponent,
    ToButtonComponent,
    ToIconComponent,
    ToInputComponent,
    ToSegmentControlComponent,
    UsersModulePermissionsFieldsComponent,
  ],
  templateUrl: './users-detail-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    '../../../fleet/components/fleet-unit-detail-drawer/fleet-unit-detail-drawer-panel.scss',
    '../../../../core/components/profile-drawer/profile-drawer.component.scss',
    '../users-module-access.shared.scss',
    './users-detail-drawer.component.scss',
  ],
})
export class UsersDetailDrawerComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(SessionService);
  private readonly api = inject(CompanyUsersApiService);
  private readonly toast = inject(ToastService);

  readonly user = input.required<CompanyUserRow>();
  readonly dismiss = output<void>();
  readonly saved = output<CompanyUserRow>();

  readonly drawerLoading = signal(true);
  readonly saving = signal(false);
  readonly photoSaving = signal(false);
  readonly editingSection = signal<UserEditSection | null>(null);
  readonly moduleOptions = [...STAFF_MODULE_OPTIONS];
  readonly staffModuleIcon = staffModuleIcon;

  readonly draftRole = signal<'admin' | 'staff'>('staff');
  readonly draftActive = signal(true);
  readonly draftPermissions = signal<StaffModulePermissionDraftMap>(
    emptyStaffModulePermissionDraftMap(),
  );
  readonly photoDataUrl = signal('');

  readonly displayName = model('');
  readonly username = model('');
  readonly jobTitle = model('');
  readonly email = model('');
  readonly phone = model('');
  readonly newPassword = model('');
  readonly confirmPassword = model('');

  readonly isOwner = () => this.session.role() === 'superadmin';
  readonly isSelf = () => String(this.user().id) === this.session.userId();
  readonly canEditPersonal = () => this.user().role !== 'superadmin';
  readonly canEditAccess = () => this.user().role !== 'superadmin';
  readonly canResetPassword = () => this.canEditPersonal() && !this.isSelf();

  readonly viewModulePermissions = computed(() => {
    const row = this.user();
    return staffModulePermissionSummary(
      row.moduleGrants,
      row.moduleCodes,
      row.role,
    );
  });

  readonly roleTabs = computed((): readonly ToSegmentTab<'admin' | 'staff'>[] => {
    const tabs: ToSegmentTab<'admin' | 'staff'>[] = [
      { id: 'staff', label: 'Staff', icon: 'person' },
    ];
    if (this.isOwner()) {
      tabs.push({ id: 'admin', label: 'Administrador', icon: 'groups' });
    }
    return tabs;
  });

  constructor() {
    afterNextRender(() => this.drawerLoading.set(false));
    effect(() => {
      const row = this.user();
      this.draftRole.set(row.role === 'admin' ? 'admin' : 'staff');
      this.draftActive.set(row.status === 'active');
      this.draftPermissions.set(
        staffModulePermissionDraftFromGrants(row.moduleGrants, row.moduleCodes),
      );
      this.photoDataUrl.set(row.photoDataUrl?.trim() ?? '');
      const editing = this.editingSection();
      if (!editing) {
        this.patchPersonalForm(row);
        this.patchAccessDraft(row);
      } else if (editing === 'personal') {
        this.patchAccessDraft(row);
      } else if (editing === 'permissions') {
        this.patchPersonalForm(row);
      }
    });
  }

  roleLabel(): string {
    return roleDisplayLabel(this.user().role);
  }

  displayOrDash(value: string | undefined): string {
    return value?.trim() || '—';
  }

  memberSinceLine(): string {
    const iso = this.user().memberSince?.trim() ?? '';
    return iso ? formatMemberSinceLong(iso) : '—';
  }

  tenureLine(): string {
    const iso = this.user().memberSince?.trim() ?? '';
    return iso ? formatTenureLabel(iso) : '—';
  }

  departmentLine(): string {
    return this.displayOrDash(this.user().department);
  }

  workLocationLine(): string {
    return this.displayOrDash(this.user().workLocation);
  }

  employeeIdLine(): string {
    const id = this.user().employeeId?.trim() ?? String(this.user().id);
    return isNumericPublicId(id) ? id : '—';
  }

  avatarPreview(): string {
    return initialsFromDisplayName(
      this.user().displayName || this.user().username,
    );
  }

  hasPhoto(): boolean {
    return this.photoDataUrl().trim().length > 0;
  }

  isEditing(section: UserEditSection): boolean {
    return this.editingSection() === section;
  }

  startEditSection(section: UserEditSection): void {
    if (section === 'password') {
      this.newPassword.set('');
      this.confirmPassword.set('');
    }
    if (section === 'personal') {
      this.patchPersonalForm(this.user());
    }
    if (section === 'permissions') {
      this.patchAccessDraft(this.user());
    }
    this.editingSection.set(section);
  }

  cancelSectionEdit(): void {
    const section = this.editingSection();
    if (section === 'personal') {
      this.patchPersonalForm(this.user());
    }
    if (section === 'permissions') {
      this.patchAccessDraft(this.user());
    }
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.editingSection.set(null);
  }

  onPhotoSelected(ev: Event): void {
    if (!this.canEditPersonal()) {
      return;
    }
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
    const companyId = this.session.companyId();
    if (!companyId) {
      return;
    }
    const displayName = this.displayName().trim();
    const username = this.username().trim().toLowerCase();
    const jobTitle = this.jobTitle().trim();
    const email = this.email().trim();
    const phone = this.phone().trim();

    if (!displayName) {
      this.toast.show('Indica el nombre.', 'warning');
      return;
    }
    if (!username) {
      this.toast.show('Indica el usuario.', 'warning');
      return;
    }
    if (!email || !email.includes('@')) {
      this.toast.show('Indica un correo electrónico válido.', 'warning');
      return;
    }

    this.saving.set(true);
    this.api
      .updateUser(companyId, this.user().id, {
        displayName,
        username,
        jobTitle,
        email,
        phone,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.editingSection.set(null);
          this.saved.emit(updated);
          this.toast.show('Datos personales actualizados.', 'success');
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
    const companyId = this.session.companyId();
    if (!companyId) {
      return;
    }
    const next = this.newPassword().trim();
    const confirm = this.confirmPassword().trim();

    if (next.length < 8) {
      this.toast.show('La contraseña debe tener al menos 8 caracteres.', 'warning');
      return;
    }
    if (next !== confirm) {
      this.toast.show('Las contraseñas no coinciden.', 'warning');
      return;
    }

    this.saving.set(true);
    this.api
      .updateUser(companyId, this.user().id, { newPassword: next })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.newPassword.set('');
          this.confirmPassword.set('');
          this.editingSection.set(null);
          this.saved.emit(updated);
          this.toast.show('Contraseña restablecida.', 'success');
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudo restablecer la contraseña.', 'error');
        },
      });
  }

  toggleActive(): void {
    if (this.isSelf()) {
      return;
    }
    this.draftActive.update((active) => !active);
  }

  onRoleTab(value: 'admin' | 'staff'): void {
    this.draftRole.set(value);
  }

  savePermissionsSection(): void {
    const companyId = this.session.companyId();
    if (!companyId) {
      return;
    }
    const row = this.user();
    this.saving.set(true);
    this.api
      .updateUser(companyId, row.id, {
        role: this.draftRole(),
        status: this.draftActive() ? 'active' : 'disabled',
        moduleGrants:
          this.draftRole() === 'staff'
            ? staffModuleGrantsFromDraft(this.draftPermissions())
            : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.editingSection.set(null);
          this.saved.emit(updated);
          this.toast.show('Permisos actualizados.', 'success');
        },
        error: () => {
          this.saving.set(false);
          this.toast.show('No se pudieron actualizar los permisos.', 'error');
        },
      });
  }

  private patchAccessDraft(row: CompanyUserRow): void {
    this.draftRole.set(row.role === 'admin' ? 'admin' : 'staff');
    this.draftActive.set(row.status === 'active');
    this.draftPermissions.set(
      staffModulePermissionDraftFromGrants(row.moduleGrants, row.moduleCodes),
    );
  }

  private patchPersonalForm(row: CompanyUserRow): void {
    this.displayName.set(row.displayName);
    this.username.set(row.username);
    this.jobTitle.set(row.jobTitle ?? '');
    this.email.set(row.email ?? '');
    this.phone.set(row.phone ?? '');
  }

  private savePhotoOnly(photoDataUrl: string): void {
    const companyId = this.session.companyId();
    if (!companyId) {
      this.photoSaving.set(false);
      return;
    }
    this.api
      .updateUser(companyId, this.user().id, { photoDataUrl })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.photoSaving.set(false);
          this.saved.emit(updated);
          this.toast.show(
            photoDataUrl ? 'Foto actualizada.' : 'Foto eliminada.',
            'success',
          );
        },
        error: () => {
          this.photoSaving.set(false);
          this.photoDataUrl.set(this.user().photoDataUrl?.trim() ?? '');
          this.toast.show('No se pudo guardar la foto.', 'error');
        },
      });
  }
}
