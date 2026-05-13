import { Observable } from 'rxjs';
import { Expense } from '@shared/models/logistics.models';

export abstract class ExpenseRepository {
  abstract list(): Observable<Expense[]>;
}
