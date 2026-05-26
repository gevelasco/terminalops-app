import { Injectable, inject } from '@angular/core';
import { clearAllBrowserStorage } from '@core/utils/clear-client-storage';
import { ChecklistTodosStore } from '@core/services/state/checklist-todos';
import { ManiobraFormCatalogService } from '@features/maniobra/services/maniobra-form-catalog.service';
import { SessionService } from '@core/services/state/session';
import { ThemeService } from '@core/services/state/theme';
import { UserPreferencesStore } from '@core/services/state/user-preferences';
import { UserProfileStore } from '@core/services/state/user-profile';

/** Limpieza total de estado cliente al cerrar sesión o por 401. */
@Injectable({ providedIn: 'root' })
export class LogoutService {
  private readonly session = inject(SessionService);
  private readonly profiles = inject(UserProfileStore);
  private readonly preferences = inject(UserPreferencesStore);
  private readonly checklist = inject(ChecklistTodosStore);
  private readonly maniobraCatalog = inject(ManiobraFormCatalogService);
  private readonly theme = inject(ThemeService);

  clearClientState(): void {
    this.session.clearSession();
    this.profiles.clear();
    this.preferences.clear();
    this.checklist.clear();
    this.maniobraCatalog.reset();
    this.theme.resetOnLogout();
    clearAllBrowserStorage();
  }
}
