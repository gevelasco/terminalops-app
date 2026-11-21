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

  it('omits hitchPosition for dolly when convoy has lead and rear trailers', () => {
    const payload = buildEquipmentWritePayload(
      {
        id: 'dolly',
        unitId: 'U1',
        name: 'D',
        serialNumber: 'S',
        lastServiceDate: '',
        hitchPosition: 'middle',
        type: 'dolly',
      },
      {
        equipment: { hitchPosition: 'middle' },
        hitchPeersOnUnit: [
          {
            id: 'lead',
            unitId: 'U1',
            hitchPosition: 'lead',
            type: 'portacontenedor',
            name: 'L',
            serialNumber: 'L',
            lastServiceDate: '',
          },
          {
            id: 'rear',
            unitId: 'U1',
            hitchPosition: 'rear',
            type: 'portacontenedor',
            name: 'R',
            serialNumber: 'R',
            lastServiceDate: '',
          },
        ],
      },
    );
    expect(payload.hitchPosition).toBeUndefined();
  });

  it('maps dolly middle to api rear when tractor has lead only', () => {
    const payload = buildEquipmentWritePayload(
      {
        id: 'dolly',
        unitId: 'U1',
        name: 'D',
        serialNumber: 'S',
        lastServiceDate: '',
        hitchPosition: 'middle',
        type: 'dolly',
      },
      {
        equipment: { hitchPosition: 'middle' },
        hitchPeersOnUnit: [
          {
            id: 'lead',
            unitId: 'U1',
            hitchPosition: 'lead',
            type: 'portacontenedor',
            name: 'L',
            serialNumber: 'L',
            lastServiceDate: '',
          },
        ],
      },
    );
    expect(payload.hitchPosition).toBe('rear');
  });

  it('never sends operational status in write payload (A6)', () => {
    const payload = buildEquipmentWritePayload(baseEquipment(), {
      equipment: { status: 'available' },
    });
    expect('status' in (payload as object)).toBe(false);
  });

  it('sends sparse fleetMeta without merging base meta', () => {
    const payload = buildEquipmentWritePayload(
      baseEquipment({
        fleetMeta: {
          insuranceCost: 4000,
          trailerTenureMode: 'leased',
        },
      }),
      {
        sparseFleetMeta: true,
        fleetMeta: { insurancePolicyNumber: 'POL-1' },
      },
    );
    expect(payload.fleetMeta?.insurancePolicyNumber).toBe('POL-1');
    expect(payload.fleetMeta?.insuranceCost).toBeUndefined();
    expect(payload.fleetMeta?.trailerTenureMode).toBeUndefined();
  });

  it('applies equipment patch when sparse without fleetMeta', () => {
    const payload = buildEquipmentWritePayload(baseEquipment(), {
      sparseFleetMeta: true,
      equipment: { unitId: '', hitchPosition: null },
    });
    expect(payload.unitId).toBeNull();
    expect(payload.hitchPosition).toBeNull();
    expect(payload.fleetMeta).toBeUndefined();
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
