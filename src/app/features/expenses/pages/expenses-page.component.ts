import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  model,
  OnInit,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ToastService } from '@core/notifications/toast.service';
import { OperationalFleetSyncService } from '@core/services/state/operational-fleet-sync.service';
import { SessionService } from '@core/services/state/session';
import { APP_MODULE_CODES } from '@shared/models/app-modules.models';
import { ExpensesCalendarTabComponent } from '@features/expenses/components/expenses-calendar-tab/expenses-calendar-tab.component';
import { ExpensesDetailDrawerComponent } from '@features/expenses/components/expenses-detail-drawer/expenses-detail-drawer.component';
import { ExpensesNewDrawerComponent } from '@features/expenses/components/expenses-new-drawer/expenses-new-drawer.component';
import { ExpensesService, type ExpensesListParams, type ExpensesListResponse } from '@services/api/expenses';
import {
  expenseConceptLabel,
  expenseFleetRelationLabel,
  expenseManeuverCode,
  expensePaymentMethodLabel,
  expenseRubroLabelForExpense,
} from '@features/expenses/utils/expense-row-labels';
import {
  buildExpensesCsv,
  downloadExpensesCsv,
} from '@features/expenses/utils/expenses-export-csv';
import {
  compareMonthYear,
  rangeForMonthYearSpan,
} from '@features/reports/utils/reports-filter';
import { Expense } from '@shared/models/logistics.models';
import { CurrencyMxPipe } from '@shared/pipes/currency-mx.pipe';
import { injectIsMobileViewport } from '@shared/utils/viewport';
import { formatExpenseIncurredDateDisplay } from '@features/expenses/utils/expenses-form.util';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import {
  ToMonthYearPickerComponent,
  type ToMonthYearValue,
} from '@shared/ui/to-month-year-picker/to-month-year-picker.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import {
  ToSegmentControlComponent,
  type ToSegmentTab,
} from '@shared/ui/to-segment-control/to-segment-control.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

import {
  debouncedTrimmedSearchQuery,
  EXPENSES_SEARCH_DEBOUNCE_MS,
} from '@features/expenses/utils/expenses-search-query.util';

export type ExpensesPageTab = 'calendar' | 'list';

