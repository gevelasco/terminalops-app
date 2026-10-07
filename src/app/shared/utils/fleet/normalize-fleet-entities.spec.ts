import { mapApiUnit } from '@shared/data/api-mappers';
import { normalizeUnitFromApi } from './normalize-fleet-entities';

describe('normalizeUnitFromApi', () => {
  it('preserves hitched equipment when re-normalizing a mapped unit', () => {
    const fromApi = mapApiUnit({
      id: 98,
      plate: '98BL2L',
      capacityKg: 1000,
      status: 'available',
      equipment: [{ id: 12, name: 'STE', serialNumber: '23432', unitId: 98 }],
    });
    expect(fromApi.hitchedEquipment?.length).toBe(1);

    const again = normalizeUnitFromApi(fromApi);
    expect(again.hitchedEquipment?.length).toBe(1);
    expect(again.hitchedEquipment?.[0]?.id).toBe('12');
  });
});
