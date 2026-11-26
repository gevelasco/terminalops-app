import { isSubstantiveMaintenanceEntry } from './fleet-maintenance-entry.util';

describe('isSubstantiveMaintenanceEntry', () => {
  it('rejects empty type-only rows', () => {
    expect(isSubstantiveMaintenanceEntry({ type: 'otro' })).toBeFalse();
  });

  it('accepts rows with date or docs', () => {
    expect(isSubstantiveMaintenanceEntry({ date: '2024-01-01' })).toBeTrue();
    expect(
      isSubstantiveMaintenanceEntry({ documentNames: ['a.pdf'] }),
    ).toBeTrue();
  });
});
