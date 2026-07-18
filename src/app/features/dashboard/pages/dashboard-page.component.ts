import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
  resource,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { finalize, map } from 'rxjs/operators';
import { DashboardService } from '@services/api/dashboard';
import { CompaniesService } from '@services/api/companies';
import { ExpensesService } from '@services/api/expenses';
import { ToastService } from '@core/notifications/toast.service';
import { SessionService } from '@core/services/state/session';
import { dashboardChartPrimary } from '@features/dashboard/utils/dashboard-chart-colors';
import { buildDashboardOperationalFlowOption } from '@features/dashboard/utils/dashboard-operational-flow-option';
import { buildDashboardTopDestinationsOption } from '@features/dashboard/utils/dashboard-top-destinations-option';
import { buildDashboardTripActivityOption } from '@features/dashboard/utils/dashboard-trip-activity-option';
import { buildReportsGeneralOperationMixPieOption } from '@features/reports/utils/charts/general/reports-general-operation-mix-pie-option';
import {
  buildDashboardUpcomingPayments,
  dashboardUpcomingPaymentsRange,
  type DashboardUpcomingPaymentRow,
} from '@features/dashboard/utils/dashboard-upcoming-payments.util';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import type { TripStatus } from '@shared/models/logistics.models';
import { CurrencyMxPipe } from '@shared/pipes/currency-mx.pipe';
import { canAccessModule, isAdminRole } from '@shared/utils/access-control';
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
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';

function pluralEs(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function formatWeekOverWeekPercent(value: number | null | undefined): string {
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
    ToSkeletonComponent,
    ToIconComponent,
    ToInputComponent,
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent {
  private readonly dashboardApi = inject(DashboardService);
  private readonly companiesApi = inject(CompaniesService);
  private readonly expensesApi = inject(ExpensesService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly currencyMx = inject(CurrencyMxPipe);
  private readonly toast = inject(ToastService);

  /**
   * En mobile solo se muestran KPIs y próximos pagos; las gráficas quedan
   * ocultas y el request de insights no se ejecuta para ahorrar recursos.
   */
  readonly isMobileViewport = injectIsMobileViewport();

  private readonly pageResource = resource({
    request: () => ({ mobile: this.isMobileViewport() }),
    loader: ({ request }) =>
      firstValueFrom(
        forkJoin({
          summary: this.dashboardApi.getSummary(),
          insights: request.mobile ? of(null) : this.dashboardApi.getInsights(),
          upcomingPayments: this.loadUpcomingPayments(),
        }),
      ),
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
  readonly showUpcomingPayments = computed(
    () => this.showFinancialInsights() && this.upcomingPayments().length > 0,
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

  readonly showFinancialInsights = computed(() => {
    const role = this.session.role();
    if (isAdminRole(role)) {
      return true;
    }
    return canAccessModule(this.session.allowedModules(), APP_MODULE_CODES.EXPENSES);
  });

  readonly canEditDiesel = computed(() => isAdminRole(this.session.role()));

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
    const pct = formatWeekOverWeekPercent(
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

  readonly dailyResultMeta = computed(() => {
    const r = this.summary()?.dailyResult;
    if (!r) {
      return '';
    }
    const mLabel = pluralEs(r.completedTripsCount, 'maniobra', 'maniobras');
    const gLabel = pluralEs(r.expensesCount, 'gasto', 'gastos');
    return `${r.completedTripsCount} ${mLabel} · ${r.expensesCount} ${gLabel}`;
  });

  readonly dailyResultValue = computed(() => {
    const margin = this.summary()?.dailyResult.margin ?? 0;
    return this.currencyMx.transform(margin);
  });

  readonly dailyResultLegend = computed(() => {
    const r = this.summary()?.dailyResult;
    if (!r) {
      return '';
    }
    const ing = this.currencyMx.transform(r.revenue);
    const gas = this.currencyMx.transform(r.expenses);
    return `Ingresos ${ing} − gastos ${gas}`;
  });

  readonly dailyResultTone = computed((): 'up' | 'down' | 'neutral' => {
    const m = this.summary()?.dailyResult.margin ?? 0;
    if (m > 0) {
      return 'up';
    }
    if (m < 0) {
      return 'down';
    }
    return 'neutral';
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
      .pipe(finalize(() => this.dieselSaving.set(false)))
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

  private loadUpcomingPayments() {
    if (!this.showFinancialInsights()) {
      return of([] as DashboardUpcomingPaymentRow[]);
    }
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

  openRecentTrip(tripId: number): void {
    if (!tripId) {
      return;
    }
    void this.router.navigate(['/trips'], {
      queryParams: { tripId: String(tripId) },
    });
  }
}
