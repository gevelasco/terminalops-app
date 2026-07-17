import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { TripsService as TripsApiService } from '@services/api/trips';
import type { Trip } from '@shared/models/logistics.models';
import { createRequestGeneration } from '@shared/utils/request-generation';

/** Estatus que mantienen una maniobra en la caché operativa compartida. */
export const OPERATIONAL_TRIP_STATUSES = 'scheduled,in_transit';

export function isOperationalTripStatus(status: Trip['status']): boolean {
  return status === 'scheduled' || status === 'in_transit';
}

/**
 * Caché compartida de maniobras ACTIVAS (programadas + en curso) + señales de
 * refresco para flota/operadores. El histórico (completadas/canceladas) se
 * consulta paginado por cada vista; aquí solo vive lo operativo.
 * Las mutaciones de maniobra que afectan asignación o estatus operativo deben
 * llamar `notifyTripFleetMutation()`.
 */
@Injectable({ providedIn: 'root' })
export class OperationalFleetSyncService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly tripsApi = inject(TripsApiService);
  private readonly requestGen = createRequestGeneration();

  private readonly _trips = signal<readonly Trip[]>([]);
  private readonly _tripsLoading = signal(false);
  private readonly _tripsEpoch = signal(0);
  private readonly _fleetMutationEpoch = signal(0);
  private readonly _operatorsMutationEpoch = signal(0);

  private loadStarted = false;
  private fetchSub: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.resetState());
  }

  readonly trips = this._trips.asReadonly();
  readonly tripsLoading = this._tripsLoading.asReadonly();
  /** Incrementa cuando cambia la lista en memoria (p. ej. tab lista de maniobras). */
  readonly tripsEpoch = this._tripsEpoch.asReadonly();
  readonly fleetMutationEpoch = this._fleetMutationEpoch.asReadonly();
  readonly operatorsMutationEpoch = this._operatorsMutationEpoch.asReadonly();

  ensureTripsLoaded(): void {
    if (this.loadStarted) {
      return;
    }
    this.loadStarted = true;
    this.runFetch();
  }

  refreshTrips(): void {
    this.runFetch();
  }

  /** Tras crear/cancelar/reasignar maniobra o cambios que muevan estatus de flota. */
  notifyTripFleetMutation(): void {
    this._fleetMutationEpoch.update((n) => n + 1);
    this._operatorsMutationEpoch.update((n) => n + 1);
    this.refreshTrips();
  }

  /**
   * Actualiza la lista en memoria sin notificar flota/operadores.
   * Usar cuando el caller ya refrescó viajes pero no cambió asignación operativa.
   */
  replaceTrips(trips: readonly Trip[]): void {
    this._trips.set(trips);
    this.loadStarted = true;
    this._tripsEpoch.update((n) => n + 1);
  }

  /**
   * Sincroniza la caché compartida y notifica flota/operadores sin HTTP adicional.
   * Usar cuando el caller ya obtuvo la lista actualizada (p. ej. TripsFeatureService).
   */
  publishTripsAfterMutation(trips: readonly Trip[]): void {
    this.replaceTrips(trips);
    this._fleetMutationEpoch.update((n) => n + 1);
    this._operatorsMutationEpoch.update((n) => n + 1);
  }

  /** Limpia caché en memoria al cerrar sesión (multi-tenant). */
  clearOnLogout(): void {
    this.resetState();
  }

  /** Tras mutaciones de gastos que afectan meta de flota (verificación, seguro, GPS). */
  notifyFleetModuleMutation(): void {
    this._fleetMutationEpoch.update((n) => n + 1);
  }

  /** Tras crear/actualizar/eliminar gastos de pago al operador. */
  notifyOperatorPaymentsMutation(): void {
    this._operatorsMutationEpoch.update((n) => n + 1);
  }

  private runFetch(): void {
    const requestId = this.requestGen.next();
    this.fetchSub?.unsubscribe();
    this._tripsLoading.set(true);
    this.fetchSub = this.tripsApi
      .getAllTrips({ status: OPERATIONAL_TRIP_STATUSES })
      .pipe(
        catchError(() => of([] as Trip[])),
        finalize(() => {
          if (this.requestGen.isCurrent(requestId)) {
            this._tripsLoading.set(false);
          }
        }),
      )
      .subscribe((list) => {
        if (!this.requestGen.isCurrent(requestId)) {
          return;
        }
        this._trips.set(list);
        this._tripsEpoch.update((n) => n + 1);
      });
  }

  private resetState(): void {
    this.requestGen.invalidate();
    this.fetchSub?.unsubscribe();
    this.fetchSub = null;
    this._trips.set([]);
    this._tripsLoading.set(false);
    this.loadStarted = false;
    this._tripsEpoch.set(0);
    this._fleetMutationEpoch.set(0);
    this._operatorsMutationEpoch.set(0);
  }
}
