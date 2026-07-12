import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SessionService } from '../state/session';
import { companyResourceUrl, requireCompanyId } from './api-url';

export type NotificationPeriod = 'day' | 'week' | 'month';

export type NotificationFeedTone = 'danger' | 'warning' | 'neutral';

export interface NotificationFeedItem {
  id: string;
  kind: string;
  origin: 'event' | 'computed';
  icon: string;
  title: string;
  subjectLabel: string;
  occurredAt: string;
  actorLabel: string;
  tone?: NotificationFeedTone;
  entityType?: string | null;
  entityId?: string | null;
  entityTab?: string | null;
}

export interface NotificationsFeedResponse {
  period: NotificationPeriod;
  from: string;
  to: string;
  total: number;
  items: NotificationFeedItem[];
}

export interface NotificationsFeedParams {
  period?: NotificationPeriod;
  limit?: number;
  countOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  getFeed(params: NotificationsFeedParams = {}): Observable<NotificationsFeedResponse> {
    const companyId = requireCompanyId(this.session.companyId());
    let httpParams = new HttpParams();
    if (params.period) {
      httpParams = httpParams.set('period', params.period);
    }
    if (params.limit != null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    if (params.countOnly) {
      httpParams = httpParams.set('countOnly', 'true');
    }
    return this.http.get<NotificationsFeedResponse>(
      companyResourceUrl(companyId, 'notifications'),
      { params: httpParams },
    );
  }
}
