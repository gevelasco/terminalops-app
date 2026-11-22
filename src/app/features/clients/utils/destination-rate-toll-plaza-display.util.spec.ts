import { formatTollPlazaListLabel } from './destination-rate-toll-plaza-display.util';

describe('formatTollPlazaListLabel', () => {
  it('formats full peaje label', () => {
    expect(
      formatTollPlazaListLabel({
        name: 'Acaponeta',
        municipality: 'Acaponeta',
        state: 'Nayarit',
      }),
    ).toBe('Peaje Acaponeta, Acaponeta, Nayarit');
  });

  it('infers municipality from plaza name when missing', () => {
    expect(
      formatTollPlazaListLabel({ name: 'Chapala', state: 'Jalisco' }),
    ).toBe('Peaje Chapala, Chapala, Jalisco');
  });

  it('omits missing municipality or state', () => {
    expect(
      formatTollPlazaListLabel({
        name: 'Toluca - Atlacomulco',
        state: 'México',
      }),
    ).toBe('Peaje Toluca - Atlacomulco, México');
    expect(formatTollPlazaListLabel({ name: 'Sayula' })).toBe('Peaje Sayula');
  });
});