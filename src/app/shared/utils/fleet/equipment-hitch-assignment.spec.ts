import type { Equipment } from '@shared/models/logistics.models';
import {
  equipmentSelectableForUnitHitch,
  unitHasHitchSlot,
  validateEquipmentHitchAssignment,
} from './equipment-hitch-assignment';

function eq(partial: Partial<Equipment> & Pick<Equipment, 'id' | 'unitId'>): Equipment {
  return {
    plate: '12-AB-3C',
    status: 'available',
    type: 'caja_seca',
    serialNumber: 'SN1',
    name: 'R1',
    ...partial,
  } as Equipment;
}

describe('validateEquipmentHitchAssignment', () => {
  const catalog = [
    eq({ id: 'lead-1', unitId: 'U1', hitchPosition: 'lead' }),
    eq({ id: 'rear-1', unitId: 'U1', hitchPosition: 'rear' }),
    eq({ id: 'solo', unitId: 'U2', hitchPosition: 'lead' }),
  ];

  it('allows save without tractor', () => {
    expect(validateEquipmentHitchAssignment({ unitId: '', catalog, isSecondTrailer: false }).canSave).toBe(
      true,
    );
  });

  it('blocks third trailer on full unit', () => {
    const v = validateEquipmentHitchAssignment({
      unitId: 'U1',
      catalog,
      isSecondTrailer: false,
      unitLabel: 'TRC-01',
    });
    expect(v.canSave).toBe(false);
    expect(v.blockMessage).toMatch(/full/i);
  });

  it('blocks second rear when one already exists', () => {
    const v = validateEquipmentHitchAssignment({
      unitId: 'U1',
      catalog: [eq({ id: 'rear-1', unitId: 'U1', hitchPosition: 'rear' })],
      isSecondTrailer: true,
      unitLabel: 'TRC-01',
    });
    expect(v.canSave).toBe(false);
    expect(v.blockMessage).toMatch(/segundo remolque/i);
    expect(v.blockMessage).toMatch(/rear-1|HYU/i);
  });

  it('only allows lead when unit has no other trailers', () => {
    const v = validateEquipmentHitchAssignment({
      unitId: 'U9',
      catalog: [],
      isSecondTrailer: true,
    });
    expect(v.canSave).toBe(false);
    expect(v.infoMessage).toMatch(/primer remolque/i);
    expect(v.showSecondTrailerToggle).toBe(false);
  });

  it('allows rear when one lead exists', () => {
    const v = validateEquipmentHitchAssignment({
      unitId: 'U2',
      catalog,
      isSecondTrailer: true,
      unitLabel: 'TRC-02',
    });
    expect(v.canSave).toBe(true);
    expect(v.infoMessage).toMatch(/segundo remolque/i);
  });

  it('blocks duplicate lead', () => {
    const v = validateEquipmentHitchAssignment({
      unitId: 'U2',
      catalog,
      isSecondTrailer: false,
      unitLabel: 'TRC-02',
    });
    expect(v.canSave).toBe(false);
    expect(v.blockMessage).toMatch(/primer remolque/i);
  });

  it('lists selectable equipment for unit', () => {
    const catalog = [
      eq({ id: 'free', unitId: '' }),
      eq({ id: 'mine', unitId: 'U1', hitchPosition: 'lead' }),
      eq({ id: 'other', unitId: 'U2' }),
    ];
    const selectable = equipmentSelectableForUnitHitch(catalog, 'U1');
    expect(selectable.map((e) => e.id).sort()).toEqual(['free', 'mine']);
    expect(unitHasHitchSlot(catalog, 'U1')).toBe(true);
    expect(unitHasHitchSlot(catalog, 'U1', 'mine')).toBe(true);
    const fullOnU1 = [
      eq({ id: 'a', unitId: 'U1', hitchPosition: 'lead' }),
      eq({ id: 'b', unitId: 'U1', hitchPosition: 'rear' }),
    ];
    expect(unitHasHitchSlot(fullOnU1, 'U1')).toBe(false);
  });

  it('excludes self when editing', () => {
    const v = validateEquipmentHitchAssignment({
      unitId: 'U1',
      catalog,
      excludeEquipmentId: 'lead-1',
      isSecondTrailer: false,
    });
    expect(v.canSave).toBe(true);
  });
});
