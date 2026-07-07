import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import {
  ExpensesService,
  type ExpensesCalendarParams,
  type ExpensesCalendarResponse,
} from '@services/api/expenses';
import {
  buildExpensesCalendarWeeks,
  defaultExpenseCalendarRange,
  expensesCalendarWeekdayLabels,
  formatExpenseCalendarMonthTitle,
  formatExpenseCalendarRangeLabel,
  isYmdInRange,
  isYmdRangeEndpoint,
  normalizeExpenseDateRange,
  resolveExpenseCalendarQueryRange,
  shiftCalendarMonth,
} from '@features/expenses/utils/expenses-calendar.util';
import { formatExpenseIncurredDateDisplay } from '@features/expenses/utils/expenses-form.util';
import {
  expenseFromProjectedCalendarItem,
} from '@features/expenses/utils/expenses-calendar-projection-expense.util';
import type { Expense } from '@shared/models/logistics.models';
import { CurrencyMxPipe } from '@shared/pipes/currency-mx.pipe';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

const EMPTY_CALENDAR: ExpensesCalendarResponse = {
  from: '',
  to: '',
  items: [],
  total: 0,
  page: 1,
  limit: 15,
  markers: [
    { label: 'Directos', amount: 0, pct: 0, tone: 'primary' },
    { label: 'Recurrentes', amount: 0, pct: 0, tone: 'muted' },
    { label: 'Por pagar', amount: 0, pct: 0, tone: 'accent' },
  ],
  summary: {
    actualCount: 0,
    actualTotalAmount: 0,
    projectedCount: 0,
    projectedTotalAmount: 0,
    grandCount: 0,
    grandTotalAmount: 0,
  },
};

@Component({
  selector: 'app-expenses-calendar-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CurrencyMxPipe],
  imports: [ToButtonComponent, ToSkeletonComponent, ToTableComponent],
  templateUrl: './expenses-calendar-tab.component.html',
  styleUrl: './expenses-calendar-tab.component.scss',
})
export class ExpensesCalendarTabComponent {
  private readonly expensesApi = inject(ExpensesService);
  private readonly currencyMx = inject(CurrencyMxPipe);
  private readonly initialRange = defaultExpenseCalendarRange();

  /** Incrementar desde la página al crear/editar/eliminar gastos. */
  readonly reloadToken = input(0);
  readonly expenseSelect = output<Expense>();

