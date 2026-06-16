import { Equipment, Unit } from '@shared/models/logistics.models';
import { buildManeuverAssignableUnitRows } from './assignable-fleet-for-maneuver';

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
  it('shows convoy config labels, not equipment type', () => {
    const u1 = unit({ id: 'u1' });
    const u2 = unit({ id: 'u2', trailerBrandAbbr: 'VOL' });
    const u3 = unit({ id: 'u3', trailerBrandAbbr: 'KEN' });

    const rows = buildManeuverAssignableUnitRows(
      [u1, u2, u3],
      [
        equipment({ id: 'e1', unitId: 'u2' }),
        equipment({ id: 'e2', unitId: 'u3' }),
        equipment({ id: 'e3', unitId: 'u3' }),
      ],
      [],
    );

    const byId = Object.fromEntries(rows.map((r) => [r.unit.id, r]));

    expect(byId['u1']!.displayLabel).toMatch(/ - Tracto$/);
    expect(byId['u1']!.operationType).toBe('');
    expect(byId['u2']!.displayLabel).toMatch(/ - Sencillo$/);
    expect(byId['u2']!.displayLabel).not.toMatch(/gondola|góndola/i);
    expect(byId['u2']!.operationType).toBe('sencillo');
    expect(byId['u3']!.displayLabel).toMatch(/ - Doble articulado$/);
    expect(byId['u3']!.operationType).toBe('full');
  });
});
