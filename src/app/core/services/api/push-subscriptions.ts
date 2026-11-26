import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type PushSubscriptionListItem = {
  id: number;
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertPushSubscriptionRequest = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
};

@Injectable({ providedIn: 'root' })
export class PushSubscriptionsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/users/me/push`;

  getVapidPublicKey(): Observable<{ publicKey: string }> {
    return this.http.get<{ publicKey: string }>(`${this.base}/vapid-public-key`);
  }

  list(): Observable<{ count: number; subscriptions: PushSubscriptionListItem[] }> {
    return this.http.get<{ count: number; subscriptions: PushSubscriptionListItem[] }>(
      `${this.base}/subscriptions`,
    );
  }

  upsert(body: UpsertPushSubscriptionRequest): Observable<PushSubscriptionListItem> {
    return this.http.put<PushSubscriptionListItem>(`${this.base}/subscriptions`, body);
  }

  remove(endpoint: string): Observable<{ ok: true; removed: boolean }> {
    return this.http.delete<{ ok: true; removed: boolean }>(`${this.base}/subscriptions`, {
      body: { endpoint },
    });
  }
}
