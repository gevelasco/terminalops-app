import { Injectable, inject } from '@angular/core';
import { ClientsService } from '@services/api/clients';
import { clearAllBrowserStorage } from '@core/utils/clear-client-storage';
import { ChecklistTodosStore } from '@core/services/state/checklist-todos';
import { OperationalFleetSyncService } from '@core/services/state/operational-fleet-sync.service';
import { SessionService } from '@core/services/state/session';
import { ThemeService } from '@core/services/state/theme';
import { UserPreferencesStore } from '@core/services/state/user-preferences';
import { UserProfileStore } from '@core/services/state/user-profile';
import { PlanEntitlementService } from '@shared/billing/plan-entitlement.service';
import {
  NotificationsUnreadStore,
  restoreNotifLastSeen,
  snapshotNotifLastSeen,
} from '@core/services/state/notifications-unread.store';

/** Limpieza total de estado cliente al cerrar sesión o por 401. */
@Injectable({ providedIn: 'root' })
export class LogoutService {
  private readonly session = inject(SessionService);
  private readonly profiles = inject(UserProfileStore);
  private readonly preferences = inject(UserPreferencesStore);
  private readonly checklist = inject(ChecklistTodosStore);
  private readonly theme = inject(ThemeService);
  private readonly operationalTrips = inject(OperationalFleetSyncService);
  private readonly clientsApi = inject(ClientsService);
  private readonly planEntitlements = inject(PlanEntitlementService);
  private readonly notificationsUnread = inject(NotificationsUnreadStore);

  clearClientState(): void {
    const notifLastSeen = snapshotNotifLastSeen();
    // Cortar polls/fetch antes de anular la sesión (evita race con companyId null).
    this.notificationsUnread.stop();
    this.operationalTrips.clearOnLogout();
    this.clientsApi.invalidateClientPickerCache();
    this.planEntitlements.reset();

    this.session.clearSession();
    this.profiles.clear();
    this.preferences.clear();
    this.checklist.clear();
    this.theme.resetOnLogout();

    try {
      clearAllBrowserStorage();
      restoreNotifLastSeen(notifLastSeen);
    } catch {
      /* ignore storage failures in private mode */
    }
  }
}
