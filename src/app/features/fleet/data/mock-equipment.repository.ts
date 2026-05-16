import { Injectable, inject } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { SimulatedDbService } from '@app/sim-db/simulated-db.service';
import { buildEquipmentFleetMockId } from '@app/sim-db/utils/fleet-id-builders';
import { Equipment } from '@shared/models/logistics.models';
import { CreateEquipmentPayload, EquipmentRepository } from './equipment.repository';

@Injectable()
export class MockEquipmentRepository extends EquipmentRepository {
  private readonly db = inject(SimulatedDbService);

  override list(): Observable<Equipment[]> {
    return of(this.db.listEquipment()).pipe(delay(240));
  }

  override create(payload: CreateEquipmentPayload): Observable<Equipment> {
    const row: Equipment = {
      id: buildEquipmentFleetMockId(this.db.listEquipment(), this.db.listUnits(), {
        trailerBrandAbbr: payload.trailerBrandAbbr,
        trailerYear: payload.trailerYear,
        plate: payload.plate,
        serialNumber: payload.serialNumber,
      }),
      unitId: (payload.unitId ?? '').trim(),
      name: payload.name.trim(),
      serialNumber: payload.serialNumber.trim(),
      lastServiceDate: payload.lastServiceDate.trim(),
      plate: payload.plate?.trim() || undefined,
      type: payload.type?.trim() || undefined,
      status: payload.status?.trim() || undefined,
      trailerBrandAbbr: payload.trailerBrandAbbr?.trim() || undefined,
      trailerYear: payload.trailerYear?.trim() || undefined,
      fleetMeta: payload.fleetMeta,
    };
    this.db.addEquipment(row);
    return of(row).pipe(delay(220));
  }
}
