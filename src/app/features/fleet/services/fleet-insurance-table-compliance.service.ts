import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { catchError, finalize, of, Subscription, type Observable } from 'rxjs';
import { FleetApiService } from '@services/api/fleet';
import type { FleetInsuranceTableComplianceResponseDto } from '@shared/models/api/fleet-insurance-table-compliance.model';
import { coalesceInFlightRequest } from '@shared/utils/coalesce-in-flight-request';
import { createRequestGeneration } from '@shared/utils/request-generation';

const EMPTY: FleetInsuranceTableComplianceResponseDto = { units: {}, equipment: {} };

/**
 * Iconos de seguro en tablas/overview: GET slim por activo (no ledger completo en cliente).
 */
@Injectable()
export class FleetInsuranceTableComplianceFeatureService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fleetApi = inject(FleetApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _data = signal<FleetInsuranceTableComplianceResponseDto>(EMPTY);
  private readonly _loading = signal(false);
  private readonly _hydrated = signal(false);

  private initialLoadStarted = false;
  private disposed = false;
  private fetchSub: Subscription | null = null;
  private readonly fetchInFlight: {
    current: Observable<FleetInsuranceTableComplianceResponseDto> | null;
  } = { current: null };

  constructor() {
    this.destroyRef.onDestroy(() => this.dispose());
  }

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly hydrated = this._hydrated.asReadonly();

  hasLoadedOnce(): boolean {
    return this.initialLoadStarted;
  }

  load(): void {
    if (this.disposed || this.initialLoadStarted) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  refresh(): void {
    if (this.disposed) {
      return;
    }
    this.initialLoadStarted = true;
    this.runFetch();
  }

  unitCompliance(unitId: string) {
    const id = unitId.trim();
    return id ? this._data().units[id] : undefined;
  }

  equipmentCompliance(equipmentId: string) {
    const id = equipmentId.trim();
    return id ? this._data().equipment[id] : undefined;
  }

  private runFetch(): void {
    if (this.disposed) {
      return;
    }
    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    this._loading.set(true);
    this.fetchSub = this.fetchCompliance()
      .pipe(
        finalize(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._loading.set(false);
            this._hydrated.set(true);
          }
        }),
      )
      .subscribe({
        next: (payload) => {
          if (!this.canApply(requestId)) {
            return;
          }
          this._data.set({
            units: payload.units ?? {},
            equipment: payload.equipment ?? {},
          });
        },
        error: () => {
          if (!this.canApply(requestId)) {
            return;
          }
          this._data.set(EMPTY);
        },
      });
  }

  private fetchCompliance(): Observable<FleetInsuranceTableComplianceResponseDto> {
    return coalesceInFlightRequest(this.fetchInFlight, () =>
      this.fleetApi.getInsuranceTableCompliance().pipe(catchError(() => of(EMPTY))),
    );
  }

  private canApply(requestId: number): boolean {
    return !this.disposed && this.requestGen.isCurrent(requestId);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.requestGen.invalidate();
    this.fetchInFlight.current = null;
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._data.set(EMPTY);
    this._loading.set(false);
    this._hydrated.set(false);
    this.initialLoadStarted = false;
  }
}
