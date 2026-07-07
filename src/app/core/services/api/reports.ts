import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { ReportsFilter } from '@features/reports/models/reports-view.models';
import {
  mapApiReportsGeneral,
  type ReportsGeneralData,
} from '@shared/models/api/api-reports-general.model';
import {
  mapApiReportsBalance,
  type ReportsBalanceData,
} from '@shared/models/api/api-reports-balance.model';
import {
  mapApiReportsManiobras,
  type ReportsManiobrasData,
} from '@shared/models/api/api-reports-maniobras.model';
import {
  mapApiReportsFleet,
  type ReportsFleetData,
} from '@shared/models/api/api-reports-fleet.model';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId } from './api-url';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getGeneral(filter: ReportsFilter): Observable<ReportsGeneralData> {
    const companyId = requireCompanyId(this.session.companyId());
    const query: Record<string, string | undefined> = {
      from: filter.from,
      to: filter.to,
      clientIds: filter.clientIds.length > 0 ? filter.clientIds.join(',') : undefined,
      paymentMethods:
        filter.clientPaymentMethods.length > 0
          ? filter.clientPaymentMethods.join(',')
          : undefined,
    };
    return this.http
      .get<Record<string, unknown>>(
        companyResourceUrl(companyId, 'reports/general', query),
      )
      .pipe(map((raw) => mapApiReportsGeneral(raw)));
  }

  getBalance(filter: ReportsFilter): Observable<ReportsBalanceData> {
    const companyId = requireCompanyId(this.session.companyId());
    const query: Record<string, string | undefined> = {
      from: filter.from,
      to: filter.to,
      clientIds: filter.clientIds.length > 0 ? filter.clientIds.join(',') : undefined,
      paymentMethods:
        filter.clientPaymentMethods.length > 0
          ? filter.clientPaymentMethods.join(',')
          : undefined,
    };
    return this.http
      .get<Record<string, unknown>>(
        companyResourceUrl(companyId, 'reports/balance', query),
      )
      .pipe(map((raw) => mapApiReportsBalance(raw)));
  }

  getManiobras(filter: ReportsFilter): Observable<ReportsManiobrasData> {
    const companyId = requireCompanyId(this.session.companyId());
    const query: Record<string, string | undefined> = {
      from: filter.from,
      to: filter.to,
      clientIds: filter.clientIds.length > 0 ? filter.clientIds.join(',') : undefined,
      paymentMethods:
        filter.clientPaymentMethods.length > 0
          ? filter.clientPaymentMethods.join(',')
          : undefined,
    };
    return this.http
      .get<Record<string, unknown>>(
        companyResourceUrl(companyId, 'reports/maniobras', query),
      )
      .pipe(map((raw) => mapApiReportsManiobras(raw)));
  }

  getFleet(filter: ReportsFilter): Observable<ReportsFleetData> {
    const companyId = requireCompanyId(this.session.companyId());
    const query: Record<string, string | undefined> = {
      from: filter.from,
      to: filter.to,
      clientIds: filter.clientIds.length > 0 ? filter.clientIds.join(',') : undefined,
      paymentMethods:
        filter.clientPaymentMethods.length > 0
          ? filter.clientPaymentMethods.join(',')
          : undefined,
    };
    return this.http
      .get<Record<string, unknown>>(
        companyResourceUrl(companyId, 'reports/fleet', query),
      )
      .pipe(map((raw) => mapApiReportsFleet(raw)));
  }
}
