import { formatGroupedNumber } from '@shared/utils/format-grouped-number';

describe('format-grouped-number', () => {
  it('formats thousands with es-MX commas', () => {
    expect(formatGroupedNumber(580000)).toBe('580,000');
    expect(formatGroupedNumber(580000.5)).toBe('580,000.5');
  });
});
