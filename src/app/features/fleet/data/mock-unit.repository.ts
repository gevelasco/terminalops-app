import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { MOCK_UNITS } from '@app/mock-data/mock-units';
import { Unit } from '@shared/models/logistics.models';
import { CreateUnitPayload, UnitRepository } from './unit.repository';

function nextTrkId(units: readonly Unit[]): string {
  let max = 0;
  for (const u of units) {
    const m = /^TRK-(\d+)$/.exec(u.id);
    if (m) {
      max = Math.max(max, Number(m[1]));
    }
  }
  return `TRK-${max + 1}`;
}

@Injectable()
export class MockUnitRepository extends UnitRepository {
  override list(): Observable<Unit[]> {
    return of([...MOCK_UNITS]).pipe(delay(240));
  }

  override create(payload: CreateUnitPayload): Observable<Unit> {
    const unit: Unit = {
      id: nextTrkId(MOCK_UNITS),
      plate: payload.plate.trim(),
      type: payload.type.trim(),
      capacityKg: payload.capacityKg,
      status: payload.status.trim(),
      trailerBrandAbbr: payload.trailerBrandAbbr?.trim() || undefined,
      trailerYear: payload.trailerYear?.trim() || undefined,
      fleetMeta: payload.fleetMeta,
    };
    MOCK_UNITS.push(unit);
    return of(unit).pipe(delay(220));
  }
}
