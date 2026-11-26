import type { Unit } from '@shared/models/logistics.models';
import { buildUnitWritePayload } from './unit-api-payload';

function baseUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: '1',
    plate: 'ABC-123',
    capacityKg: 20000,
    status: 'maintenance',
    isActive: true,
    ...overrides,
  } as Unit;
}

describe('unit-api-payload (A6)', () => {
  it('never sends operational status in write payload', () => {
    const payload = buildUnitWritePayload(baseUnit(), {
      unit: { status: 'available' },
    });
    expect('status' in (payload as object)).toBe(false);
  });

  it('includes isActive for user-controlled visibility', () => {
    const payload = buildUnitWritePayload(baseUnit({ isActive: false }));
    expect(payload.isActive).toBe(false);
  });

  it('includes the transport type in write payloads', () => {
    const payload = buildUnitWritePayload(
      baseUnit({ transportType: 'tractocamion' }),
    );
    expect(payload.transportType).toBe('tractocamion');
  });

  it('sends sparse fleetMeta without merging base meta', () => {
    const payload = buildUnitWritePayload(
      baseUnit({
        fleetMeta: {
          gpsLastPaymentDate: '2026-06-01',
          insuranceCost: 7500,
          trailerTenureMode: 'financed',
        },
      }),
      {
        sparseFleetMeta: true,
        fleetMeta: { insuranceLastPaymentDate: '2026-07-01' },
      },
    );
    expect(payload.fleetMeta?.insuranceLastPaymentDate).toBe('2026-07-01');
    expect(payload.fleetMeta?.gpsLastPaymentDate).toBeUndefined();
    expect(payload.fleetMeta?.insuranceCost).toBeUndefined();
    expect(payload.fleetMeta?.trailerTenureMode).toBeUndefined();
  });

  it('omits fleetMeta on sparse column-only patch', () => {
    const payload = buildUnitWritePayload(
      baseUnit({
        fleetMeta: { insuranceCost: 7500 },
      }),
      {
        sparseFleetMeta: true,
        unit: { capacityTons: 22 },
      },
    );
    expect(payload.capacityTons).toBe(22);
    expect(payload.fleetMeta).toBeUndefined();
  });

  it('strips fleetDocuments on write', () => {
    const payload = buildUnitWritePayload(
      baseUnit({
        fleetMeta: {
          insuranceCost: 7500,
          fleetDocuments: [
            { id: 1, fileName: 'a.pdf', documentKind: 'policy' },
          ],
        },
      }),
    );
    expect(payload.fleetMeta?.insuranceCost).toBe(7500);
    expect(payload.fleetMeta?.fleetDocuments).toBeUndefined();
  });

  it('keeps maintenanceEntries when draft fleetMeta is partial', () => {
    const payload = buildUnitWritePayload(
      baseUnit({
        fleetMeta: {
          maintenanceEntries: [
            {
              date: '2026-06-01',
              type: 'Aceite',
              status: 'concluido',
              cost: 1500,
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
