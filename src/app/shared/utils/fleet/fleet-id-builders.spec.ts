import type { Equipment } from '@shared/models/logistics.models';
import { formatEquipmentOperationalId } from './fleet-id-builders';

describe('formatEquipmentOperationalId', () => {
  const base: Equipment = {
    id: '42',
    unitId: '1',
    name: 'Remolque',
    serialNumber: 'CHs-234',
    lastServiceDate: '2024-01-01',
    plate: '12-AB-23',
    trailerBrandAbbr: 'HYU',
    trailerYear: '2021',
  };

  it('builds MARCA-AÑO-PLACA without serial suffix or DB id', () => {
    const code = formatEquipmentOperationalId(base);
    expect(code).toBe('HYU-2021-12-AB-23');
    expect(code).not.toContain('CHS');
  });

  it('resolves abbr from fleetMeta.trailerBrandName when abbr is missing', () => {
    const code = formatEquipmentOperationalId({
      ...base,
      id: '7',
      trailerBrandAbbr: undefined,
      fleetMeta: { trailerBrandName: 'Hyundai Translead' },
    });
    expect(code).not.toBe('7');
    expect(code.startsWith('HYU-')).toBe(true);
  });
});
