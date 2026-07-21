import type { FleetOverviewItemDto } from '@shared/models/api/fleet-overview.model';
import {
  overviewCardEntryFromDto,
  overviewCardEntryFromEquipmentRow,
  overviewConvoySortKind,
  overviewIsEnCurso,
  overviewSortRank,
  overviewUnitConvoyLabel,
  type FleetOverviewCardEntry,
} from './fleet-overview-view';

function unitItem(
  partial: Partial<FleetOverviewItemDto> & Pick<FleetOverviewItemDto, 'hitchedEquipment'>,
): FleetOverviewItemDto {
  return {
    unitId: 1,
    unitName: 'PET-01',
    unitPlate: '12-AB-34',
    equipment: { equipmentId: null, type: 'none', status: 'available' },
    operationalStatus: 'available',
    ...partial,
  };
}

describe('overviewUnitConvoyLabel', () => {
  it('returns Tracto without hitched equipment', () => {
    expect(
      overviewUnitConvoyLabel(
        unitItem({
          hitchedEquipment: [],
          equipment: { equipmentId: null, type: 'none', status: 'available' },
        }),
      ),
    ).toBe('Tracto');
  });

  it('returns Sencillo with one trailer', () => {
    expect(
      overviewUnitConvoyLabel(
        unitItem({
          hitchedEquipment: [
            {
              equipmentId: 2,
              operationalCode: 'INT-01',
              equipmentType: 'portacontenedor',
              status: 'available',
            },
          ],
          equipment: { equipmentId: 2, type: 'single', status: 'available' },
          configuration: { id: 8, code: 'sencillo', name: 'Sencillo', maxEquipmentCount: 1 },
        }),
      ),
    ).toBe('Sencillo');
  });

  it('returns Doble articulado with two trailers', () => {
    expect(
      overviewUnitConvoyLabel(
        unitItem({
          hitchedEquipment: [
            {
              equipmentId: 2,
              operationalCode: 'A',
              equipmentType: 'caja_seca',
              hitchPosition: 'lead',
              status: 'available',
            },
            {
              equipmentId: 3,
              operationalCode: 'B',
              equipmentType: 'caja_seca',
              hitchPosition: 'rear',
              status: 'available',
            },
          ],
          equipment: { equipmentId: 2, type: 'full', status: 'available' },
        }),
      ),
    ).toBe('Doble articulado');
  });
});

describe('overviewCardEntryFromDto', () => {
  it('ignores operation configuration name for badge label', () => {
    const entry = overviewCardEntryFromDto(
      unitItem({
        hitchedEquipment: [
          {
            equipmentId: 2,
            operationalCode: 'INT-01',
            equipmentType: 'Portacontenedor / chasis',
            status: 'available',
          },
        ],
        equipment: { equipmentId: 2, type: 'single', status: 'available' },
        configuration: { id: 8, code: 'sencillo', name: 'Sencillo', maxEquipmentCount: 1 },
      }),
    );
    expect(entry.convoy.label).toBe('Sencillo');
    expect(entry.convoy.code).toBe('sencillo');
  });
});

describe('overviewCardEntryFromEquipmentRow', () => {
  it('uses catalog label for standalone equipment', () => {
    const entry = overviewCardEntryFromEquipmentRow({
      equipmentId: 9,
      unitId: null,
      unitName: null,
      operationalCode: 'INT-2027',
      brand: 'INT',
      model: '2027',
      plate: 'WE',
      equipmentType: 'caja_seca',
      operationalStatus: 'available',
    });
    expect(entry?.convoy.label).toBe('Caja seca (dry van)');
  });
});

function sortEntries(entries: FleetOverviewCardEntry[]): FleetOverviewCardEntry[] {
  return [...entries].sort((a, b) => {
    const rankDiff = overviewSortRank(b) - overviewSortRank(a);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return a.unitName.localeCompare(b.unitName, 'es');
  });
}

