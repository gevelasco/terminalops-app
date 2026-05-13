import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { MOCK_OPERATORS } from '@app/mock-data/mock-operators';
import { Operator } from '@shared/models/logistics.models';
import { OperatorRepository } from './operator.repository';

@Injectable()
export class MockOperatorRepository extends OperatorRepository {
  override list(): Observable<Operator[]> {
    return of([...MOCK_OPERATORS]).pipe(delay(260));
  }
}
