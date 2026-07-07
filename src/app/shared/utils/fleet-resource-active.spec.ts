import { isFleetResourceActive } from './fleet-resource-active';

describe('isFleetResourceActive', () => {
  it('treats undefined as active', () => {
    expect(isFleetResourceActive({})).toBe(true);
    expect(isFleetResourceActive(null)).toBe(true);
  });

  it('rejects explicitly inactive resources', () => {
    expect(isFleetResourceActive({ isActive: false })).toBe(false);
  });
});
