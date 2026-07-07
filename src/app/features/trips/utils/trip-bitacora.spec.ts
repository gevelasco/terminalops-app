import {
  isTripBitacoraIncident,
  tripBitacoraSorted,
  tripMarkedIncidentsSorted,
} from './trip-bitacora';
import type { TripIncident } from '@shared/models/logistics.models';

describe('trip-bitacora', () => {
  const entries: TripIncident[] = [
    {
      id: '1',
      description: 'Nota',
      occurredAt: '2026-06-01T10:00:00.000Z',
      postedBy: 'ops',
      isIncident: false,
    },
    {
      id: '2',
      description: 'Falla',
      occurredAt: '2026-06-02T10:00:00.000Z',
      postedBy: 'ops',
      isIncident: true,
    },
  ];

  it('filters marked incidents only', () => {
    expect(tripMarkedIncidentsSorted(entries).map((e) => e.id)).toEqual(['2']);
    expect(isTripBitacoraIncident(entries[0]!)).toBe(false);
    expect(isTripBitacoraIncident(entries[1]!)).toBe(true);
  });

  it('sorts bitacora newest first', () => {
    expect(tripBitacoraSorted(entries).map((e) => e.id)).toEqual(['2', '1']);
  });
});
