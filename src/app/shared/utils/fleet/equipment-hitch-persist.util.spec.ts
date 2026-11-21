import { mergeEquipmentForUnitHitchContext } from '@features/fleet/utils/unit-hitched-equipment';
import { hitchPositionForNewEquipmentOnUnit } from './equipment-hitch-assignment';
import { buildEquipmentHitchPersistPlan } from './equipment-hitch-persist.util';
import type { Equipment } from '@shared/models/logistics.models';

function eq(partial: Partial<Equipment> & Pick<Equipment, 'id'>): Equipment {
  return {
    plate: '12-AB-3C',
    status: 'available',
    type: 'caja_seca',
    serialNumber: 'SN1',
    name: 'R1',
    unitId: '',
    ...partial,
  } as Equipment;
}

describe('buildEquipmentHitchPersistPlan', () => {
  it('forces rear for third chassis when lead and dolly are on unit', () => {
    const unitId = 'U1';
    const catalog = [
      eq({ id: 'lead-1', unitId, hitchPosition: 'lead' }),
      eq({ id: 'dolly-1', unitId, type: 'dolly', hitchPosition: 'rear' }),
    ];
    const third = eq({ id: 'rear-3', unitId: '' });
    const plan = buildEquipmentHitchPersistPlan({ equipment: third, unitId, catalog });
    expect(plan?.appHitch).toBe('rear');
    expect(plan?.hitchDraft.equipment?.hitchPosition).toBe('rear');
  });

  it('uses merged unit detail when catalog list lacks dolly', () => {
    const unitId = 'U1';
    const catalog = [eq({ id: 'lead-1', unitId, hitchPosition: 'lead' })];
    const embedded = [eq({ id: 'dolly-1', unitId, type: 'dolly', hitchPosition: 'rear' })];
    const merged = mergeEquipmentForUnitHitchContext(catalog, unitId, embedded);
    const third = eq({ id: 'rear-3', unitId: '' });
    expect(hitchPositionForNewEquipmentOnUnit(merged, unitId, third.id, third.type)).toBe(
      'rear',
    );
    const plan = buildEquipmentHitchPersistPlan({ equipment: third, unitId, catalog: merged });
    expect(plan?.appHitch).toBe('rear');
  });
});