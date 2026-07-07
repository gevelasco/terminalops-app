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

  it('never sends operational status in write payload (A6)', () => {
    const payload = buildEquipmentWritePayload(baseEquipment(), {
      equipment: { status: 'available' },
    });
    expect('status' in (payload as object)).toBe(false);
  });

  it('keeps maintenanceEntries when draft fleetMeta is partial', () => {
    const payload = buildEquipmentWritePayload(
      baseEquipment({
        fleetMeta: {
          maintenanceEntries: [
            {
              date: '2026-06-01',
              type: 'Frenos',
              status: 'concluido',
              cost: 3200,
            },
          ],
        },
      }),
      { fleetMeta: { lastMaintenanceDate: '2026-06-01' } },
    );
    expect(payload.fleetMeta?.maintenanceEntries?.length).toBe(1);
    expect(payload.fleetMeta?.lastMaintenanceDate).toBe('2026-06-01');
  });
});
