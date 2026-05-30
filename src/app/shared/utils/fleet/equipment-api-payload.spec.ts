import type { Equipment } from '@shared/models/logistics.models';
import {
  buildEquipmentWritePayload,
  unitIdForEquipmentPayload,
} from './equipment-api-payload';

function baseEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: '2',
    unitId: '1',
    name: 'TwoTone',
    serialNumber: 'CHS-34-5',
    plate: '12-AB-1T',
    type: 'caja',
    status: 'available',
    lastServiceDate: '2026-05-27',
    ...overrides,
  } as Equipment;
}

describe('equipment-api-payload', () => {
  it('maps empty unitId to null for unhitch', () => {
    expect(unitIdForEquipmentPayload('')).toBeNull();
    expect(unitIdForEquipmentPayload(undefined)).toBeNull();
    expect(unitIdForEquipmentPayload('  ')).toBeNull();
    expect(unitIdForEquipmentPayload('3')).toBe('3');
  });

  it('includes unitId null in PATCH payload when desenganchando', () => {
    const payload = buildEquipmentWritePayload(baseEquipment(), {
      equipment: { unitId: '', hitchPosition: null },
    });
    expect(payload.unitId).toBeNull();
    expect(payload.hitchPosition).toBeNull();
  });

  it('keeps assigned unitId when still enganchado', () => {
    const payload = buildEquipmentWritePayload(baseEquipment(), {
      equipment: { hitchPosition: 'rear' },
    });
    expect(payload.unitId).toBe('1');
    expect(payload.hitchPosition).toBe('rear');
  });
});
