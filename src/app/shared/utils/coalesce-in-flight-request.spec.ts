import { defer, of, type Observable } from 'rxjs';
import { coalesceInFlightRequest } from './coalesce-in-flight-request';

describe('coalesceInFlightRequest', () => {
  it('reuses one in-flight observable until it completes', () => {
    const slot: { current: Observable<number> | null } = { current: null };
    let calls = 0;
    const factory = () =>
      defer(() => {
        calls += 1;
        return of(42);
      });

    const a = coalesceInFlightRequest(slot, factory);
    const b = coalesceInFlightRequest(slot, factory);

    expect(a).toBe(b);
    expect(calls).toBe(0);

    let value: number | undefined;
    a.subscribe((v) => {
      value = v;
    });
    expect(value).toBe(42);
    expect(calls).toBe(1);

    let secondCall = false;
    coalesceInFlightRequest(slot, factory).subscribe(() => {
      secondCall = true;
    });
    expect(secondCall).toBe(true);
    expect(calls).toBe(2);
  });
});
