import {
  ChangeDetectionStrategy,
  Component,
  computed,
  viewChild,
} from '@angular/core';
import { ProfileDrawerConfigTabComponent } from '@core/components/profile-drawer/profile-drawer-config-tab.component';
@Component({
  selector: 'app-settings-controls-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'settings-controls-tab-host',
  },
  imports: [ProfileDrawerConfigTabComponent],
  templateUrl: './settings-controls-tab.component.html',
  styleUrl: './settings-controls-tab.component.scss',
})
export class SettingsControlsTabComponent {
  private readonly configTabRef = viewChild(ProfileDrawerConfigTabComponent);

  readonly saving = computed(() => this.configTabRef()?.saving() ?? false);

  saveCompanyConfiguration(): void {
    this.configTabRef()?.saveCompanyConfiguration();
  }
}