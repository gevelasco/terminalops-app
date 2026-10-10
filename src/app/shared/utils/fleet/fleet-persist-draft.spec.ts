import type { Equipment, Unit } from '@shared/models/logistics.models';
import {
  resolveEquipmentPersistDraft,
  resolveUnitPersistDraft,
} from './fleet-persist-draft';

describe('fleet-persist-draft', () => {
  it('marks section fleetMeta drafts as sparse', () => {
    const draft = resolveUnitPersistDraft(
      { fleetMeta: { insuranceCost: 100 } },
      { id: '1', plate: 'X' } as Unit,
      false,
    );
    expect(draft?.sparseFleetMeta).toBe(true);
    expect(draft?.fleetMeta?.insuranceCost).toBe(100);
  });

  it('includes only maintenanceEntries when local maint is pending', () => {
    const unit = {
      id: '1',
      plate: 'X',
      fleetMeta: {
        insuranceCost: 100,
        maintenanceEntries: [{ date: '2026-01-01', type: 'Aceite', status: 'concluido', cost: 1 }],
      },
    } as Unit;
    const draft = resolveUnitPersistDraft(
      { fleetMeta: { maintenanceKmCounter: 0 } },
      unit,
      true,
    );
    expect(draft?.sparseFleetMeta).toBe(true);
    expect(draft?.fleetMeta?.maintenanceKmCounter).toBe(0);
    expect(draft?.fleetMeta?.maintenanceEntries?.length).toBe(1);
    expect(draft?.fleetMeta?.insuranceCost).toBeUndefined();
  });

  it('marks equipment hitch drafts as sparse without meta', () => {
    const draft = resolveEquipmentPersistDraft(
      { equipment: { unitId: '2' } },
      { id: 'eq-1', serialNumber: 'SN', name: 'T' } as Equipment,
      false,
    );
    expect(draft?.sparseFleetMeta).toBe(true);
    expect(draft?.fleetMeta).toBeUndefined();
  });
});
