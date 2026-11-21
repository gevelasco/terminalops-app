import {
  attachFleetMaintenanceDocNamesToNewestEntry,
  isSubstantiveMaintenanceEntry,
  mergeFleetMaintenanceDocNamesForDisplay,
} from './fleet-maintenance-entry.util';

describe('attachFleetMaintenanceDocNamesToNewestEntry', () => {
  it('attaches unit-level docs to the newest entry', () => {
    const result = attachFleetMaintenanceDocNamesToNewestEntry(
      [
        { date: '2026-07-25', type: 'Servicio', cost: 100 },
        { date: '2026-01-01', type: 'Otro', cost: 50 },
      ],
      ['factura.pdf', 'foto.jpg'],
    );
    expect(result[0].documentNames).toEqual(['factura.pdf', 'foto.jpg']);
    expect(result[1].documentNames).toBeUndefined();
  });

  it('merges without duplicating existing names', () => {
    const result = attachFleetMaintenanceDocNamesToNewestEntry(
      [{ date: '2026-07-25', documentNames: ['factura.pdf'] }],
      ['factura.pdf', 'extra.pdf'],
    );
    expect(result[0].documentNames).toEqual(['factura.pdf', 'extra.pdf']);
  });
});

describe('mergeFleetMaintenanceDocNamesForDisplay', () => {
  it('uses legacy newest-row when no entry has documentNames', () => {
    const result = mergeFleetMaintenanceDocNamesForDisplay(
      [
        { date: '2026-07-25', type: 'Servicio', cost: 100 },
        { date: '2026-01-01', type: 'Otro', cost: 50 },
      ],
      ['factura.pdf'],
    );
    expect(result[0].documentNames).toEqual(['factura.pdf']);
    expect(result[1].documentNames).toBeUndefined();
  });

  it('does not move unit-level docs onto the newest row when rows have names', () => {
    const result = mergeFleetMaintenanceDocNamesForDisplay(
      [
        { date: '2026-07-25', type: 'Servicio', cost: 100, documentNames: [] },
        {
          date: '2026-01-01',
          type: 'Otro',
          cost: 50,
          documentNames: ['correcto.pdf'],
        },
      ],
      ['correcto.pdf', 'otro.pdf'],
    );
    expect(result[0].documentNames).toEqual([]);
    expect(result[1].documentNames).toEqual(['correcto.pdf']);
  });
});

describe('isSubstantiveMaintenanceEntry', () => {
  it('treats document-only rows as substantive', () => {
    expect(
      isSubstantiveMaintenanceEntry({ documentNames: ['a.pdf'] }),
    ).toBe(true);
  });
});