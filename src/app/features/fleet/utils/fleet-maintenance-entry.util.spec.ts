import {
  attachFleetMaintenanceDocNamesToNewestEntry,
  isSubstantiveMaintenanceEntry,
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

describe('isSubstantiveMaintenanceEntry', () => {
  it('treats document-only rows as substantive', () => {
    expect(
      isSubstantiveMaintenanceEntry({ documentNames: ['a.pdf'] }),
    ).toBe(true);
  });
});
