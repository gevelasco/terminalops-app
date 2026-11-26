import {
  formatGroupedNumber,
  formatMoneyInputValue,
} from '@shared/utils/format-grouped-number';

describe('format-grouped-number', () => {
  it('formats thousands with es-MX commas', () => {
    expect(formatGroupedNumber(580000)).toBe('580,000');
    expect(formatGroupedNumber(580000.5)).toBe('580,000.5');
  });

  it('formatMoneyInputValue hydrates API numbers for money inputs', () => {
    expect(formatMoneyInputValue(20000)).toBe('20,000');
    expect(formatMoneyInputValue('20000')).toBe('20,000');
    expect(formatMoneyInputValue('20,000')).toBe('20,000');
    expect(formatMoneyInputValue('')).toBe('');
    expect(formatMoneyInputValue(null)).toBe('');
  });
});
