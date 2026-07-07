import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';
import {
  STAFF_RBAC_MODULE_OPTIONS,
  type StaffGrantableModuleCode,
} from '@shared/models/app-modules.models';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { staffModuleIcon } from '@shared/utils/staff-module-present';
import type { StaffModulePermissionDraftMap } from '@shared/utils/staff-module-permissions';

@Component({
  selector: 'app-usuarios-module-permissions-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToIconComponent],
  templateUrl: './usuarios-module-permissions-fields.component.html',
  styleUrl: './usuarios-module-permissions-fields.component.scss',
})
export class UsuariosModulePermissionsFieldsComponent {
  readonly permissions = model.required<StaffModulePermissionDraftMap>();
  readonly disabled = input(false);

  readonly rbacModuleOptions = STAFF_RBAC_MODULE_OPTIONS;
  readonly staffModuleIcon = staffModuleIcon;

  permissionState(code: StaffGrantableModuleCode) {
    return this.permissions()[code];
  }

  toggleRead(code: StaffGrantableModuleCode): void {
    const current = this.permissions();
    const state = { ...current[code] };
    state.read = !state.read;
    if (!state.read) {
      state.write = false;
    }
    this.permissions.set({ ...current, [code]: state });
  }

  toggleWrite(code: StaffGrantableModuleCode): void {
    const current = this.permissions();
    const state = { ...current[code] };
    state.write = !state.write;
    if (state.write) {
      state.read = true;
    }
    this.permissions.set({ ...current, [code]: state });
  }
}
