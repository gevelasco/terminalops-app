import { Injectable, inject } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { SimulatedDbService } from '@app/sim-db/simulated-db.service';
import { Expense } from '@shared/models/logistics.models';
import { CreateExpensePayload, ExpenseRepository } from './expense.repository';

@Injectable()
export class MockExpenseRepository extends ExpenseRepository {
  private readonly db = inject(SimulatedDbService);

  override list(): Observable<Expense[]> {
    return of(this.db.listExpenses()).pipe(delay(300));
  }

  override create(payload: CreateExpensePayload): Observable<Expense> {
    const row: Expense = {
      ...payload,
      id: `ex-${Date.now()}`,
    };
    this.db.prependExpense(row);
    return of(row).pipe(delay(220));
  }
}
