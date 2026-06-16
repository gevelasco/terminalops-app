import type { FleetBrand } from '@shared/models/api/fleet-catalog.model';
import { fleetVersionNamesForBrand } from './fleet-catalog-version-names';

describe('fleetVersionNamesForBrand', () => {
  const brands: FleetBrand[] = [
    {
      id: '1',
      type: 'UNIT',
      name: 'Nissan',
      versions: [
        { id: '10', name: 'Versa' },
        { id: '11', name: 'Tsuru' },
      ],
    },
    {
      id: '2',
      type: 'EQUIPMENT',
      name: 'Utility',
      versions: [{ id: '20', name: '3000R' }],
    },
  ];

  it('returns versions for matching brand and type', () => {
    expect(fleetVersionNamesForBrand(brands, 'UNIT', 'Nissan')).toEqual([
      'Versa',
      'Tsuru',
    ]);
  });

  it('is case-insensitive on brand name', () => {
    expect(fleetVersionNamesForBrand(brands, 'UNIT', ' nissan ')).toEqual([
      'Versa',
      'Tsuru',
    ]);
  });

  it('returns empty when brand missing or type mismatches', () => {
    expect(fleetVersionNamesForBrand(brands, 'UNIT', 'Toyota')).toEqual([]);
    expect(fleetVersionNamesForBrand(brands, 'UNIT', '')).toEqual([]);
    expect(fleetVersionNamesForBrand(brands, 'UNIT', 'Utility')).toEqual([]);
  });
});