describe('overviewSortRank', () => {
  it('orders en curso before disponible', () => {
    const enCurso = overviewCardEntryFromDto(
      unitItem({
        unitId: 1,
        unitName: 'Z-TRACTO',
        operationalStatus: 'in_transit',
        hitchedEquipment: [],
        trip: {
          tripId: 1,
          maneuverCode: 'CHI-0001',
          status: 'in_transit',
          clientName: 'Cliente',
          originCityMunicipality: 'A, Estado',
          destinationCityMunicipality: 'B, Estado',
          plannedDepartureAt: '2026-06-10T19:15:00',
          plannedArrivalAt: '2026-06-12T10:00:00',
          plannedCompletionAt: '2026-06-15T08:00:00',
        },
      }),
    );
    const disponible = overviewCardEntryFromDto(
      unitItem({
        unitId: 2,
        unitName: 'A-TRACTO',
        hitchedEquipment: [],
      }),
    );

    expect(sortEntries([disponible, enCurso]).map((e) => e.unitName)).toEqual([
      'Z-TRACTO',
      'A-TRACTO',
    ]);
    expect(overviewIsEnCurso(enCurso)).toBe(true);
    expect(overviewIsEnCurso(disponible)).toBe(false);
  });

  it('orders convoy types within each operational block', () => {
    const doble = overviewCardEntryFromDto(
      unitItem({
        unitId: 1,
        unitName: 'DOBLE',
        hitchedEquipment: [
          {
            equipmentId: 2,
            operationalCode: 'A',
            equipmentType: 'caja_seca',
            status: 'available',
          },
          {
            equipmentId: 3,
            operationalCode: 'B',
            equipmentType: 'caja_seca',
            status: 'available',
          },
        ],
        equipment: { equipmentId: 2, type: 'full', status: 'available' },
      }),
    );
    const sencillo = overviewCardEntryFromDto(
      unitItem({
        unitId: 2,
        unitName: 'SENCILLO',
        hitchedEquipment: [
          {
            equipmentId: 4,
            operationalCode: 'INT-01',
            equipmentType: 'portacontenedor',
            status: 'available',
          },
        ],
        equipment: { equipmentId: 4, type: 'single', status: 'available' },
      }),
    );
    const tracto = overviewCardEntryFromDto(
      unitItem({
        unitId: 3,
        unitName: 'TRACTO',
        hitchedEquipment: [],
      }),
    );
    const remolque = overviewCardEntryFromEquipmentRow({
      equipmentId: 9,
      unitId: null,
      unitName: null,
      operationalCode: 'REM-01',
      brand: 'INT',
      model: '2027',
      plate: 'WE',
      equipmentType: 'caja_seca',
      operationalStatus: 'available',
    })!;

    expect(overviewConvoySortKind(doble)).toBe('doble-articulado');
    expect(overviewConvoySortKind(sencillo)).toBe('sencillo');
    expect(overviewConvoySortKind(tracto)).toBe('tracto');
    expect(overviewConvoySortKind(remolque)).toBe('remolque');

    expect(sortEntries([remolque, tracto, sencillo, doble]).map((e) => e.unitName)).toEqual([
      'DOBLE',
      'SENCILLO',
      'TRACTO',
      'REM-01',
    ]);
  });

  it('applies convoy order independently for en curso and disponible blocks', () => {
    const enCursoTracto = overviewCardEntryFromDto(
      unitItem({
        unitId: 1,
        unitName: 'EN-TRACTO',
        operationalStatus: 'in_transit',
        hitchedEquipment: [],
        trip: {
          tripId: 2,
          maneuverCode: 'CHI-0002',
          status: 'in_transit',
          clientName: 'Cliente',
          originCityMunicipality: 'A, Estado',
          destinationCityMunicipality: 'B, Estado',
          plannedDepartureAt: '2026-06-10T19:15:00',
          plannedArrivalAt: '2026-06-12T10:00:00',
          plannedCompletionAt: '2026-06-15T08:00:00',
        },
      }),
    );
    const disponibleDoble = overviewCardEntryFromDto(
      unitItem({
        unitId: 2,
        unitName: 'DISP-DOBLE',
        hitchedEquipment: [
          {
            equipmentId: 2,
            operationalCode: 'A',
            equipmentType: 'caja_seca',
            status: 'available',
          },
          {
            equipmentId: 3,
            operationalCode: 'B',
            equipmentType: 'caja_seca',
            status: 'available',
          },
        ],
        equipment: { equipmentId: 2, type: 'full', status: 'available' },
      }),
    );

    expect(sortEntries([disponibleDoble, enCursoTracto]).map((e) => e.unitName)).toEqual([
      'EN-TRACTO',
      'DISP-DOBLE',
    ]);
  });
});
