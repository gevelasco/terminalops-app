import { Injectable, inject } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { SimulatedDbService } from '@app/sim-db/simulated-db.service';
import {
  buildUnitFleetMockId,
  ensureUniqueFleetId,
} from '@app/sim-db/utils/fleet-id-builders';
import { Unit } from '@shared/models/logistics.models';
import { CreateUnitPayload, UnitRepository } from './unit.repository';

@Injectable()
export class MockUnitRepository extends UnitRepository {
  private readonly db = inject(SimulatedDbService);

  override list(): Observable<Unit[]> {
    return of(this.db.listUnits()).pipe(delay(240));
  }

  override create(payload: CreateUnitPayload): Observable<Unit> {
    const base = buildUnitFleetMockId({
      trailerBrandAbbr: payload.trailerBrandAbbr,
      trailerYear: payload.trailerYear,
      plate: payload.plate,
    });
    const existing = new Set(this.db.listUnits().map((u) => u.id));
    const id = ensureUniqueFleetId(base, existing);
    const unit: Unit = {
      id,
      plate: payload.plate.trim(),
      type: payload.type.trim(),
      capacityKg: payload.capacityKg,
      status: payload.status.trim(),
      trailerBrandAbbr: payload.trailerBrandAbbr?.trim() || undefined,
      trailerYear: payload.trailerYear?.trim() || undefined,
      serialNumber: payload.serialNumber?.trim() || undefined,
      name: payload.name?.trim() || undefined,
      fleetMeta: payload.fleetMeta,
    };
    this.db.addUnit(unit);
    return of(unit).pipe(delay(220));
  }
}
