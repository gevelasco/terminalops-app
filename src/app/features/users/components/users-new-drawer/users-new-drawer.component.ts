import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CompanyUsersApiService } from '@core/services/api/company-users';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import { initialsFromDisplayName } from '@core/services/state/user-profile';
import {
  STAFF_MODULE_OPTIONS,
} from '@shared/models/app-modules.models';
import { staffModuleIcon } from '@shared/utils/staff-module-present';
import {
  emptyStaffModulePermissionDraftMap,
  staffModuleGrantsFromDraft,
  type StaffModulePermissionDraftMap,
} from '@shared/utils/staff-module-permissions';
import { UsersModulePermissionsFieldsComponent } from '@features/users/components/users-module-permissions-fields/users-module-permissions-fields.component';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToSegmentControlComponent,
  type ToSegmentTab,
} from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSideDrawerComponent } from '@shared/ui/to-side-drawer/to-side-drawer.component';
import type { CompanyUserRow } from '@core/services/api/company-users';

@Component({
  selector: 'app-users-new-drawer',
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
  templateUrl: './users-new-drawer.component.html',
  styleUrls: [
    '../../../fleet/components/fleet-drawer.shared.scss',
    '../../../fleet/components/styles/fleet-drawer-unit-sec.shared.scss',
    '../../../../core/components/profile-drawer/profile-drawer.component.scss',
    '../users-module-access.shared.scss',
    './users-new-drawer.component.scss',
  ],
})
export class UsersNewDrawerComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(SessionService);
  private readonly api = inject(CompanyUsersApiService);
  private readonly toast = inject(ToastService);

  readonly dismiss = output<void>();
  readonly saved = output<CompanyUserRow>();

  readonly drawerLoading = signal(true);
  readonly saving = signal(false);
  readonly moduleOptions = [...STAFF_MODULE_OPTIONS];
  readonly staffModuleIcon = staffModuleIcon;

  readonly draftUsername = model('');
  readonly draftPassword = model('');
  readonly draftDisplayName = model('');
  readonly draftJobTitle = model('');
  readonly draftEmail = model('');
  readonly draftPhone = model('');
  readonly draftRole = model<'admin' | 'staff'>('staff');
  readonly draftPermissions = signal<StaffModulePermissionDraftMap>(
    emptyStaffModulePermissionDraftMap(),
  );
  readonly photoDataUrl = signal('');

  readonly isOwner = computed(() => this.session.role() === 'superadmin');

  readonly roleTabs = computed((): readonly ToSegmentTab<'admin' | 'staff'>[] => {
    const tabs: ToSegmentTab<'admin' | 'staff'>[] = [
      { id: 'staff', label: 'Staff', icon: 'person' },
    ];
    if (this.isOwner()) {
      tabs.push({ id: 'admin', label: 'Administrador', icon: 'groups' });
    }
    return tabs;
  });

  readonly avatarPreview = computed(() =>
    initialsFromDisplayName(
      this.draftDisplayName().trim() || this.draftUsername().trim() || 'U',
    ),
  );

  readonly hasPhoto = computed(() => this.photoDataUrl().trim().length > 0);

  constructor() {
    afterNextRender(() => this.drawerLoading.set(false));
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
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      this.photoDataUrl.set(url);
    };
    reader.onerror = () => {
      this.toast.show('No se pudo leer la imagen.', 'warning');
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.photoDataUrl.set('');
  }

  onRoleTab(value: 'admin' | 'staff'): void {
    this.draftRole.set(value);
  }

  submit(): void {
    const companyId = this.session.companyId();
    if (!companyId) {
      return;
    }
    const username = this.draftUsername().trim();
    const password = this.draftPassword().trim();
    const displayName = this.draftDisplayName().trim();
    const email = this.draftEmail().trim();
    if (!username || password.length < 8) {
      this.toast.show('Indica usuario y contraseña (mín. 8 caracteres).', 'warning');
      return;
    }
    if (!email || !email.includes('@')) {
      this.toast.show('Indica un correo electrónico válido.', 'warning');
      return;
    }
    if (!displayName) {
      this.toast.show('Indica el nombre del usuario.', 'warning');
      return;
    }
    this.saving.set(true);
    this.api
      .createUser(companyId, {
        username,
        password,
        displayName,
        email,
        phone: this.draftPhone().trim() || undefined,
        jobTitle: this.draftJobTitle().trim() || undefined,
        photoDataUrl: this.photoDataUrl().trim() || undefined,
        role: this.draftRole(),
        moduleGrants:
          this.draftRole() === 'staff'
            ? staffModuleGrantsFromDraft(this.draftPermissions())
            : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.saved.emit(created);
          this.dismiss.emit();
          this.toast.show('Usuario creado.', 'success');
        },
        error: (err) => {
          this.saving.set(false);
          const msg =
            typeof err?.error?.message === 'string'
              ? err.error.message
              : 'No se pudo crear el usuario.';
          this.toast.show(msg, 'error');
        },
      });
  }
}
