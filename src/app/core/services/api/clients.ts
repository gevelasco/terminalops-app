import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { Client, CreateClientPayload } from '@shared/models/client.models';
import { mapApiClient } from '@shared/data/api-mappers';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId, resourceByIdUrl } from './api-url';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getClientsList(): Observable<Client[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<Record<string, unknown>[]>(companyResourceUrl(companyId, 'clients'))
      .pipe(map((rows) => rows.map((r) => mapApiClient(r))));
  }

  getClientById(id: string): Observable<Client | null> {
    return this.http
      .get<Record<string, unknown>>(resourceByIdUrl('clients', id))
      .pipe(map((r) => mapApiClient(r)));
  }

  postClient(payload: CreateClientPayload): Observable<Client> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .post<Record<string, unknown>>(companyResourceUrl(companyId, 'clients'), payload)
      .pipe(map((r) => mapApiClient(r)));
  }

  patchClientById(client: Client): Observable<Client> {
    return this.http
      .patch<Record<string, unknown>>(resourceByIdUrl('clients', client.id), client)
      .pipe(map((r) => mapApiClient(r)));
  }
}