function currentMonthYearValue(now = new Date()): ToMonthYearValue {
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

@Component({
  selector: 'app-expenses-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CurrencyMxPipe],
  imports: [
    ToPageHeaderComponent,
    ToButtonComponent,
    ToIconComponent,
    ToInputComponent,
    ToMonthYearPickerComponent,
    ToSegmentControlComponent,
    ToTableComponent,
    ToSkeletonComponent,
    ExpensesNewDrawerComponent,
    ExpensesDetailDrawerComponent,
    ExpensesCalendarTabComponent,
  ],
  templateUrl: './expenses-page.component.html',
  styleUrl: './expenses-page.component.scss',
})
export class ExpensesPageComponent implements OnInit {
  private readonly expensesApi = inject(ExpensesService);
  private readonly currencyMx = inject(CurrencyMxPipe);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly operationalFleetSync = inject(OperationalFleetSyncService);
  private readonly session = inject(SessionService);
  private readonly searchField = viewChild<ToInputComponent>('searchField');
  private readonly searchKeepFocus = signal(false);
  protected readonly isMobileViewport = injectIsMobileViewport();

  readonly pageTab = signal<ExpensesPageTab>('calendar');
  readonly viewSegmentTabs: readonly ToSegmentTab<ExpensesPageTab>[] = [
    {
      id: 'calendar',
      label: 'Calendario',
      icon: 'calendar',
      htmlId: 'expenses-tab-calendar',
    },
    {
      id: 'list',
      label: 'Lista',
      icon: 'list',
      htmlId: 'expenses-tab-list',
    },
  ];

  /** Periodo consultado: mes/año inicial y final; default mes en curso. */
  readonly periodFrom = signal<ToMonthYearValue>(currentMonthYearValue());
  readonly periodTo = signal<ToMonthYearValue>(currentMonthYearValue());
  readonly currentMonthYear = computed(
    (): ToMonthYearValue => currentMonthYearValue(),
  );
  readonly pageIndex = model(0);
  readonly pageSize = model(15);
  readonly searchInput = model('');
  readonly searchQuery = signal('');

  readonly pageSizeOptions = [10, 15, 25, 50, 100] as const;

  readonly periodRange = computed(() => {
    const from = this.periodFrom();
    const to = this.periodTo();
    return rangeForMonthYearSpan(from.month, from.year, to.month, to.year);
  });

  readonly periodIsCurrentMonth = computed(() => {
    const now = currentMonthYearValue();
    return (
      compareMonthYear(this.periodFrom(), now) === 0 &&
      compareMonthYear(this.periodTo(), now) === 0
    );
  });

  readonly searchPending = computed(
    () => this.searchInput().trim() !== this.searchQuery(),
  );

  readonly listReloading = computed(
    () => this.listResource.isLoading() && this.listResource.hasValue(),
  );

  readonly searchBusy = computed(
    () => this.searchPending() || this.listReloading(),
  );

  readonly listParams = computed(() => {
    const range = this.periodRange();
    return {
      page: this.pageIndex() + 1,
      limit: this.pageSize(),
      from: range.from,
      to: range.to,
      ...(this.searchQuery() ? { q: this.searchQuery() } : {}),
    };
  });

  private readonly listResource = resource<
    ExpensesListResponse,
    ExpensesListParams | undefined
  >({
    request: () => (this.pageTab() === 'list' ? this.listParams() : undefined),
    loader: async ({ request }): Promise<ExpensesListResponse> => {
      if (!request) {
        return {
          items: [] as Expense[],
          total: 0,
          page: 1,
          limit: this.pageSize(),
          totalAmount: 0,
        };
      }
      return firstValueFrom(
        this.expensesApi.getExpensesPage(request).pipe(
          catchError(() =>
            of({
              items: [] as Expense[],
              total: 0,
              page: request.page ?? 1,
              limit: request.limit ?? 15,
              totalAmount: 0,
            } satisfies ExpensesListResponse),
          ),
        ),
      );
    },
  });

  constructor() {
    debouncedTrimmedSearchQuery(
      toObservable(this.searchInput),
      EXPENSES_SEARCH_DEBOUNCE_MS,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.searchQuery.set(q));

    effect(() => {
      this.periodRange();
      this.searchQuery();
      this.pageSize();
      untracked(() => this.pageIndex.set(0));
    });

    effect(() => {
      const loading = this.listResource.isLoading();
      this.listResource.value();
      if (loading || !this.searchKeepFocus()) {
        return;
      }
      untracked(() => {
        queueMicrotask(() => this.searchField()?.focus());
      });
    });
  }

  ngOnInit(): void {
    this.openExpenseFromQuery(this.route.snapshot.queryParamMap.get('expenseId'));
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.openExpenseFromQuery(params.get('expenseId'));
      });
  }

  private openExpenseFromQuery(expenseId: string | null): void {
    const id = expenseId?.trim();
    if (!id) {
      return;
    }
    this.pageTab.set('list');
    this.expensesApi
      .getExpenseById(id)
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((expense) => {
        if (expense) {
          this.detailExpense.set(expense);
        }
      });
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { expenseId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  readonly initialLoading = computed(
    () => !this.listResource.hasValue() && this.listResource.isLoading(),
  );

  readonly loading = computed(
    () => this.initialLoading(),
  );
  readonly listTotal = computed(() => this.listResource.value()?.total ?? 0);
  readonly expenses = computed(() => this.listResource.value()?.items ?? []);
  readonly hasExpenseRows = computed(() => this.tableRows().length > 0);
  readonly showEmptyHint = computed(
    () =>
      !this.initialLoading() &&
      this.listResource.hasValue() &&
      !this.hasExpenseRows(),
  );

  onSearchFocusIn(): void {
    this.searchKeepFocus.set(true);
  }

  onSearchFocusOut(ev: FocusEvent): void {
    const related = ev.relatedTarget;
    const host = ev.currentTarget;
    if (related instanceof Node && host instanceof Node && host.contains(related)) {
      return;
    }
    this.searchKeepFocus.set(false);
  }

  readonly tableRows = computed(() =>
    this.expenses().map((e) => this.mapExpenseRow(e)),
  );
  readonly tripManeuverByTripId = computed(() => {
    const map = new Map<string, string>();
    for (const e of this.expenses()) {
      const code = e.tripManeuverCode?.trim();
      const tid = e.tripId?.trim();
      if (tid && code) {
        map.set(tid, code);
      }
    }
    return map as ReadonlyMap<string, string>;
  });

  readonly newExpenseOpen = signal(false);
  readonly detailExpense = signal<Expense | null>(null);
  readonly calendarReloadToken = signal(0);
  readonly canWriteExpenses = computed(() =>
    this.session.canWriteModule(APP_MODULE_CODES.EXPENSES),
  );

  readonly columns: ToTableColumn[] = [
    { key: 'rubroLabel', label: 'Rubro' },
    { key: 'category', label: 'Concepto' },
    { key: 'maneuver', label: 'Maniobra', cell: 'muted-badge' },
    { key: 'fleetRelation', label: 'Flota / operador', cell: 'muted-badge' },
    { key: 'amount', label: 'Monto' },
    { key: 'paymentMethod', label: 'Método de pago' },
    { key: 'incurredAt', label: 'Fecha' },
    { key: 'invoiceStatus', label: 'Factura', cell: 'expense-invoice-icon' },
  ];

  readonly footerRow = computed(() => {
    const raw = this.listResource.value()?.totalAmount ?? 0;
    const amount =
      typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '')) || 0;
    const count = this.listTotal();
    const countLabel =
      count === 1 ? '1 gasto' : `${count.toLocaleString('es-MX')} gastos`;
    return {
      rubroLabel: 'Total',
      maneuver: '',
      category: countLabel,
      fleetRelation: '',
      amount: this.currencyMx.transform(amount, 'MXN'),
      paymentMethod: '',
      incurredAt: '',
      invoiceStatus: '',
    };
  });

  reloadExpenses(): void {
    void this.listResource.reload();
  }

  onPeriodFromChange(value: ToMonthYearValue): void {
    this.periodFrom.set(value);
    if (compareMonthYear(value, this.periodTo()) > 0) {
      this.periodTo.set({ ...value });
    }
  }

  onPeriodToChange(value: ToMonthYearValue): void {
    this.periodTo.set(value);
    if (compareMonthYear(value, this.periodFrom()) < 0) {
      this.periodFrom.set({ ...value });
    }
  }

  onPageTabSelect(tab: ExpensesPageTab): void {
    this.pageTab.set(tab);
  }

  onCalendarExpenseSelect(expense: Expense): void {
    this.detailExpense.set(expense);
  }

  private bumpCalendarReload(): void {
    this.calendarReloadToken.update((n) => n + 1);
  }

  onExpenseSaved(expense?: Expense): void {
    this.newExpenseOpen.set(false);
    this.detailExpense.set(null);
    this.reloadExpenses();
    this.bumpCalendarReload();
    if (expense && this.expenseAffectsOperatorPayments(expense)) {
      this.operationalFleetSync.notifyOperatorPaymentsMutation();
    }
  }

  onExpenseUpdated(expense: Expense): void {
    this.detailExpense.set(expense);
    this.reloadExpenses();
    this.bumpCalendarReload();
    if (this.expenseAffectsOperatorPayments(expense)) {
      this.operationalFleetSync.notifyOperatorPaymentsMutation();
    }
  }

  onRowClick(row: Record<string, unknown>): void {
    const id = row['id'];
    if (typeof id !== 'string' || !id) {
      return;
    }
    const e = this.expenses().find((x) => x.id === id);
    if (e) {
      this.detailExpense.set(e);
    }
  }

  onDetailDismiss(): void {
    this.detailExpense.set(null);
  }

  onExpenseDeleted(): void {
    const deleted = this.detailExpense();
    this.detailExpense.set(null);
    this.reloadExpenses();
    this.bumpCalendarReload();
    if (deleted && this.expenseAffectsFleetMeta(deleted)) {
      this.operationalFleetSync.notifyFleetModuleMutation();
    }
    if (deleted && this.expenseAffectsOperatorPayments(deleted)) {
      this.operationalFleetSync.notifyOperatorPaymentsMutation();
    }
  }

  private expenseAffectsFleetMeta(expense: Expense): boolean {
    return (
      (expense.kind === 'verification' ||
        expense.kind === 'insurance' ||
        expense.kind === 'gps') &&
      (!!expense.relatedUnitId || !!expense.relatedEquipmentId)
    );
  }

  private expenseAffectsOperatorPayments(expense: Expense): boolean {
    return (
      (expense.kind === 'operator_payment' ||
        expense.kind === 'operator_commission') &&
      !!expense.tripId?.trim()
    );
  }

  exportFiltered(): void {
    const expenses = this.expenses();
    if (expenses.length === 0) {
      this.toast.show('No hay gastos para exportar con los filtros actuales.', 'warning');
      return;
    }
    const range = this.periodRange();
    const suffix = `${range.from}_${range.to}`;
    const csv = buildExpensesCsv(
      expenses.map((e) => this.mapExpenseExportRow(e)),
    );
    downloadExpensesCsv(csv, `gastos_${suffix}.csv`);
    this.toast.show(`Exportados ${expenses.length} gastos.`, 'success');
  }

  private mapExpenseRow(e: Expense): Record<string, unknown> {
    const exportRow = this.mapExpenseExportRow(e);
    return {
      id: e.id,
      ...exportRow,
      invoiceStatus: e.invoiceRequired === true ? 'required' : 'not-required',
    };
  }

  private mapExpenseExportRow(e: Expense) {
    return {
      rubroLabel: expenseRubroLabelForExpense(e),
      category: expenseConceptLabel(e),
      maneuver: expenseManeuverCode(e, this.tripManeuverByTripId()),
      fleetRelation: expenseFleetRelationLabel(e),
      amount: this.currencyMx.transform(e.amount, e.currency),
      paymentMethod: expensePaymentMethodLabel(e.paymentMethod),
      incurredAt: formatExpenseIncurredDateDisplay(e.incurredAt, e.incurredDate),
      invoiceRequired: e.invoiceRequired === true ? 'Sí' : 'No',
    };
  }
}
