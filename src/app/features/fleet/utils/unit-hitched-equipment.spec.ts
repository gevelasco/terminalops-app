import { Equipment } from '@shared/models/logistics.models';
import type { OperationConfigurationResolver } from '@shared/services/operation-configuration-resolver.types';
import {
  equipmentAssignedToUnit,
  equipmentTypeDisplayLabel,
  convoyOverviewHitchPositionLabel,
  fleetUnitConvoyTableBadges,
  fleetUnitConvoyTableLabel,
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

const mockResolver: OperationConfigurationResolver = {
  resolveLabel: () => 'Sencillo',
  resolveColor: () => '#000',
  resolveBadge: () => '',
  resolveGroupingKey: () => 'Sencillo',
  resolveMaxEquipment: () => 1,
  usesMultipleEquipment: () => false,
  resolveConvoyMode: (equipment) => mockResolver.resolveConvoyDisplay(equipment).kind,
  resolveConvoyDisplay: (equipment) => {
    const n = equipment.length;
    if (n === 0) {
      return {
        kind: 'none',
        code: null,
        label: 'Sin enganche',
        badgeClass: '',
        description: '',
      };
    }
    if (n >= 2) {
      return {
        kind: 'multi',
        code: 'full',
        label: 'Doble articulado',
        badgeClass: '',
        description: '',
      };
    }
    const isPlataforma = equipment[0]?.type === 'plataforma';
    return {
      kind: isPlataforma ? 'plataforma' : 'single',
      code: isPlataforma ? 'plana' : 'sencillo',
      label: isPlataforma ? 'Plana' : 'Sencillo',
      badgeClass: '',
      description: '',
    };
  },
  contextFromTrip: (trip) => ({
    operationConfigurationId: trip.operationConfigurationId,
    code: trip.operationType,
    nameSnapshot: trip.operationConfigurationNameSnapshot,
  }),
  contextFromRatePrice: (price) => ({
    operationConfigurationId: price.operationConfigurationId,
    code: price.operationConfigurationCode,
    nameSnapshot: price.operationConfigurationName,
  }),
  contextFromTableRow: (row, codeField = 'operationType') => ({
    operationConfigurationId:
      typeof row['operationConfigurationId'] === 'string'
        ? row['operationConfigurationId']
        : undefined,
    code: String(row[codeField] ?? ''),
    nameSnapshot:
      typeof row['operationConfigurationNameSnapshot'] === 'string'
        ? row['operationConfigurationNameSnapshot']
        : undefined,
  }),
  resolveTripDisplay: (trip) => ({
    code: trip.operationType,
    label: trip.operationType,
    badgeClass: '',
    chartColor: '#000',
    groupingKey: trip.operationType,
  }),
  resolveCellDisplay: (code) => ({
    code: String(code ?? ''),
    label: String(code ?? ''),
    badgeClass: '',
    chartColor: '#000',
    groupingKey: String(code ?? ''),
  }),
  resolveChartTone: () => 0,
  resolveChartFillClass: () => '',
  resolveSuggestsPlataformaConvoy: () => false,
};

describe('unit-hitched-equipment', () => {
  it('filters and sorts by unit', () => {
    const list = [
      eq({ id: 'b', unitId: 'U1' }),
      eq({ id: 'a', unitId: 'U1' }),
      eq({ id: 'c', unitId: 'U2' }),
    ];
    expect(equipmentAssignedToUnit(list, 'U1').map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('sorts lead hitch before rear', () => {
    const list = [
      eq({ id: 'rear', unitId: 'U1', hitchPosition: 'rear' }),
      eq({ id: 'lead', unitId: 'U1', hitchPosition: 'lead' }),
    ];
    expect(equipmentAssignedToUnit(list, 'U1').map((e) => e.id)).toEqual(['lead', 'rear']);
  });

  it('derives convoy labels', () => {
    expect(unitConvoyFromEquipment([], mockResolver).kind).toBe('none');
    expect(
      unitConvoyFromEquipment([eq({ id: '1', unitId: 'U', type: 'caja_seca' })], mockResolver)
        .kind,
    ).toBe('single');
    expect(
      unitConvoyFromEquipment(
        [
          eq({ id: '1', unitId: 'U', type: 'plataforma' }),
          eq({ id: '2', unitId: 'U', type: 'caja_seca' }),
        ],
        mockResolver,
      ).kind,
    ).toBe('multi');
  });

  it('maps equipment type label', () => {
    expect(equipmentTypeDisplayLabel(eq({ id: '1', unitId: 'U', type: 'refrigerado' }))).toContain(
      'Refrigerado',
    );
  });

  it('labels overview hitch slots by index', () => {
    expect(convoyOverviewHitchPositionLabel(0, 2)).toMatch(/1\.er equipo/);
    expect(convoyOverviewHitchPositionLabel(1, 2)).toMatch(/2\.do equipo/);
  });

  it('derives fleet unit convoy table labels from hitch count', () => {
    expect(fleetUnitConvoyTableLabel(0)).toBe('Tracto');
    expect(fleetUnitConvoyTableLabel(1)).toBe('Sencillo');
    expect(fleetUnitConvoyTableLabel(2)).toBe('Doble articulado');
    expect(
      fleetUnitConvoyTableBadges([
        eq({ id: '1', unitId: 'U', type: 'caja_seca' }),
      ])[0]?.label,
    ).toBe('Sencillo');
  });
});
