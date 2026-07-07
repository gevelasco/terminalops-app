import {
  tripArrivalIso,
  tripCompletionIso,
  tripDepartureIso,
} from './trip-schedule-accessors';

describe('trip-schedule-accessors', () => {
  const planned = {
    plannedDepartureAt: '2026-06-17T22:39:00.000Z',
    plannedArrivalAt: '2026-06-23T22:39:00.000Z',
    plannedCompletionAt: '2026-06-30T22:39:00.000Z',
  };

  it('uses planned dates for scheduled trips even when polluted actuals exist', () => {
    const polluted = '2026-06-15T22:40:00.000Z';
    const trip = {
      status: 'scheduled',
      createdAt: polluted,
      departureAt: polluted,
      arrivedAt: polluted,
      returnAt: polluted,
      ...planned,
    };

    expect(tripDepartureIso(trip)).toBe(planned.plannedDepartureAt);
    expect(tripArrivalIso(trip)).toBe(planned.plannedArrivalAt);
    expect(tripCompletionIso(trip)).toBe(planned.plannedCompletionAt);
  });

  it('uses distinct actual dates for in_transit trips', () => {
    const trip = {
      status: 'in_transit',
      createdAt: '2026-06-15T22:40:00.000Z',
      departureAt: '2026-06-17T22:39:00.000Z',
      arrivedAt: '2026-06-23T22:39:00.000Z',
      returnAt: '2026-06-30T22:39:00.000Z',
      ...planned,
    };

    expect(tripDepartureIso(trip)).toBe(trip.departureAt);
    expect(tripArrivalIso(trip)).toBe(trip.arrivedAt);
    expect(tripCompletionIso(trip)).toBe(trip.returnAt);
  });

  it('ignores paired spurious departure and arrival when return differs', () => {
    const pollutedPair = '2026-07-02T06:05:00.000Z';
    const trip = {
      status: 'completed',
      departureAt: pollutedPair,
      arrivedAt: pollutedPair,
      returnAt: '2026-06-21T07:12:00.000Z',
      ...planned,
    };

    expect(tripDepartureIso(trip)).toBe(planned.plannedDepartureAt);
    expect(tripArrivalIso(trip)).toBe(planned.plannedArrivalAt);
    expect(tripCompletionIso(trip)).toBe(trip.returnAt);
  });
});
