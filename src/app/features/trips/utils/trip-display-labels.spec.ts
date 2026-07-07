import type { Equipment } from '@shared/models/logistics.models';
import { tripEquipmentDisplayAt } from './trip-display-labels';

function equipment(partial: Partial<Equipment> & Pick<Equipment, 'id'>): Equipment {
  return {
    name: 'Alias equipo',
    serialNumber: 'SN-1',
    lastServiceDate: '',
    unitId: '1',
    ...partial,
  } as Equipment;
}

describe('tripEquipmentDisplayAt', () => {
  it('builds MARCA-AÑO-PLACA from catalog instead of alias or id', () => {
    expect(
      tripEquipmentDisplayAt(
        {
          equipment: ['Alias equipo'],
          equipmentIds: ['3'],
        },
        0,
        [
          equipment({
            id: '3',
            trailerBrandAbbr: 'PET',
            trailerYear: '2017',
            plate: 'REM-01',
          }),
        ],
      ),
    ).toBe('PET-2017-REM-01');
  });

  it('falls back to equipment label when catalog is unavailable', () => {
    expect(
      tripEquipmentDisplayAt(
        {
          equipment: ['PET-2017-REM-01'],
          equipmentIds: ['3'],
        },
        0,
      ),
    ).toBe('PET-2017-REM-01');
  });

  it('falls back to equipment id when label is missing', () => {
    expect(
      tripEquipmentDisplayAt(
        {
          equipment: [],
          equipmentIds: ['3'],
        },
        0,
      ),
    ).toBe('3');
  });
});
