import {
  overviewTripEtaDaysLabel,
  overviewTripEtaKmLabel,
  overviewTripProgress,
} from './fleet-overview-trip-metrics';
import type { FleetOverviewTripDto } from '@shared/models/api/fleet-overview.model';

describe('fleet-overview-trip-metrics', () => {
  const baseTrip = {
    tripId: 1,
    maneuverCode: 'M-001',
    clientName: 'Cliente',
    origin: 'A, Estado → B, Estado',
    destination: 'B, Estado',
    status: 'in_transit',
    departureAt: '2026-07-02T01:30:00.000Z',
    arrivedAt: '2026-07-02T01:30:00.000Z',
    returnAt: '2026-06-20T07:12:00.000Z',
    plannedDepartureAt: '2026-07-02T01:30:00.000Z',
    plannedArrivalAt: '2026-07-05T01:30:00.000Z',
    plannedCompletionAt: '2026-07-09T01:30:00.000Z',
    operationalDistanceKm: 557,
  } satisfies FleetOverviewTripDto;

  it('does not invent ETA Viaje when mixed schedule is invalid and plan is missing', () => {
    const trip = {
      ...baseTrip,
      plannedDepartureAt: undefined,
      plannedArrivalAt: undefined,
      plannedCompletionAt: undefined,
    } satisfies FleetOverviewTripDto;
    expect(overviewTripEtaDaysLabel(trip)).toBe('—');
  });

  it('falls back to plan for avance when actual fin is before salida', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date('2026-07-05T13:30:00.000Z'));

      const progress = overviewTripProgress(baseTrip);
      expect(progress.percent).toBe(50);
      expect(progress.ariaLabel).toContain('50%');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('keeps avance at 0% for scheduled trips even when planned dates passed', () => {
    const trip = {
      tripId: 3,
      maneuverCode: 'ADM-0003',
      clientName: 'Cliente',
      origin: 'A → B',
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

  it('uses salida real when present and fin plan when fin real is absent', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date('2026-07-31T23:00:00.000Z'));

      // Salida real distinta de entrega; sin fin real → usa plannedCompletionAt.
      const trip = {
        tripId: 3,
        maneuverCode: 'ADM-0003',
        clientName: 'Cliente',
        origin: 'A → B',
        destination: 'B',
        status: 'in_transit',
        departureAt: '2026-07-30T23:00:00.000Z',
        arrivedAt: '2026-07-31T12:00:00.000Z',
        plannedDepartureAt: '2026-07-30T20:00:00.000Z',
        plannedArrivalAt: '2026-07-31T12:00:00.000Z',
        plannedCompletionAt: '2026-08-01T23:00:00.000Z',
      } satisfies FleetOverviewTripDto;

      expect(overviewTripProgress(trip).percent).toBe(50);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('advances from plan while in_transit without salida real', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date('2026-07-31T23:00:00.000Z'));

      const trip = {
        tripId: 3,
        maneuverCode: 'ADM-0003',
        clientName: 'Cliente',
        origin: 'A → B',
        destination: 'B',
        status: 'in_transit',
        departureAt: '2026-07-02T06:05:00.000Z',
        arrivedAt: '2026-07-02T06:05:00.000Z',
        returnAt: '2026-06-21T07:12:00.000Z',
        plannedDepartureAt: '2026-07-30T23:00:00.000Z',
        plannedArrivalAt: '2026-07-31T23:00:00.000Z',
        plannedCompletionAt: '2026-08-01T23:00:00.000Z',
      } satisfies FleetOverviewTripDto;

      expect(overviewTripProgress(trip).percent).toBe(50);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('shows ETA KMS from operationalDistanceKm', () => {
    expect(overviewTripEtaKmLabel(baseTrip)).toBe('~557.0 km');
  });

  it('shows dash for ETA KMS when operational distance is missing', () => {
    expect(
      overviewTripEtaKmLabel({
        ...baseTrip,
        operationalDistanceKm: undefined,
      }),
    ).toBe('—');
  });

  it('computes ETA Viaje from salida to llegada fin when order is valid', () => {
    const validTrip = {
      ...baseTrip,
      returnAt: '2026-07-09T01:30:00.000Z',
    } satisfies FleetOverviewTripDto;
    expect(overviewTripEtaDaysLabel(validTrip)).toBe('~7 días');
  });
});
