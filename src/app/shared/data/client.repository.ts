import { Observable } from 'rxjs';
import { Client } from '@shared/models/client.models';

export abstract class ClientRepository {
  abstract list(): Observable<Client[]>;
}
