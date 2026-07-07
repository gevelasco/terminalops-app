import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CompanyUsersApiService } from '@core/services/api/company-users';
import { SessionService } from '@core/services/state/session';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';

@Component({
  selector: 'app-cuenta-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToPageHeaderComponent, ToSkeletonComponent],
  templateUrl: './cuenta-page.component.html',
  styleUrl: './cuenta-page.component.scss',
})
export class CuentaPageComponent {
  private readonly session = inject(SessionService);
  private readonly api = inject(CompanyUsersApiService);

  readonly account = resource({
    loader: async () => {
      const companyId = this.session.companyId();
      if (!companyId) {
        return null;
      }
      return firstValueFrom(this.api.getAccount(companyId));
    },
  });

  readonly accountData = computed(() => this.account.value());
}
