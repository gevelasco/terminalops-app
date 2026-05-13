import { Component, inject, signal } from '@angular/core';
import { ExpenseRepository } from '@features/expenses/data/expense.repository';
import { Expense } from '@shared/models/logistics.models';
import { CurrencyMxPipe } from '@shared/pipes/currency-mx.pipe';
import { DateShortPipe } from '@shared/pipes/date-short.pipe';
import { ToPageHeaderComponent } from '@shared/ui/to-page-header/to-page-header.component';
import { ToSkeletonComponent } from '@shared/ui/to-skeleton/to-skeleton.component';
import {
  ToTableColumn,
  ToTableComponent,
} from '@shared/ui/to-table/to-table.component';

@Component({
  selector: 'app-expenses-page',
  standalone: true,
  providers: [CurrencyMxPipe, DateShortPipe],
  imports: [ToPageHeaderComponent, ToTableComponent, ToSkeletonComponent],
  templateUrl: './expenses-page.component.html',
})
export class ExpensesPageComponent {
  private readonly repo = inject(ExpenseRepository);
  private readonly currencyMx = inject(CurrencyMxPipe);
  private readonly dateShort = inject(DateShortPipe);

  readonly loading = signal(true);
  readonly rows = signal<Record<string, unknown>[]>([]);

  readonly columns: ToTableColumn[] = [
    { key: 'tripId', label: 'Maniobras' },
    { key: 'category', label: 'Categoría' },
    { key: 'amount', label: 'Monto' },
    { key: 'incurredAt', label: 'Fecha' },
  ];

  constructor() {
    this.repo.list().subscribe({
      next: (expenses) => {
        this.rows.set(expenses.map((e) => this.mapExpenseRow(e)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private mapExpenseRow(e: Expense): Record<string, unknown> {
    return {
      id: e.id,
      tripId: e.tripId,
      category: e.category,
      amount: this.currencyMx.transform(e.amount, e.currency),
      incurredAt: this.dateShort.transform(e.incurredAt),
    };
  }
}
