import type { Equipment, Unit } from '@shared/models/logistics.models';
import {
  equipmentHitchAddActionLabel,
  equipmentSelectableForUnitHitch,
  hitchPositionForNewEquipmentOnUnit,
  unitEligibleForEquipmentHitch,
  unitHasHitchSlot,
  unitHitchSlotForNewEquipment,
  unitsEligibleForEquipmentHitch,
  validateEquipmentHitchAssignment,
} from './equipment-hitch-assignment';
import { rearEquipmentToPromoteOnLeadUnhitch } from './equipment-hitch-position';

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

  it('blocks third equipment on full unit', () => {
    const v = validateEquipmentHitchAssignment({
      unitId: 'U1',
      catalog,
      isSecondTrailer: false,
      unitLabel: 'TRC-01',
    });
    expect(v.canSave).toBe(false);
    expect(v.blockMessage).toMatch(/doble articulado/i);
  });

  it('blocks second equipment when unit has no first equipment', () => {
    const v = validateEquipmentHitchAssignment({
      unitId: 'U1',
      catalog: [eq({ id: 'rear-1', unitId: 'U1', hitchPosition: 'rear' })],
      isSecondTrailer: true,
      unitLabel: 'TRC-01',
    });
    expect(v.canSave).toBe(false);
    expect(v.blockMessage).toMatch(/1er equipo/i);
  });

  it('blocks second slot when unit has no other equipment', () => {
    const v = validateEquipmentHitchAssignment({
      unitId: 'U9',
      catalog: [],
      isSecondTrailer: true,
    });
    expect(v.canSave).toBe(false);
    expect(v.blockMessage).toMatch(/1er equipo/i);
  });

  it('allows second equipment when one lead exists', () => {
    const v = validateEquipmentHitchAssignment({
      unitId: 'U2',
      catalog,
      isSecondTrailer: true,
      unitLabel: 'TRC-02',
    });
    expect(v.canSave).toBe(true);
    expect(v.infoMessage).toMatch(/2do equipo/i);
  });

  it('blocks first equipment when lead already exists', () => {
    const v = validateEquipmentHitchAssignment({
      unitId: 'U2',
      catalog,
      isSecondTrailer: false,
      unitLabel: 'TRC-02',
    });
    expect(v.canSave).toBe(false);
    expect(v.blockMessage).toMatch(/1er equipo/i);
    expect(v.blockMessage).toMatch(/2do equipo/i);
  });

  it('lists selectable equipment for unit', () => {
    const list = [
      eq({ id: 'free', unitId: '' }),
      eq({ id: 'mine', unitId: 'U1', hitchPosition: 'lead' }),
      eq({ id: 'other', unitId: 'U2' }),
    ];
    const selectable = equipmentSelectableForUnitHitch(list, 'U1');
    expect(selectable.map((e) => e.id).sort()).toEqual(['free', 'mine']);
    expect(unitHasHitchSlot(list, 'U1')).toBe(true);
    expect(unitHasHitchSlot(list, 'U1', 'mine')).toBe(true);
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

describe('unitsEligibleForEquipmentHitch', () => {
  const u1: Unit = {
    id: 'U1',
    plate: 'AA',
    capacityKg: 1,
    status: 'available',
  };
  const uRoute: Unit = {
    id: 'U-ROUTE',
    plate: 'BB',
    capacityKg: 1,
    status: 'in_use',
  };
  const uFull: Unit = {
    id: 'U-FULL',
    plate: 'CC',
    capacityKg: 1,
    status: 'available',
  };

  it('includes tracto and sencillo units not on route', () => {
    const catalog = [
      eq({ id: 'lead-1', unitId: 'U2', hitchPosition: 'lead' }),
      eq({ id: 'a', unitId: 'U-FULL', hitchPosition: 'lead' }),
      eq({ id: 'b', unitId: 'U-FULL', hitchPosition: 'rear' }),
    ];
    const uSencillo: Unit = {
      id: 'U2',
      plate: 'DD',
      capacityKg: 1,
      status: 'available',
    };
    expect(unitEligibleForEquipmentHitch(u1, catalog)).toBe(true);
    expect(unitEligibleForEquipmentHitch(uSencillo, catalog)).toBe(true);
    expect(unitEligibleForEquipmentHitch(uRoute, catalog)).toBe(false);
    expect(unitEligibleForEquipmentHitch(uFull, catalog)).toBe(false);
    expect(unitsEligibleForEquipmentHitch([u1, uSencillo, uRoute, uFull], catalog).map((u) => u.id)).toEqual([
      'U1',
      'U2',
    ]);
  });
});

describe('hitchPositionForNewEquipmentOnUnit', () => {
  it('returns rear when tractor already has a lead equipment', () => {
    const catalog = [
      eq({ id: 'lead-1', unitId: 'U1', hitchPosition: 'lead' }),
      eq({ id: 'free', unitId: '' }),
    ];
    expect(hitchPositionForNewEquipmentOnUnit(catalog, 'U1', 'free')).toBe('rear');
    expect(hitchPositionForNewEquipmentOnUnit(catalog, 'U1')).toBe('rear');
  });

  it('returns lead when tractor has no other equipment', () => {
    expect(hitchPositionForNewEquipmentOnUnit([], 'U9', 'free')).toBe('lead');
  });
});

describe('rearEquipmentToPromoteOnLeadUnhitch', () => {
  it('returns rear equipment when unhitching lead in doble articulado', () => {
    const lead = eq({ id: 'lead', unitId: 'U1', hitchPosition: 'lead' });
    const rear = eq({ id: 'rear', unitId: 'U1', hitchPosition: 'rear' });
    const catalog = [lead, rear];
    expect(rearEquipmentToPromoteOnLeadUnhitch(catalog, lead)?.id).toBe('rear');
    expect(rearEquipmentToPromoteOnLeadUnhitch(catalog, rear)).toBeNull();
  });
});

describe('unitHitchSlotForNewEquipment', () => {
  const catalog = [eq({ id: 'lead-1', unitId: 'U1', hitchPosition: 'lead' })];

  it('returns first when unit is empty', () => {
    expect(unitHitchSlotForNewEquipment([], 'U9')).toBe('first');
    expect(equipmentHitchAddActionLabel([], 'U9')).toBe('Enganchar 1er equipo');
  });

  it('returns second when one equipment is hitched', () => {
    expect(unitHitchSlotForNewEquipment(catalog, 'U1')).toBe('second');
    expect(equipmentHitchAddActionLabel(catalog, 'U1')).toBe('Enganchar 2do equipo');
  });
});
