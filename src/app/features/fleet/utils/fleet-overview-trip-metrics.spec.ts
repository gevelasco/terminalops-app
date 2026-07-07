import {
  overviewTripEtaDaysLabel,
  overviewTripProgress,
} from './fleet-overview-trip-metrics';
import type { FleetOverviewTripDto } from '@shared/models/api/fleet-overview.model';

describe('fleet-overview-trip-metrics', () => {
  const invalidTrip = {
    tripId: 1,
    maneuverCode: 'M-001',
    clientName: 'Cliente',
    origin: 'A',
    destination: 'B',
    status: 'in_transit',
    departureAt: '2026-07-02T01:30:00.000Z',
    arrivedAt: '2026-07-02T01:30:00.000Z',
    returnAt: '2026-06-20T07:12:00.000Z',
    plannedDepartureAt: '2026-07-02T01:30:00.000Z',
    plannedArrivalAt: '2026-07-02T01:30:00.000Z',
    plannedCompletionAt: '2026-07-09T01:30:00.000Z',
    operationalDistanceKm: 557,
  } satisfies FleetOverviewTripDto;

  it('does not invent ETA Viaje when llegada fin is before salida', () => {
    expect(overviewTripEtaDaysLabel(invalidTrip)).toBe('—');
  });

  it('does not report 100% avance when schedule window is invalid', () => {
    const progress = overviewTripProgress(invalidTrip);
    expect(progress.percent).toBe(0);
    expect(progress.ariaLabel).toContain('sin salida real registrada');
  });

  it('keeps avance at 0% for scheduled trips even when planned dates passed', () => {
    const trip = {
      tripId: 3,
      maneuverCode: 'ADM-0003',
      clientName: 'Cliente',
      origin: 'A',
      destination: 'B',
      status: 'scheduled',
      departureAt: '2026-07-02T06:05:00.000Z',
      arrivedAt: '2026-07-02T06:05:00.000Z',
      returnAt: '2026-06-21T07:12:00.000Z',
      plannedDepartureAt: '2026-06-13T07:11:00.000Z',
      plannedArrivalAt: '2026-06-15T07:11:00.000Z',
      plannedCompletionAt: '2026-06-20T07:12:00.000Z',
    } satisfies FleetOverviewTripDto;

    expect(overviewTripProgress(trip).percent).toBe(0);
  });

  it('does not use fin real for avance while in_transit without salida real', () => {
    const trip = {
      tripId: 3,
      maneuverCode: 'ADM-0003',
      clientName: 'Cliente',
      origin: 'A',
      destination: 'B',
      status: 'in_transit',
      departureAt: '2026-07-02T06:05:00.000Z',
      arrivedAt: '2026-07-02T06:05:00.000Z',
      returnAt: '2026-06-21T07:12:00.000Z',
      plannedDepartureAt: '2026-06-13T07:11:00.000Z',
      plannedArrivalAt: '2026-06-15T07:11:00.000Z',
      plannedCompletionAt: '2026-06-20T07:12:00.000Z',
    } satisfies FleetOverviewTripDto;

    expect(overviewTripProgress(trip).percent).toBe(0);
  });

  it('computes ETA Viaje from salida to llegada fin when order is valid', () => {
    const validTrip = {
      ...invalidTrip,
      returnAt: '2026-07-09T01:30:00.000Z',
    } satisfies FleetOverviewTripDto;
    expect(overviewTripEtaDaysLabel(validTrip)).toBe('~7 días');
  });
});
