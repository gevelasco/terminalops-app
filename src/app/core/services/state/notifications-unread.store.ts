import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Subject,
  Subscription,
  catchError,
  exhaustMap,
  of,
} from 'rxjs';
import { NotificationsService } from '@core/services/api/notifications';
import { SessionService } from '@core/services/state/session';

export const NOTIF_LAST_SEEN_STORAGE_PREFIX = 'to.notif.lastSeen';
const POLL_MS = 60_000;

/** Snapshot de watermarks para restaurarlos tras clearAllBrowserStorage. */
export function snapshotNotifLastSeen(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof localStorage === 'undefined') {
    return out;
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(NOTIF_LAST_SEEN_STORAGE_PREFIX)) {
        continue;
      }
      const value = localStorage.getItem(key);
      if (value) {
        out[key] = value;
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

export function restoreNotifLastSeen(entries: Record<string, string>): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value);
    }
  } catch {
    /* ignore quota */
  }
}

/**
 * Badge de notificaciones nuevas por usuario+empresa.
 * Watermark en localStorage; poll ligero a /notifications/summary.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsUnreadStore {
  private readonly session = inject(SessionService);
  private readonly api = inject(NotificationsService);

  private readonly unreadCount = signal(0);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private onFocus: (() => void) | null = null;
  private readonly refresh$ = new Subject<void>();
  private refreshSub: Subscription | null = null;

  readonly badgeCount = computed(() => this.unreadCount());

  start(): void {
    if (this.started || !this.session.companyId() || !this.session.userId()) {
      return;
    }
    this.started = true;
    this.ensureBaselineLastSeen();
    this.refreshSub = this.refresh$
      .pipe(
        exhaustMap(() => {
          const companyId = this.session.companyId();
          const userId = this.session.userId();
          if (!companyId || !userId) {
            return of(null);
          }
          const since = this.readLastSeen() ?? new Date().toISOString();
          return this.api.getSummary(since).pipe(catchError(() => of(null)));
        }),
      )
      .subscribe((summary) => {
        if (!summary) {
          return;
        }
        this.unreadCount.set(summary.count > 0 ? summary.count : 0);
      });
    this.refresh();
    this.pollTimer = setInterval(() => this.refresh(), POLL_MS);
    this.onFocus = () => this.refresh();
    window.addEventListener('focus', this.onFocus);
  }

  stop(): void {
    this.started = false;
    if (this.pollTimer != null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.onFocus) {
      window.removeEventListener('focus', this.onFocus);
      this.onFocus = null;
    }
    this.refreshSub?.unsubscribe();
    this.refreshSub = null;
    this.unreadCount.set(0);
  }

  /** Al abrir el drawer: marca como visto y limpia badge. */
  markSeen(atIso?: string): void {
    const iso = atIso?.trim() || new Date().toISOString();
    this.writeLastSeen(iso);
    this.unreadCount.set(0);
  }

  refresh(): void {
    if (!this.started) {
      return;
    }
    this.refresh$.next();
  }

  private storageKey(): string | null {
    const companyId = this.session.companyId();
    const userId = this.session.userId();
    if (!companyId || !userId) {
      return null;
    }
    return `${NOTIF_LAST_SEEN_STORAGE_PREFIX}.${userId}.${companyId}`;
  }

  private readLastSeen(): string | null {
    const key = this.storageKey();
    if (!key) {
      return null;
    }
    try {
      const raw = localStorage.getItem(key)?.trim();
      if (!raw) {
        return null;
      }
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    } catch {
      return null;
    }
  }

  private writeLastSeen(iso: string): void {
    const key = this.storageKey();
    if (!key) {
      return;
    }
    try {
      localStorage.setItem(key, iso);
    } catch {
      /* ignore quota */
    }
  }

  /** Primera vez: ancla watermark al ahora para no inundar con historial. */
  private ensureBaselineLastSeen(): void {
    if (this.readLastSeen()) {
      return;
    }
    this.writeLastSeen(new Date().toISOString());
  }
}
