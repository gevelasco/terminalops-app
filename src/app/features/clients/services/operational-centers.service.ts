import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { OperationalCentersService as OperationalCentersApi } from '@core/services/api/operational-centers';
import { SessionService } from '@core/services/state/session';
import type { DashboardDieselSnapshot } from '@shared/models/api/api-dashboard-summary.model';
import type { OperationalCenter } from '@shared/models/operational-center.models';
import { createRequestGeneration } from '@shared/utils/request-generation';
import { finalize, tap, type Subscription } from 'rxjs';

/**
 * Catálogo de centros operativos en memoria (signals).
 * Hoy solo hay un centro por empresa: se hidrata desde la sesión (login)
 * sin GET. El fetch a /operational-centers queda como fallback (p. ej. sin id
 * en sesión antigua) o para refresh explícito / precio diésel.
 */
@Injectable()
export class OperationalCentersFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(OperationalCentersApi);
  private readonly session = inject(SessionService);
  private readonly requestGen = createRequestGeneration();

  private readonly _centers = signal<readonly OperationalCenter[]>([]);
  private readonly _dieselReferencePrice = signal<DashboardDieselSnapshot | null>(
    null,
  );
  private readonly _loading = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;

  readonly centers = this._centers.asReadonly();
  readonly dieselReferencePrice = this._dieselReferencePrice.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly defaultCenter = computed(() => {
    const list = this._centers();
    return list.find((c) => c.isDefault) ?? list[0] ?? null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  /**
   * Prefiere el centro de la sesión (sin red). Solo hace GET si no hay id en sesión.
   */
  ensureLoaded(): void {
    if (this.disposed || this.initialLoadStarted) {
      return;
    }
    if (this.hydrateFromSession()) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  /** @deprecated Preferir `ensureLoaded()` — mantiene compatibilidad con callers existentes. */
  loadOperationalCenters(): void {
    this.ensureLoaded();
  }

  refreshOperationalCenters(): void {
    if (this.disposed) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  centerById(id: string): OperationalCenter | null {
    const key = id.trim();
    if (!key) {
      return null;
    }
    return this._centers().find((c) => c.id === key) ?? null;
  }

  dispose(): void {
    this.disposed = true;
    this.initialLoadStarted = false;
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._centers.set([]);
    this._dieselReferencePrice.set(null);
    this._loading.set(false);
    this.requestGen.invalidate();
  }

  /** Construye el único centro desde claims de login; true si pudo hidratar. */
  private hydrateFromSession(): boolean {
    const id = this.session.operationalCenterId()?.trim();
    if (!id) {
      return false;
    }
    const companyId = this.session.companyId()?.trim() ?? '';
    const postal = this.session.operationalCenterPostalCode()?.trim();
    const city = this.session.operationalCenterCityMunicipality()?.trim();
    const locality = this.session.operationalCenterLocality()?.trim();
    const settlementConsId = this.session.operationalCenterSettlementConsId()?.trim();
    const lat = this.session.operationalCenterLatitude();
    const lon = this.session.operationalCenterLongitude();

    this._centers.set([
      {
        id,
        companyId,
        name: this.session.operationalCenterName()?.trim() || 'Centro Principal',
        code: 'primary',
        ...(postal ? { postalCode: postal } : {}),
        ...(city ? { cityMunicipality: city } : {}),
        ...(locality ? { locality } : {}),
        ...(settlementConsId ? { settlementConsId } : {}),
        ...(lat != null && Number.isFinite(lat) ? { latitude: lat } : {}),
        ...(lon != null && Number.isFinite(lon) ? { longitude: lon } : {}),
        isDefault: true,
      },
    ]);
    this.initialLoadStarted = true;
    this._loading.set(false);
    return true;
  }

  private runFetch(): void {
    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    this._loading.set(true);
    this.fetchSub = this.api
      .getOperationalCentersList()
      .pipe(
        tap((res) => {
          if (this.requestGen.isCurrent(requestId)) {
            this._centers.set(res.centers);
            this._dieselReferencePrice.set(res.dieselReferencePrice);
          }
        }),
        finalize(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._loading.set(false);
          }
        }),
      )
      .subscribe({
        error: () => {
          if (this.requestGen.isCurrent(requestId)) {
            this._centers.set([]);
            this._dieselReferencePrice.set(null);
          }
        },
      });
  }
}
