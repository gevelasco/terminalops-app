import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
  resource,
  signal,
} from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ExpensesDetailDrawerComponent } from '@features/expenses/components/expenses-detail-drawer/expenses-detail-drawer.component';
import { ExpensesNewDrawerComponent } from '@features/expenses/components/expenses-new-drawer/expenses-new-drawer.component';
import { ExpensesService } from '@services/api/expenses';
import {
  expenseFleetRelationCode,
  expenseKindLabel,
  expenseManeuverCode,
  expensePaymentMethodLabel,
} from '@features/expenses/utils/expense-row-labels';
import { Expense } from '@shared/models/logistics.models';
import { CurrencyMxPipe } from '@shared/pipes/currency-mx.pipe';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import { ToButtonComponent } from '@shared/ui/to-button/to-button.component';
import { ToInputComponent } from '@shared/ui/to-input/to-input.component';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

@Component({
  selector: 'app-expenses-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CurrencyMxPipe, DateShortPipe],
  imports: [
    ToPageHeaderComponent,
    ToButtonComponent,
    ToInputComponent,
    ToTableComponent,
    ToSkeletonComponent,
    ExpensesNewDrawerComponent,
    ExpensesDetailDrawerComponent,
  ],
  templateUrl: './expenses-page.component.html',
  styleUrl: './expenses-page.component.scss',
})
export class ExpensesPageComponent {
  private readonly expensesApi = inject(ExpensesService);
  private readonly currencyMx = inject(CurrencyMxPipe);
  private readonly dateShort = inject(DateShortPipe);

  private readonly listResource = resource({
    loader: async (): Promise<Expense[]> =>
      firstValueFrom(
        this.expensesApi.getExpensesList().pipe(catchError(() => of([] as Expense[]))),
      ),
  });

  readonly loading = computed(
    () => !this.listResource.hasValue() && this.listResource.isLoading(),
  );
  readonly expenses = computed(() => this.listResource.value() ?? []);
  readonly rows = computed(() => {
    const list = this.listResource.value();
    if (!list) {
      return [] as Record<string, unknown>[];
    }
    return list.map((e) => this.mapExpenseRow(e));
  });
  readonly searchQuery = model('');
  readonly tripManeuverByTripId = computed(
    () => new Map<string, string>() as ReadonlyMap<string, string>,
  );
  readonly newExpenseOpen = signal(false);
  readonly detailExpense = signal<Expense | null>(null);

  readonly columns: ToTableColumn[] = [
    { key: 'kindLabel', label: 'Rubro' },
    { key: 'maneuver', label: 'Maniobra', cell: 'muted-badge' },
    { key: 'category', label: 'Concepto' },
    { key: 'amount', label: 'Monto' },
    { key: 'incurredAt', label: 'Fecha' },
  ];

  readonly displayedExpenseRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.rows();
    if (!q) {
      return all;
    }
    return all.filter((row) => ExpensesPageComponent.rowMatchesQuery(row, q));
  });

  reloadExpenses(): void {
    void this.listResource.reload();
  }

  onExpenseSaved(): void {
    this.newExpenseOpen.set(false);
    this.reloadExpenses();
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

  private static rowMatchesQuery(
    row: Record<string, unknown>,
    q: string,
  ): boolean {
    const haystack = [
      row['id'],
      row['kindLabel'],
      row['relation'],
      row['category'],
      row['amount'],
      row['incurredAt'],
      row['_searchBlob'],
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');
    return haystack.includes(q);
  }

  private mapExpenseRow(e: Expense): Record<string, unknown> {
    const maneuver = expenseManeuverCode(e);
    const fleetRelation = expenseFleetRelationCode(e);
    const searchBlob = [
      e.description,
      e.vendor,
      e.kind,
      expenseKindLabel(e.kind),
      e.tripId,
      maneuver,
      fleetRelation,
      e.relatedUnitId,
      e.relatedEquipmentId,
      e.relatedOperatorId,
      e.paymentMethod,
      expensePaymentMethodLabel(e.paymentMethod),
      e.currency,
      String(e.amount),
    ]
      .map((x) => (x == null ? '' : String(x).trim()))
      .filter((s) => s.length > 0)
      .join(' ');
    return {
      id: e.id,
      kindLabel: expenseKindLabel(e.kind),
      maneuver,
      fleetRelation,
      category: e.category,
      amount: this.currencyMx.transform(e.amount, e.currency),
      incurredAt: this.dateShort.transform(e.incurredAt),
      _searchBlob: searchBlob,
    };
  }
}
