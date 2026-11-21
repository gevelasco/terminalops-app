import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { Trip } from '@shared/models/logistics.models';

export function isOperationalTripStatus(status: Trip['status']): boolean {
  return status === 'scheduled' || status === 'in_transit';
}

/**
 * Estado compartido de maniobras activas mutadas en esta sesión + épocas de
 * refresco para flota/operadores. No hace HTTP: cada módulo pide su propia
 * vista (lista paginada, mapa, overview, operadores).
 */
@Injectable({ providedIn: 'root' })
export class OperationalFleetSyncService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly _trips = signal<readonly Trip[]>([]);
  private readonly _tripsEpoch = signal(0);
  private readonly _fleetMutationEpoch = signal(0);
  private readonly _operatorsMutationEpoch = signal(0);

  constructor() {
    this.destroyRef.onDestroy(() => this.resetState());
  }

  readonly trips = this._trips.asReadonly();
  /** Incrementa cuando cambia la lista en memoria (p. ej. crear/cancelar maniobra). */
  readonly tripsEpoch = this._tripsEpoch.asReadonly();
  readonly fleetMutationEpoch = this._fleetMutationEpoch.asReadonly();
  readonly operatorsMutationEpoch = this._operatorsMutationEpoch.asReadonly();

  /** Tras crear/cancelar/reasignar maniobra o cambios que muevan estatus de flota. */
  notifyTripFleetMutation(): void {
    this._fleetMutationEpoch.update((n) => n + 1);
    this._operatorsMutationEpoch.update((n) => n + 1);
  }

  /**
   * Actualiza la lista en memoria sin notificar flota/operadores.
   * Usar cuando el caller ya refrescó viajes pero no cambió asignación operativa.
   */
  replaceTrips(trips: readonly Trip[]): void {
    this._trips.set(trips);
    this._tripsEpoch.update((n) => n + 1);
  }

  /**
   * Sincroniza la copia en memoria y notifica flota/operadores sin HTTP.
   * Usar cuando el caller ya obtuvo la lista actualizada (p. ej. TripsFeatureService).
   */
  publishTripsAfterMutation(trips: readonly Trip[]): void {
    this.replaceTrips(trips);
    this._fleetMutationEpoch.update((n) => n + 1);
    this._operatorsMutationEpoch.update((n) => n + 1);
  }

  /** Limpia estado en memoria al cerrar sesión (multi-tenant). */
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

  /** Tras alta, baja o cambios de catálogo que afecten listados de operadores. */
  notifyOperatorsModuleMutation(): void {
    this._operatorsMutationEpoch.update((n) => n + 1);
  }

  private resetState(): void {
    this._trips.set([]);
    this._tripsEpoch.set(0);
    this._fleetMutationEpoch.set(0);
    this._operatorsMutationEpoch.set(0);
  }
}
