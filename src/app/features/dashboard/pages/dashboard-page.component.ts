import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  model,
  resource,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { finalize, map } from 'rxjs/operators';
import { ClientsService } from '@services/api/clients';
import { DashboardService } from '@services/api/dashboard';
import { CompaniesService } from '@services/api/companies';
import { ExpensesService } from '@services/api/expenses';
import { ReportsService } from '@services/api/reports';
import { TripsService } from '@services/api/trips';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import { dashboardChartPrimary } from '@features/dashboard/utils/dashboard-chart-colors';
import { buildDashboardCompletedToday } from '@features/dashboard/utils/dashboard-completed-today.util';
import { buildDashboardOperationalFlowOption } from '@features/dashboard/utils/dashboard-operational-flow-option';
import { buildDashboardTopDestinationsOption } from '@features/dashboard/utils/dashboard-top-destinations-option';
import { buildDashboardTripActivityOption } from '@features/dashboard/utils/dashboard-trip-activity-option';
import { buildReportsGeneralOperationMixPieOption } from '@features/reports/utils/charts/general/reports-general-operation-mix-pie-option';
import {
  buildDashboardClientTransactions,
  dashboardClientTransactionsRange,
  type DashboardClientTransactionRow,
} from '@features/dashboard/utils/dashboard-client-transactions.util';
import {
  buildDashboardUpcomingDepartures,
  type DashboardUpcomingDepartureRow,
} from '@features/dashboard/utils/dashboard-upcoming-departures.util';
import {
  buildDashboardUpcomingPayments,
  dashboardUpcomingPaymentsRange,
  operationalTodayYmd,
  type DashboardUpcomingPaymentRow,
} from '@features/dashboard/utils/dashboard-upcoming-payments.util';
import { buildDashboardWeekResult } from '@features/dashboard/utils/dashboard-week-result.util';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import type { TripStatus } from '@shared/models/logistics.models';
import { CurrencyMxPipe } from '@shared/pipes/currency-mx.pipe';
import { canAccessModule } from '@shared/utils/access-control';
import { injectIsMobileViewport } from '@shared/utils/viewport';
import {
  maneuverStatusPillClass,
  maneuverStatusPillLabel,
} from '@shared/utils/maneuver-status-pill';
import { ToEchartsHostComponent } from '@shared/ui/to-echarts-host/to-echarts-host.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToKpiCardComponent } from '@shared/ui/to-kpi-card/to-kpi-card.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToModuleSkeletonComponent } from '@shared/ui/to-module-skeleton/to-module-skeleton.component';

