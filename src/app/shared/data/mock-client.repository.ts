import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { MOCK_CLIENTS } from '@app/mock-data/mock-clients';
import { Client } from '@shared/models/client.models';
import { ClientRepository } from './client.repository';

@Injectable()
export class MockClientRepository extends ClientRepository {
  override list(): Observable<Client[]> {
    return of([...MOCK_CLIENTS]).pipe(delay(200));
  }
}
