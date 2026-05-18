import { Equipment } from '@shared/models/logistics.models';
import {
  equipmentAssignedToUnit,
  equipmentTypeDisplayLabel,
  newEquipmentHitchHint,
  unitConvoyFromEquipment,
} from './unit-hitched-equipment';

function eq(partial: Partial<Equipment> & Pick<Equipment, 'id' | 'unitId'>): Equipment {
  return {
    plate: 'XX',
    status: 'available',
    type: 'caja_seca',
    ...partial,
  } as Equipment;
}

describe('unit-hitched-equipment', () => {
  it('filters and sorts by unit', () => {
    const list = [
      eq({ id: 'b', unitId: 'U1' }),
      eq({ id: 'a', unitId: 'U1' }),
      eq({ id: 'c', unitId: 'U2' }),
    ];
    expect(equipmentAssignedToUnit(list, 'U1').map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('derives convoy labels', () => {
    expect(unitConvoyFromEquipment([]).kind).toBe('none');
    expect(unitConvoyFromEquipment([eq({ id: '1', unitId: 'U', type: 'caja_seca' })]).kind).toBe(
      'sencillo',
    );
    expect(
      unitConvoyFromEquipment([
        eq({ id: '1', unitId: 'U', type: 'plataforma' }),
        eq({ id: '2', unitId: 'U', type: 'caja_seca' }),
      ]).kind,
    ).toBe('full');
  });

  it('maps equipment type label', () => {
    expect(equipmentTypeDisplayLabel(eq({ id: '1', unitId: 'U', type: 'refrigerado' }))).toContain(
      'Refrigerado',
    );
  });

  it('builds hitch hints', () => {
    expect(newEquipmentHitchHint(0, 'TRC-01')).toMatch(/primer remolque/);
    expect(newEquipmentHitchHint(1, 'TRC-01')).toMatch(/full/);
  });
});