function pluralEs(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function formatDeltaPercent(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  const signed = value > 0 ? `+${value}` : String(value);
  return `${signed}%`;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CurrencyMxPipe],
  imports: [
    ToPageHeaderComponent,
    ToKpiCardComponent,
    ToEchartsHostComponent,
    ToModuleSkeletonComponent,
    ToIconComponent,
    ToInputComponent,
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dashboardApi = inject(DashboardService);
  private readonly clientsApi = inject(ClientsService);
  private readonly companiesApi = inject(CompaniesService);
  private readonly expensesApi = inject(ExpensesService);
  private readonly reportsApi = inject(ReportsService);
  private readonly tripsApi = inject(TripsService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly currencyMx = inject(CurrencyMxPipe);
  private readonly toast = inject(ToastService);

  /**
   * En mobile: KPIs, próximos pagos/salidas y transacciones (sin gráficas).
   * Insights se pide siempre por los KPIs.
   */
  readonly isMobileViewport = injectIsMobileViewport();

  readonly canReadDashboard = computed(() =>
    this.session.canReadModule(APP_MODULE_CODES.DASHBOARD),
  );

  readonly showFinancialInsights = computed(() => {
    if (!this.canReadDashboard()) {
      return false;
    }
    return canAccessModule(this.session.allowedModules(), APP_MODULE_CODES.EXPENSES);
  });

  /** Cobros de clientes (cartera), distinto de gastos en «Próximos pagos». */
  readonly canReadClientCollections = computed(
    () => this.canReadDashboard() && this.session.canReadModule(APP_MODULE_CODES.CLIENTS),
  );

  readonly canReadReportsForCollections = computed(() =>
    this.session.canReadModule(APP_MODULE_CODES.REPORTS),
  );

  private readonly pageResource = resource({
    // Incluir companyId: al logout el request queda undefined y no re-fetcha
    // (evita throw síncrono "No hay empresa en sesión" que rompía cerrar sesión).
    request: () => {
      const companyId = this.session.companyId();
      if (!companyId || !this.canReadDashboard()) {
        return undefined;
      }
      return {
        companyId,
        financial: this.showFinancialInsights(),
        clientCollections: this.canReadClientCollections(),
      };
    },
    loader: async ({ request }) => {
      if (!request) {
        return null;
      }
      return firstValueFrom(
        forkJoin({
          summary: this.dashboardApi.getSummary().pipe(catchError(() => of(null))),
          insights: this.dashboardApi.getInsights().pipe(catchError(() => of(null))),
          upcomingPayments: request.financial
            ? this.loadUpcomingPayments()
            : of([] as DashboardUpcomingPaymentRow[]),
          upcomingDepartures: request.financial
            ? of([] as DashboardUpcomingDepartureRow[])
            : this.loadUpcomingDepartures(),
          clientTransactions: request.clientCollections
            ? this.loadClientTransactions()
            : of([] as DashboardClientTransactionRow[]),
        }).pipe(
          catchError(() =>
            of({
              summary: null,
              insights: null,
              upcomingPayments: [] as DashboardUpcomingPaymentRow[],
              upcomingDepartures: [] as DashboardUpcomingDepartureRow[],
              clientTransactions: [] as DashboardClientTransactionRow[],
            }),
          ),
        ),
      );
    },
  });

  readonly dieselEditOpen = signal(false);
  readonly dieselDraft = model('');
  readonly dieselSaving = signal(false);

  readonly loading = computed(
    () => !this.pageResource.hasValue() && this.pageResource.isLoading(),
  );

  readonly summary = computed(() => this.pageResource.value()?.summary);
  readonly insights = computed(() => this.pageResource.value()?.insights);
  readonly upcomingPayments = computed(
    () => this.pageResource.value()?.upcomingPayments ?? [],
  );
  readonly upcomingDepartures = computed(
    () => this.pageResource.value()?.upcomingDepartures ?? [],
  );
  readonly clientTransactions = computed(
    () => this.pageResource.value()?.clientTransactions ?? [],
  );
  readonly clientTransactionsSubtitle = computed(
    () => 'Últimos 30 días · ingresos confirmados y cartera por cobrar',
  );
  readonly showUpcomingPayments = computed(
    () => this.showFinancialInsights() && this.upcomingPayments().length > 0,
  );
  readonly showUpcomingDepartures = computed(() => !this.showFinancialInsights());
  readonly showAsideList = computed(
    () => this.showUpcomingPayments() || this.showUpcomingDepartures(),
  );
  readonly upcomingPaymentsSubtitle = computed(() => {
    const { to } = dashboardUpcomingPaymentsRange();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);
    if (!match) {
      return 'Vencidos y hasta fin de mes';
    }
    const end = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
    );
    const monthLabel = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(end);
    const month =
      monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    return `Vencidos y hasta el ${end.getDate()} de ${month}`;
  });

  /** Re-lee el azul del sidemenu (`--palette-primary`) al cambiar tema o datos. */
  readonly chartShellColor = computed(() => {
    this.session.theme();
    return dashboardChartPrimary();
  });

  readonly canEditDiesel = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.DASHBOARD),
  );

  readonly dieselSnapshot = computed(() => this.summary()?.diesel ?? null);

  readonly operationalFlowOption = computed(() => {
    const flow = this.insights()?.operationalFlow ?? [];
    return buildDashboardOperationalFlowOption(flow, {
      showExpenses: this.showFinancialInsights(),
      primaryColor: this.chartShellColor(),
    });
  });

  readonly tripActivityOption = computed(() =>
    buildDashboardTripActivityOption(this.insights()?.tripActivity ?? [], {
      primaryColor: this.chartShellColor(),
    }),
  );

  readonly topDestinationsOption = computed(() =>
    buildDashboardTopDestinationsOption(this.insights()?.topDestinations ?? [], {
      primaryColor: this.chartShellColor(),
    }),
  );

  readonly operationMixOption = computed(() => {
    const insights = this.insights();
    return buildReportsGeneralOperationMixPieOption(
      insights?.operationMix ?? [],
      0,
      { primaryColor: this.chartShellColor() },
    );
  });

  readonly recentTrips = computed(() => this.insights()?.recentTrips ?? []);

  readonly inTransitValue = computed(() => String(this.summary()?.tripsInTransit ?? 0));

  readonly inTransitValueUnit = computed(() => {
    const n = this.summary()?.tripsInTransit ?? 0;
    return pluralEs(n, 'maniobra', 'maniobras');
  });

  readonly inTransitLegend = computed(() => {
    const n = this.summary()?.tripsInTransitDestinations ?? 0;
    return `${n} ${pluralEs(n, 'destino', 'destinos')}`;
  });

  readonly unitsAvailableValue = computed(() => String(this.summary()?.unitsAvailable ?? 0));

  readonly unitsAvailableValueUnit = computed(() => {
    const n = this.summary()?.unitsAvailable ?? 0;
    return pluralEs(n, 'unidad', 'unidades');
  });

  readonly unitsLegend = computed(() => {
    const n = this.summary()?.equipmentAvailable ?? 0;
    return `${n} equipo disponible`;
  });

  readonly scheduledValue = computed(() => String(this.summary()?.tripsScheduled ?? 0));

  readonly scheduledValueUnit = computed(() => {
    const n = this.summary()?.tripsScheduled ?? 0;
    return pluralEs(n, 'maniobra', 'maniobras');
  });

  readonly scheduledWeekDelta = computed(() => {
    const pct = formatDeltaPercent(
      this.summary()?.tripsScheduledWeekOverWeekPercent,
    );
    return `${pct} vs la semana anterior`;
  });

  readonly scheduledLegend = computed(() => {
    const at = this.summary()?.nextScheduledDepartureAt;
    if (!at) {
      return 'Próxima salida: sin programar';
    }
    const formatted = new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(at));
    return `Próxima salida: ${formatted}`;
  });

  private readonly weekResult = computed(() =>
    buildDashboardWeekResult(this.insights()?.operationalFlow ?? []),
  );

  readonly weekResultValue = computed(() =>
    this.currencyMx.transform(this.weekResult().currentMargin),
  );

  readonly weekResultLegend = computed(() => {
    const pct = formatDeltaPercent(this.weekResult().weekOverWeekPercent);
    return `${pct} vs la semana anterior`;
  });

  readonly weekResultMeta = computed(() => {
    const r = this.weekResult();
    const ing = this.currencyMx.transform(r.currentRevenue);
    const gas = this.currencyMx.transform(r.currentExpenses);
    return `Ingresos ${ing} − gastos ${gas}`;
  });

  readonly weekResultTone = computed((): 'up' | 'down' | 'neutral' => {
    const m = this.weekResult().currentMargin;
    if (m > 0) {
      return 'up';
    }
    if (m < 0) {
      return 'down';
    }
    return 'neutral';
  });

  private readonly completedToday = computed(() => {
    const today =
      this.summary()?.operationalDate?.trim() || operationalTodayYmd();
    return buildDashboardCompletedToday(
      this.insights()?.tripActivity ?? [],
      today,
    );
  });

  readonly completedTodayValue = computed(() =>
    String(this.completedToday().today),
  );

  readonly completedTodayValueUnit = computed(() => {
    const n = this.completedToday().today;
    return pluralEs(n, 'maniobra', 'maniobras');
  });

  readonly completedTodayLegend = computed(() => {
    const pct = formatDeltaPercent(this.completedToday().vsYesterdayPercent);
    return `${pct} vs ayer`;
  });

  readonly completedTodayMeta = computed(() => {
    const n = this.completedToday().weekTotal;
    return `${n} ${pluralEs(n, 'maniobra', 'maniobras')} en 7 días`;
  });

  readonly dieselChip = computed(() => {
    const diesel = this.dieselSnapshot();
    if (!diesel?.enabled || diesel.pricePerLiter == null) {
      return null;
    }
    return `${this.formatDieselMoney(diesel.pricePerLiter)}/L`;
  });

  openDieselEdit(): void {
    const current = this.dieselSnapshot()?.pricePerLiter;
    this.dieselDraft.set(
      current != null && Number.isFinite(current) ? String(current) : '',
    );
    this.dieselEditOpen.set(true);
  }

  cancelDieselEdit(): void {
    this.dieselEditOpen.set(false);
    this.dieselDraft.set('');
  }

  saveDieselPrice(): void {
    if (this.dieselSaving()) {
      return;
    }
    const companyId = this.session.companyId();
    if (!companyId) {
      this.toast.show('No se pudo identificar la empresa.', 'error');
      return;
    }
    const raw = this.dieselDraft().trim().replace(/,/g, '');
    const price = Number.parseFloat(raw);
    if (!Number.isFinite(price) || price < 5 || price > 200) {
      this.toast.show('Indica un precio válido entre 5 y 200 MXN/L.', 'warning');
      return;
    }

    this.dieselSaving.set(true);
    this.companiesApi
      .updateDieselReferencePrice(companyId, price)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.dieselSaving.set(false)),
      )
      .subscribe({
        next: () => {
          this.toast.show('Precio de diésel actualizado.', 'success');
          this.dieselEditOpen.set(false);
          this.pageResource.reload();
        },
        error: () => {
          this.toast.show('No se pudo guardar el precio de diésel.', 'error');
        },
      });
  }

  private formatDieselMoney(value: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  tripStatusClass(status: string, falseManeuver: boolean): string {
    return maneuverStatusPillClass(status as TripStatus, { falseManeuver });
  }

  tripStatusLabel(status: string, falseManeuver: boolean): string {
    return maneuverStatusPillLabel(status as TripStatus, { falseManeuver });
  }

  tripChargeLabel(charge: string | null): string {
    if (charge == null || !charge.trim()) {
      return '—';
    }
    const n = Number(String(charge).replace(/,/g, ''));
    if (!Number.isFinite(n)) {
      return charge;
    }
    return this.currencyMx.transform(n);
  }

  upcomingPaymentAmountLabel(row: DashboardUpcomingPaymentRow): string {
    return this.currencyMx.transform(row.amount, row.currency);
  }

  clientTransactionAmountLabel(row: DashboardClientTransactionRow): string {
    return this.currencyMx.transform(row.amount);
  }

  private loadUpcomingPayments() {
    const range = dashboardUpcomingPaymentsRange();
    return this.expensesApi
      .getAllExpensesCalendarItems({
        from: range.fetchFrom,
        to: range.to,
      })
      .pipe(
        map((items) => buildDashboardUpcomingPayments(items, range)),
        catchError(() => of([] as DashboardUpcomingPaymentRow[])),
      );
  }

  private loadUpcomingDepartures() {
    return this.tripsApi.getTripsPage({ status: 'scheduled', limit: 50 }).pipe(
      map((res) => buildDashboardUpcomingDepartures(res.items)),
      catchError(() => of([] as DashboardUpcomingDepartureRow[])),
    );
  }

  private loadClientTransactions() {
    const range = dashboardClientTransactionsRange();
    const fromParts = range.from.split('-').map(Number);
    const toParts = range.to.split('-').map(Number);
    const filter = {
      fromMonth: fromParts[1] ?? 1,
      fromYear: fromParts[0] ?? 2026,
      toMonth: toParts[1] ?? 1,
      toYear: toParts[0] ?? 2026,
      from: range.from,
      to: range.to,
      clientIds: [] as string[],
      clientPaymentMethods: [] as [],
    };
    const balance$ = this.canReadReportsForCollections()
      ? this.reportsApi.getBalance(filter).pipe(catchError(() => of(null)))
      : of(null);

    return forkJoin({
      overview: this.clientsApi
        .getClientsBalanceOverview()
        .pipe(catchError(() => of({ asOf: '', items: [] }))),
      balance: balance$,
    }).pipe(
      map(({ overview, balance }) =>
        buildDashboardClientTransactions(
          overview.items ?? [],
          balance?.insights.dailyActivity ?? [],
          range,
        ),
      ),
    );
  }

  openTrip(tripId: string | number): void {
    if (tripId == null || tripId === '') {
      return;
    }
    void this.router.navigate(['/trips'], {
      queryParams: { tripId: String(tripId) },
    });
  }
}
