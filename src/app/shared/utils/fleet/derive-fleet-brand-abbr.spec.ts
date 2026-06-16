import { deriveFleetBrandAbbr } from './derive-fleet-brand-abbr';

describe('deriveFleetBrandAbbr', () => {
  it('uses first three letters of the first word', () => {
    expect(deriveFleetBrandAbbr('Hyundai Translead')).toBe('HYU');
    expect(deriveFleetBrandAbbr('Kenworth')).toBe('KEN');
  });
});
