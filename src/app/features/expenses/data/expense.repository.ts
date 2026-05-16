import { Observable } from 'rxjs';
import { Expense } from '@shared/models/logistics.models';

export type CreateExpensePayload = Omit<Expense, 'id'>;

export abstract class ExpenseRepository {
  abstract list(): Observable<Expense[]>;
  abstract create(payload: CreateExpensePayload): Observable<Expense>;
}