  readonly viewMonth = signal(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12),
  );
  readonly rangeFrom = signal<string | null>(this.initialRange.from);
  readonly rangeTo = signal<string | null>(this.initialRange.to);
  readonly pageIndex = model(0);
  readonly pageSize = model(15);
  readonly pageSizeOptions = [10, 15, 25, 50, 100] as const;

  readonly weekdayLabels = expensesCalendarWeekdayLabels();
  readonly monthTitle = computed(() =>
    formatExpenseCalendarMonthTitle(this.viewMonth()),
  );
  readonly rangeLabel = computed(() =>
    formatExpenseCalendarRangeLabel(this.rangeFrom(), this.rangeTo()),
  );
  readonly calendarWeeks = computed(() =>
    buildExpensesCalendarWeeks(this.viewMonth()),
  );
  readonly queryRange = computed(() =>
    resolveExpenseCalendarQueryRange(this.rangeFrom(), this.rangeTo()),
  );

  readonly calendarParams = computed((): ExpensesCalendarParams | null => {
    const range = this.queryRange();
    if (!range) {
      return null;
    }
    return {
      from: range.from,
      to: range.to,
      page: this.pageIndex() + 1,
      limit: this.pageSize(),
    };
  });

  private readonly calendarResource = resource<
    ExpensesCalendarResponse,
    ExpensesCalendarParams | null
  >({
    request: () => this.calendarParams(),
    loader: async ({ request }): Promise<ExpensesCalendarResponse> => {
      if (!request) {
        return EMPTY_CALENDAR;
      }
      return firstValueFrom(
        this.expensesApi.getExpensesCalendar(request).pipe(
          catchError(() => of(EMPTY_CALENDAR)),
        ),
      );
    },
  });

  constructor() {
    effect(() => {
      this.queryRange();
      this.pageSize();
      untracked(() => this.pageIndex.set(0));
    });

    effect(() => {
      this.reloadToken();
      untracked(() => {
        if (this.calendarResource.hasValue()) {
          void this.calendarResource.reload();
        }
      });
    });
  }

  readonly listLoading = computed(
    () => this.calendarResource.isLoading() && !this.calendarResource.hasValue(),
  );
  readonly listReloading = computed(
    () => this.calendarResource.isLoading() && this.calendarResource.hasValue(),
  );
  readonly calendarData = computed(() => this.calendarResource.value() ?? EMPTY_CALENDAR);
  readonly entryCount = computed(() => this.calendarData().total);
  readonly hasExpenseRows = computed(() => this.tableRows().length > 0);
  readonly hasEntries = computed(() => (this.calendarData().summary.grandCount ?? 0) > 0);
  readonly awaitingRangeEnd = computed(
    () => Boolean(this.rangeFrom()) && !this.rangeTo(),
  );

  readonly markers = computed(() =>
    this.calendarData().markers.map((marker) => ({
      ...marker,
      value: this.currencyMx.transform(Number(marker.amount), 'MXN'),
    })),
  );

  readonly periodSummary = computed(() => {
    const summary = this.calendarData().summary;
    return {
      spent: this.currencyMx.transform(Number(summary.actualTotalAmount), 'MXN'),
      scheduled: this.currencyMx.transform(Number(summary.projectedTotalAmount), 'MXN'),
    };
  });

  readonly showPeriodSummary = computed(() => !this.awaitingRangeEnd());

  readonly tableRows = computed(() =>
    this.calendarData().items.map((item) => ({
      id: item.entryType === 'actual' && item.expense?.id ? item.expense.id : item.id,
      entryType: item.entryType,
      rubroLabel: item.rubroLabel,
      category: item.conceptLabel,
      amount: this.currencyMx.transform(Number(item.amount), item.currency),
      statusLabel: item.statusLabel,
      incurredAt: formatExpenseIncurredDateDisplay(
        `${item.dateYmd}T12:00:00-06:00`,
        item.dateYmd,
      ),
    })),
  );

  readonly footerRow = computed(() => {
    const summary = this.calendarData().summary;
    const actualCount = summary.actualCount;
    const projectedCount = summary.projectedCount;
    const parts: string[] = [];
    if (actualCount > 0) {
      parts.push(
        actualCount === 1 ? '1 realizado' : `${actualCount.toLocaleString('es-MX')} realizados`,
      );
    }
    if (projectedCount > 0) {
      parts.push(
        projectedCount === 1
          ? '1 proyectado'
          : `${projectedCount.toLocaleString('es-MX')} proyectados`,
      );
    }
    const countLabel = parts.length > 0 ? parts.join(' · ') : '0 movimientos';
    return {
      rubroLabel: 'Total',
      category: countLabel,
      statusLabel: '',
      amount: this.currencyMx.transform(Number(summary.grandTotalAmount), 'MXN'),
      incurredAt: '',
    };
  });

  readonly columns: ToTableColumn[] = [
    { key: 'rubroLabel', label: 'Rubro' },
    { key: 'category', label: 'Concepto' },
    { key: 'amount', label: 'Monto' },
    { key: 'incurredAt', label: 'Fecha' },
    { key: 'statusLabel', label: 'Estado', cell: 'muted-badge' },
  ];

  prevMonth(): void {
    this.viewMonth.update((m) => shiftCalendarMonth(m, -1));
  }

  nextMonth(): void {
    this.viewMonth.update((m) => shiftCalendarMonth(m, 1));
  }

  onDayClick(ymd: string): void {
    const from = this.rangeFrom();
    const to = this.rangeTo();
    if (!from || to) {
      this.rangeFrom.set(ymd);
      this.rangeTo.set(null);
      return;
    }
    const range = normalizeExpenseDateRange(from, ymd);
    this.rangeFrom.set(range.from);
    this.rangeTo.set(range.to);
  }

  onRowClick(row: Record<string, unknown>): void {
    const entryType = row['entryType'];
    const id = row['id'];
    if (typeof id !== 'string' || !id) {
      return;
    }

    if (entryType === 'actual') {
      const item = this.calendarData().items.find(
        (entry) => entry.entryType === 'actual' && entry.expense?.id === id,
      );
      if (item?.expense) {
        this.expenseSelect.emit(item.expense);
      }
      return;
    }

    if (entryType === 'projected') {
      const item = this.calendarData().items.find(
        (entry) => entry.entryType === 'projected' && entry.id === id,
      );
      if (!item) {
        return;
      }
      const projectedExpense = expenseFromProjectedCalendarItem(item);
      if (projectedExpense) {
        this.expenseSelect.emit(projectedExpense);
      }
    }
  }

  dayAriaLabel(day: number, inMonth: boolean, ymd: string): string {
    const date = new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(
      new Date(
        Number(ymd.slice(0, 4)),
        Number(ymd.slice(5, 7)) - 1,
        Number(ymd.slice(8, 10)),
        12,
      ),
    );
    if (!inMonth) {
      return `${date} (fuera del mes visible)`;
    }
    return date;
  }

  dayClasses(ymd: string, inMonth: boolean): Record<string, boolean> {
    const from = this.rangeFrom();
    const to = this.rangeTo();
    const inRange = isYmdInRange(ymd, from, to);
    const endpoint = isYmdRangeEndpoint(ymd, from, to);
    return {
      'expenses-cal-day': true,
      'expenses-cal-day--outside': !inMonth,
      'expenses-cal-day--in-range': inRange && !endpoint,
      'expenses-cal-day--endpoint': endpoint,
      'expenses-cal-day--pending': Boolean(from && !to && ymd === from),
    };
  }

  isRangeEndpoint(ymd: string): boolean {
    return isYmdRangeEndpoint(ymd, this.rangeFrom(), this.rangeTo());
  }
}
