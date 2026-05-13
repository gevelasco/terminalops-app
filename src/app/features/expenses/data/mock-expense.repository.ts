import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { MOCK_EXPENSES } from '@app/mock-data/mock-expenses';
import { Expense } from '@shared/models/logistics.models';
import { ExpenseRepository } from './expense.repository';

@Injectable()
export class MockExpenseRepository extends ExpenseRepository {
  override list(): Observable<Expense[]> {
    return of([...MOCK_EXPENSES]).pipe(delay(300));
  }
}
