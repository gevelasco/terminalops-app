import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { SessionService } from '@core/services/state/session';
import { ReportsFilterBarComponent } from '@features/reports/components/reports-filter-bar/reports-filter-bar.component';
import { ReportsBalanceTabComponent } from '@features/reports/components/reports-balance-tab/reports-balance-tab.component';
import { ReportsGeneralTabComponent } from '@features/reports/components/reports-general-tab/reports-general-tab.component';
import { ReportsManiobrasTabComponent } from '@features/reports/components/reports-maniobras-tab/reports-maniobras-tab.component';
import { ReportsFleetTabComponent } from '@features/reports/components/reports-fleet-tab/reports-fleet-tab.component';
import type { ReportsTabId } from '@features/reports/models/reports-view.models';
import {
  REPORTS_FINANCIAL_TAB_IDS,
  REPORTS_TAB_DEFINITIONS,
  type ReportsToolbarTab,
} from '@features/reports/reports.constants';
import { defaultReportsFilter } from '@features/reports/utils/reports-filter';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { canAccessModule, isAdminRole } from '@shared/utils/access-control';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToPageHeaderComponent,
    ReportsFilterBarComponent,
    ReportsGeneralTabComponent,
    ReportsBalanceTabComponent,
    ReportsManiobrasTabComponent,
    ReportsFleetTabComponent,
  ],
  host: {
    class: 'reports-page-host',
    '[class.reports-page-host--general]': 'tab() === "general"',
    '[class.reports-page-host--scroll]': 'tab() === "balance" || tab() === "maniobras" || tab() === "fleet"',
  },
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.scss',
})
export class ReportsPageComponent {
  private readonly session = inject(SessionService);

  readonly filter = signal(defaultReportsFilter());
  readonly tab = signal<ReportsTabId>('general');

  /** Exportaciones (PDF/Excel) requerirán este permiso cuando estén disponibles. */
  readonly canWriteReports = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.REPORTS),
  );

  readonly showFinancialTabs = computed(() => {
    const role = this.session.role();
    if (isAdminRole(role)) {
      return true;
    }
    return canAccessModule(this.session.allowedModules(), APP_MODULE_CODES.EXPENSES);
  });

  readonly tabs = computed((): ReportsToolbarTab[] => {
    if (this.showFinancialTabs()) {
      return [...REPORTS_TAB_DEFINITIONS];
    }
    return REPORTS_TAB_DEFINITIONS.filter((t) => !REPORTS_FINANCIAL_TAB_IDS.has(t.id));
  });

  constructor() {
    effect(() => {
      const allowed = new Set(this.tabs().map((t) => t.id));
      if (!allowed.has(this.tab())) {
        this.tab.set('maniobras');
      }
    });
  }
}
