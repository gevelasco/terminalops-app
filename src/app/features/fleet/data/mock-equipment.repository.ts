import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { MOCK_EQUIPMENT } from '@app/mock-data/mock-equipment';
import { Equipment } from '@shared/models/logistics.models';
import { CreateEquipmentPayload, EquipmentRepository } from './equipment.repository';

function nextEquipmentId(list: readonly Equipment[]): string {
  let max = 0;
  for (const e of list) {
    const m = /^e(\d+)$/.exec(e.id);
    if (m) {
      max = Math.max(max, Number(m[1]));
    }
  }
  return `e${max + 1}`;
}

@Injectable()
export class MockEquipmentRepository extends EquipmentRepository {
  override list(): Observable<Equipment[]> {
    return of([...MOCK_EQUIPMENT]).pipe(delay(240));
  }

  override create(payload: CreateEquipmentPayload): Observable<Equipment> {
    const row: Equipment = {
      id: nextEquipmentId(MOCK_EQUIPMENT),
      unitId: payload.unitId.trim(),
      name: payload.name.trim(),
      serialNumber: payload.serialNumber.trim(),
      lastServiceDate: payload.lastServiceDate.trim(),
      axleConfiguration: payload.axleConfiguration?.trim() || undefined,
    };
    MOCK_EQUIPMENT.push(row);
    return of(row).pipe(delay(220));
  }
}
