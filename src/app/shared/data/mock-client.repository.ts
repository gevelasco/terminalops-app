import { Injectable, inject } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { SimulatedDbService } from '@app/sim-db/simulated-db.service';
import type { Client, CreateClientPayload } from '@shared/models/client.models';
import { defaultClientPayment } from '@shared/utils/client-defaults';
import { ClientRepository } from './client.repository';

@Injectable()
export class MockClientRepository extends ClientRepository {
  private readonly db = inject(SimulatedDbService);

  override list(): Observable<Client[]> {
    return of(this.db.listClients()).pipe(delay(200));
  }

  override get(id: string): Observable<Client | null> {
    return of(this.db.getClient(id)).pipe(delay(120));
  }

  override create(payload: CreateClientPayload): Observable<Client> {
    const row: Client = {
      id: `cli-${Date.now()}`,
      name: payload.name,
      rfc: payload.rfc,
      relationshipStartedOn: payload.relationshipStartedOn,
      notes: payload.notes?.trim() || undefined,
      billing: { ...payload.billing },
      contacts: [...(payload.contacts ?? [])],
      payment: {
        ...defaultClientPayment(),
        ...payload.payment,
      },
    };
    this.db.insertClient(row);
    return of(structuredClone(row)).pipe(delay(220));
  }

  override update(client: Client): Observable<Client> {
    const prev = this.db.getClient(client.id);
    if (!prev) {
      return of(structuredClone(client)).pipe(delay(120));
    }
    const merged: Client = structuredClone(client);
    this.db.updateClient(merged);
    return of(structuredClone(merged)).pipe(delay(220));
  }
}
