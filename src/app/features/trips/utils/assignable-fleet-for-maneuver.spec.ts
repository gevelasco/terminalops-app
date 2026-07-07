import { Equipment, Unit } from '@shared/models/logistics.models';
import {
  buildManeuverAssignableUnitRows,
  unitMatchesManeuverOperationCode,
} from './assignable-fleet-for-maneuver';

function unit(partial: Partial<Unit> & Pick<Unit, 'id'>): Unit {
  return {
    plate: 'ABC-123',
    status: 'available',
    trailerBrandAbbr: 'PET',
    trailerYear: '2024',
    ...partial,
  } as Unit;
}

function equipment(partial: Partial<Equipment> & Pick<Equipment, 'id' | 'unitId'>): Equipment {
  return {
    plate: 'REM-01',
    status: 'available',
    type: 'gondola',
    ...partial,
  } as Equipment;
}

describe('buildManeuverAssignableUnitRows', () => {
  it('excludes inactive units from assignable rows', () => {
    const rows = buildManeuverAssignableUnitRows(
      [
        unit({
          id: 'u1',
          hitchedEquipment: [equipment({ id: 'e0', unitId: 'u1' })],
        }),
        unit({
          id: 'u2',
          isActive: false,
          hitchedEquipment: [equipment({ id: 'e1', unitId: 'u2' })],
        }),
      ],
      [],
    );
    expect(rows.map((r) => r.unit.id)).toEqual(['u1']);
  });

  it('shows convoy config labels, not equipment type', () => {
    const u2 = unit({
      id: 'u2',
      trailerBrandAbbr: 'VOL',
      hitchedEquipment: [equipment({ id: 'e1', unitId: 'u2' })],
    });
    const u3 = unit({
      id: 'u3',
      trailerBrandAbbr: 'KEN',
      hitchedEquipment: [
        equipment({ id: 'e2', unitId: 'u3' }),
        equipment({ id: 'e3', unitId: 'u3' }),
      ],
    });

    const rows = buildManeuverAssignableUnitRows([u2, u3], []);
    const byId = Object.fromEntries(rows.map((r) => [r.unit.id, r]));

    expect(byId['u2']!.displayLabel).toMatch(/ - Sencillo$/);
    expect(byId['u2']!.displayLabel).not.toMatch(/gondola|góndola/i);
    expect(byId['u2']!.operationType).toBe('sencillo');
    expect(byId['u3']!.displayLabel).toMatch(/ - Doble articulado$/);
    expect(byId['u3']!.operationType).toBe('full');
  });

  it('matches unit convoy code to maneuver configuration', () => {
    const sencillo = unit({
      id: 'u1',
      hitchedEquipment: [equipment({ id: 'e1', unitId: 'u1' })],
    });
    const full = unit({
      id: 'u2',
      hitchedEquipment: [
        equipment({ id: 'e2', unitId: 'u2' }),
        equipment({ id: 'e3', unitId: 'u2' }),
      ],
    });

    expect(unitMatchesManeuverOperationCode(sencillo, 'sencillo')).toBe(true);
    expect(unitMatchesManeuverOperationCode(sencillo, 'full')).toBe(false);
    expect(unitMatchesManeuverOperationCode(full, 'full')).toBe(true);
    expect(unitMatchesManeuverOperationCode(full, 'sencillo')).toBe(false);
  });
});
