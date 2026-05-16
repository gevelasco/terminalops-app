import { Observable } from 'rxjs';
import type { Client, CreateClientPayload } from '@shared/models/client.models';

export abstract class ClientRepository {
  abstract list(): Observable<Client[]>;
  abstract get(id: string): Observable<Client | null>;
  abstract create(payload: CreateClientPayload): Observable<Client>;
  abstract update(client: Client): Observable<Client>;
}
