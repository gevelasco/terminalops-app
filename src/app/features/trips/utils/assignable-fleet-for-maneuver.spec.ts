import { Equipment, Trip, Unit } from '@shared/models/logistics.models';
import {
  buildManeuverAssignableUnitRows,
  unitMatchesManeuverAssignment,
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
    expect(byId['u3']!.operationType).toBe('doble-articulado');
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
    expect(unitMatchesManeuverOperationCode(sencillo, 'doble-articulado')).toBe(false);
    expect(unitMatchesManeuverOperationCode(full, 'doble-articulado')).toBe(true);
    expect(unitMatchesManeuverOperationCode(full, 'full')).toBe(true);
    expect(unitMatchesManeuverOperationCode(full, 'sencillo')).toBe(false);
  });

  it('includes self-contained units without hitched equipment', () => {
    const volteo = unit({
      id: 'fre-2021-dsaf',
      trailerBrandAbbr: 'FRE',
      trailerYear: '2021',
      plate: 'DSAF',
      transportType: 'maroma_volteo',
    });
    const rows = buildManeuverAssignableUnitRows([volteo], []);
    expect(rows.length).toBe(1);
    expect(rows[0]!.displayLabel).toMatch(/Volteo$/);
  });

  it('excludes units already on an active trip unless the maneuver is historical', () => {
    const busyUnit = unit({
      id: 'u-busy',
      status: 'in_use',
      hitchedEquipment: [equipment({ id: 'e-busy', unitId: 'u-busy' })],
    });
    const activeTrip = {
      id: 't1',
      unitId: 'u-busy',
      operatorId: 'op-1',
      status: 'in_transit',
    } as Trip;

    expect(
      buildManeuverAssignableUnitRows([busyUnit], [activeTrip]).map((r) => r.unit.id),
    ).toEqual([]);
    expect(
      buildManeuverAssignableUnitRows([busyUnit], [activeTrip], {
        ignoreCurrentAvailability: true,
      }).map((r) => r.unit.id),
    ).toEqual(['u-busy']);
  });
});

describe('unitMatchesManeuverAssignment', () => {
  const volteo = unit({
    id: 'volteo',
    transportType: 'maroma_volteo',
  });
  const rabon = unit({
    id: 'rabon',
    transportType: 'rabon_plataforma',
  });
  const pipa = unit({
    id: 'pipa',
    transportType: 'camion_pipa',
  });
  const tractorChasis = unit({
    id: 'chasis',
    transportType: 'tractocamion',
    hitchedEquipment: [
      equipment({ id: 'e-chasis', unitId: 'chasis', type: 'portacontenedor' }),
    ],
  });
  const tractorPlana = unit({
    id: 'plana',
    transportType: 'tractocamion',
    hitchedEquipment: [
      equipment({ id: 'e-plana', unitId: 'plana', type: 'plataforma' }),
    ],
  });
  const tractorGondola = unit({
    id: 'gondola',
    transportType: 'tractocamion',
    hitchedEquipment: [
      equipment({ id: 'e-gondola', unitId: 'gondola', type: 'gondola' }),
    ],
  });
  const chassis20 = unit({
    id: 'chasis-20',
    transportType: 'tractocamion',
    hitchedEquipment: [
      equipment({
        id: 'e-20',
        unitId: 'chasis-20',
        type: 'portacontenedor',
        fleetMeta: { equipmentContainerSlotConfig: 'iso_20' },
      }),
    ],
  });

  it('with container N/A shows rabón, volteo and pipa, and hides chassis/plana', () => {
    const naSencillo = { operationCode: 'sencillo', containerType: 'na' };

    expect(unitMatchesManeuverAssignment(volteo, naSencillo)).toBe(true);
    expect(unitMatchesManeuverAssignment(rabon, naSencillo)).toBe(true);
    expect(unitMatchesManeuverAssignment(pipa, naSencillo)).toBe(true);
    expect(unitMatchesManeuverAssignment(tractorChasis, naSencillo)).toBe(false);
    expect(unitMatchesManeuverAssignment(tractorPlana, naSencillo)).toBe(false);
    expect(unitMatchesManeuverAssignment(tractorGondola, naSencillo)).toBe(true);
  });

  it('with ISO container shows chassis and platform, hides the rest', () => {
    const iso = { operationCode: 'sencillo', containerType: '40hc' };

    expect(unitMatchesManeuverAssignment(volteo, iso)).toBe(false);
    expect(unitMatchesManeuverAssignment(rabon, iso)).toBe(false);
    expect(unitMatchesManeuverAssignment(pipa, iso)).toBe(false);
    expect(unitMatchesManeuverAssignment(tractorGondola, iso)).toBe(false);
    expect(unitMatchesManeuverAssignment(tractorChasis, iso)).toBe(true);
    expect(unitMatchesManeuverAssignment(tractorPlana, iso)).toBe(false);
    expect(
      unitMatchesManeuverAssignment(tractorPlana, {
        operationCode: 'plana',
        containerType: '40hc',
      }),
    ).toBe(true);
  });

  it('lets any chassis or platform haul any container size', () => {
    const chassis40 = unit({
      id: 'chasis-40',
      transportType: 'tractocamion',
      hitchedEquipment: [
        equipment({
          id: 'e-40',
          unitId: 'chasis-40',
          type: 'portacontenedor',
          fleetMeta: { equipmentContainerSlotConfig: 'iso_40' },
        }),
      ],
    });
    const chassisByLabel = unit({
      id: 'chasis-label',
      transportType: 'tractocamion',
      hitchedEquipment: [
        equipment({
          id: 'e-label',
          unitId: 'chasis-label',
          type: 'Portacontenedor / chasis',
          fleetMeta: { equipmentContainerSlotConfig: '40′ (un contenedor)' },
        }),
      ],
    });

    expect(
      unitMatchesManeuverAssignment(chassis20, {
        operationCode: 'sencillo',
        containerType: '45hc',
      }),
    ).toBe(true);
    expect(
      unitMatchesManeuverAssignment(chassis20, {
        operationCode: 'sencillo',
        containerType: '40hc',
      }),
    ).toBe(true);
    expect(
      unitMatchesManeuverAssignment(chassis40, {
        operationCode: 'sencillo',
        containerType: '20hc',
      }),
    ).toBe(true);
    expect(
      unitMatchesManeuverAssignment(chassisByLabel, {
        operationCode: 'sencillo',
        containerType: '20dc',
      }),
    ).toBe(true);
    expect(
      unitMatchesManeuverAssignment(tractorPlana, {
        operationCode: 'plana',
        containerType: '20hc',
      }),
    ).toBe(true);
  });
});
