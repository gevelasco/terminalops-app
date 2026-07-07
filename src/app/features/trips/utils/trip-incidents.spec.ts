import { tripHasIncidents } from './trip-incidents';

describe('tripHasIncidents', () => {
  it('is false when only informational bitácora entries exist', () => {
    expect(
      tripHasIncidents({
        incidents: [
          {
            id: '1',
            description: 'Nota',
            occurredAt: '2026-06-01T10:00:00.000Z',
            postedBy: 'ops',
            isIncident: false,
          },
        ],
      }),
    ).toBe(false);
  });

  it('is true when at least one entry is marked as incident', () => {
    expect(
      tripHasIncidents({
        incidents: [
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
        ],
      }),
    ).toBe(true);
  });

  it('is false when bitácora is empty', () => {
    expect(tripHasIncidents({ incidents: [] })).toBe(false);
  });
});
