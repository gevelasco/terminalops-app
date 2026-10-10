import { FleetEntityDetailCache } from './fleet-entity-detail-cache';

describe('FleetEntityDetailCache', () => {
  it('returns data within TTL and drops after expiry', () => {
    const ttlMs = 60_000;
    const cache = new FleetEntityDetailCache<string>(ttlMs);
    const base = 1_700_000_000_000;
    spyOn(Date, 'now').and.returnValues(base, base, base + ttlMs + 1);
    cache.set('1', 'detail');
    expect(cache.get('1')).toBe('detail');
    expect(cache.get('1')).toBeNull();
  });

  it('invalidate removes one id', () => {
    const cache = new FleetEntityDetailCache<string>();
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.invalidate('a');
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe('B');
  });
});
