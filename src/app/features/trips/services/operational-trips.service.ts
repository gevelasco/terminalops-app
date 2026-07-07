import { Injectable, inject } from '@angular/core';
import { OperationalFleetSyncService } from '@core/services/state/operational-fleet-sync.service';

/**
 * Alias del drawer de operador sobre la caché compartida de maniobras.
 */
@Injectable()
export class OperationalTripsFeatureService {
  private readonly sync = inject(OperationalFleetSyncService);

  readonly trips = this.sync.trips;
  readonly loading = this.sync.tripsLoading;

  loadTrips(): void {
    this.sync.ensureTripsLoaded();
  }

  refreshTrips(): void {
    this.sync.refreshTrips();
  }

  dispose(): void {
    // La caché vive en root; el drawer no la destruye.
  }
}
