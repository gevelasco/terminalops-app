import { formatTollPlazaListLabel } from './destination-rate-toll-plaza-display.util';

describe('formatTollPlazaListLabel', () => {
  it('formats name and section', () => {
    expect(
      formatTollPlazaListLabel({
        name: 'Cuyutlán',
        section: 'Armería - Manzanillo',
      }),
    ).toBe('Cuyutlán, Armería - Manzanillo');
  });

  it('omits empty section', () => {
    expect(formatTollPlazaListLabel({ name: 'Sayula' })).toBe('Sayula');
    expect(formatTollPlazaListLabel({ name: 'Sayula', section: '  ' })).toBe(
      'Sayula',
    );
  });
});
