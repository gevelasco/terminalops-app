import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { Observable, firstValueFrom, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { PushSubscriptionsApiService } from '@core/services/api/push-subscriptions';
import { environment } from '../../../environments/environment';

/**
 * Activa/desactiva Push **solo en este dispositivo**.
 * Las preferencias `notificationFeedModules` (qué módulos) viven aparte
 * y se reutilizan al enviar (etapas posteriores).
 */
@Injectable({ providedIn: 'root' })
export class WebPushDeviceService {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(PushSubscriptionsApiService);
  private readonly router = inject(Router);
  private clickNavBound = false;

  /** true si este navegador tiene suscripción Push activa registrada. */
  readonly enabledOnThisDevice = signal(false);
  readonly busy = signal(false);
  readonly unsupportedReason = signal<string | null>(null);

  readonly isSupported = (): boolean =>
    typeof window !== 'undefined' &&
    'Notification' in window &&
    this.swPush.isEnabled;

  /**
   * Escucha clicks de notificaciones Push (PWA / SW activo).
   * Idempotente; seguro llamar desde el shell.
   */
  bindNotificationClicks(): void {
    if (this.clickNavBound || !environment.production || !this.swPush.isEnabled) {
      return;
    }
    this.clickNavBound = true;
    this.swPush.notificationClicks.subscribe((event) => {
      const data = (event.notification?.data ?? {}) as Record<string, unknown>;
      const rawUrl =
        (typeof data['url'] === 'string' && data['url']) ||
        (typeof (data['onActionClick'] as { default?: { url?: string } } | undefined)
          ?.default?.url === 'string'
          ? (data['onActionClick'] as { default: { url: string } }).default.url
          : '');
      if (!rawUrl) {
        return;
      }
      try {
        const parsed = new URL(rawUrl, window.location.origin);
        void this.router.navigateByUrl(`${parsed.pathname}${parsed.search}${parsed.hash}`);
      } catch {
        void this.router.navigateByUrl(rawUrl);
      }
    });
  }

  refreshLocalState(): Observable<boolean> {
    if (!this.isSupported()) {
      this.enabledOnThisDevice.set(false);
      this.unsupportedReason.set(this.describeUnsupported());
      return of(false);
    }
    this.unsupportedReason.set(null);
    return this.swPush.subscription.pipe(
      map((sub) => {
        const on = Boolean(sub?.endpoint);
        this.enabledOnThisDevice.set(on);
        return on;
      }),
      catchError(() => {
        this.enabledOnThisDevice.set(false);
        return of(false);
      }),
    );
  }

  enableOnThisDevice(): Observable<void> {
    if (!this.isSupported()) {
      return throwError(() => new Error(this.describeUnsupported()));
    }
    this.busy.set(true);
    return this.api.getVapidPublicKey().pipe(
      switchMap(({ publicKey }) =>
        from(
          this.swPush.requestSubscription({
            serverPublicKey: publicKey,
          }),
        ),
      ),
      switchMap((sub) => {
        const json = sub.toJSON();
        const endpoint = json.endpoint?.trim() ?? '';
        const p256dh = json.keys?.['p256dh']?.trim() ?? '';
        const auth = json.keys?.['auth']?.trim() ?? '';
        if (!endpoint || !p256dh || !auth) {
          return throwError(() => new Error('El navegador no devolvió una suscripción válida.'));
        }
        return this.api
          .upsert({
            endpoint,
            keys: { p256dh, auth },
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          })
          .pipe(map(() => undefined));
      }),
      tap(() => {
        this.enabledOnThisDevice.set(true);
        this.busy.set(false);
      }),
      catchError((err: unknown) => {
        this.busy.set(false);
        this.enabledOnThisDevice.set(false);
        return throwError(() => err);
      }),
    );
  }

  /** Quita solo la suscripción de este dispositivo; no toca otros. */
  disableOnThisDevice(): Observable<void> {
    if (!this.isSupported()) {
      return throwError(() => new Error(this.describeUnsupported()));
    }
    this.busy.set(true);
    return this.swPush.subscription.pipe(
      switchMap((sub) => {
        const endpoint = sub?.endpoint?.trim() ?? '';
        const unsubscribeLocal = async () => {
          if (sub) {
            await sub.unsubscribe();
          }
        };
        if (!endpoint) {
          return from(unsubscribeLocal()).pipe(
            tap(() => {
              this.enabledOnThisDevice.set(false);
              this.busy.set(false);
            }),
            map(() => undefined),
          );
        }
        return this.api.remove(endpoint).pipe(
          switchMap(() => from(unsubscribeLocal())),
          tap(() => {
            this.enabledOnThisDevice.set(false);
            this.busy.set(false);
          }),
          map(() => undefined),
        );
      }),
      catchError((err: unknown) => {
        this.busy.set(false);
        return throwError(() => err);
      }),
    );
  }

  async toggle(): Promise<'enabled' | 'disabled'> {
    const currentlyOn = await firstValueFrom(this.refreshLocalState());
    if (currentlyOn) {
      await firstValueFrom(this.disableOnThisDevice());
      return 'disabled';
    }
    await firstValueFrom(this.enableOnThisDevice());
    return 'enabled';
  }

  private describeUnsupported(): string {
    if (typeof window === 'undefined') {
      return 'No disponible en este entorno.';
    }
    if (!('Notification' in window)) {
      return 'Este navegador no soporta notificaciones.';
    }
    if (!this.swPush.isEnabled) {
      return 'Disponible en la app instalada (PWA) o en el build de producción con Service Worker.';
    }
    return 'Notificaciones push no disponibles en este dispositivo.';
  }
}
