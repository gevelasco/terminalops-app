import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { mapApiOperationConfiguration } from '@shared/data/operation-configuration-api-mapper';
import type {
  CreateOperationConfigurationPayload,
  OperationConfiguration,
  UpdateOperationConfigurationPayload,
} from '@shared/models/operation-configuration.models';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId, resourceByIdUrl } from './api-url';

@Injectable({ providedIn: 'root' })
export class OperationConfigurationsService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getOperationConfigurationsList(): Observable<OperationConfiguration[]> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .get<Record<string, unknown>[]>(
        companyResourceUrl(companyId, 'operation-configurations'),
      )
      .pipe(map((rows) => rows.map((r) => mapApiOperationConfiguration(r))));
  }

  postOperationConfiguration(
    payload: CreateOperationConfigurationPayload,
  ): Observable<OperationConfiguration> {
    const companyId = requireCompanyId(this.session.companyId());
    return this.http
      .post<Record<string, unknown>>(
        companyResourceUrl(companyId, 'operation-configurations'),
        payload,
      )
      .pipe(map((r) => mapApiOperationConfiguration(r)));
  }

  patchOperationConfigurationById(
    config: OperationConfiguration,
    patch: UpdateOperationConfigurationPayload,
  ): Observable<OperationConfiguration> {
    return this.http
      .patch<Record<string, unknown>>(
        resourceByIdUrl('operation-configurations', config.id),
        patch,
      )
      .pipe(map((r) => mapApiOperationConfiguration(r)));
  }
}
