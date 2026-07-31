import { buildDashboardUpcomingDepartures } from './dashboard-upcoming-departures.util';
import type { Trip } from '@shared/models/logistics.models';

function trip(partial: Partial<Trip> & Pick<Trip, 'id' | 'plannedDepartureAt'>): Trip {
  return {
    maneuverCode: partial.maneuverCode ?? `M-${partial.id}`,
    clientName: '',
    clientId: '',
    unitId: partial.unitId ?? 'u1',
    operatorId: partial.operatorId ?? 'o1',
    operatorName: partial.operatorName ?? 'Ana',
    status: partial.status ?? 'scheduled',
    createdAt: '2026-07-01T00:00:00.000Z',
    plannedArrivalAt: partial.plannedDepartureAt,
    plannedCompletionAt: partial.plannedDepartureAt,
    operationType: 'local',
    loadType: 'lleno',
    containerType: '40hc',
    approximateWeightTons: '',
    equipment: [],
    departureAt: null,
    arrivedAt: null,
    returnAt: null,
    creditDays: 0,
    hasIncident: false,
    destinationCityMunicipality: partial.destinationCityMunicipality ?? 'Monterrey',
    ...partial,
  } as Trip;
}

describe('buildDashboardUpcomingDepartures', () => {
  const now = new Date('2026-07-30T18:00:00.000Z');

  it('orders overdue first, then by departure time', () => {
    const rows = buildDashboardUpcomingDepartures(
      [
        trip({
          id: '2',
          plannedDepartureAt: '2026-07-30T20:00:00.000Z',
          maneuverCode: 'B-2',
        }),
        trip({
          id: '1',
          plannedDepartureAt: '2026-07-30T10:00:00.000Z',
          maneuverCode: 'A-1',
        }),
        trip({
          id: '3',
          plannedDepartureAt: '2026-07-30T22:00:00.000Z',
          maneuverCode: 'C-3',
        }),
      ],
      { now, limit: 10 },
    );

    expect(rows.map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(rows[0]?.overdue).toBe(true);
    expect(rows[1]?.overdue).toBe(false);
  });

  it('flags missing operator or unit', () => {
    const rows = buildDashboardUpcomingDepartures(
      [
        trip({
          id: '1',
          plannedDepartureAt: '2026-07-30T20:00:00.000Z',
          operatorId: '',
          operatorName: 'Sin operador',
          unitId: '',
        }),
      ],
      { now },
    );

    expect(rows[0]?.missingAssignment).toBe(true);
    expect(rows[0]?.operatorLabel).toBe('Sin operador');
  });

  it('ignores non-scheduled trips', () => {
    const rows = buildDashboardUpcomingDepartures(
      [
        trip({
          id: '1',
          status: 'in_transit',
          plannedDepartureAt: '2026-07-30T20:00:00.000Z',
        }),
      ],
      { now },
    );
    expect(rows).toEqual([]);
  });
});
