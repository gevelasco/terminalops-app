import { compareByOperatorOperationalStatus } from '@shared/utils/operator-operational-status-sort';
import type { Operator } from '@shared/models/logistics.models';

function op(
  status: Operator['status'],
  name: string,
): Pick<Operator, 'status' | 'name'> {
  return { status, name };
}

describe('compareByOperatorOperationalStatus', () => {
  it('orders en curso before programado before disponible', () => {
    expect(
      compareByOperatorOperationalStatus(
        op('scheduled', 'B'),
        op('in_use', 'A'),
      ),
    ).toBeGreaterThan(0);
    expect(
      compareByOperatorOperationalStatus(
        op('available', 'C'),
        op('scheduled', 'B'),
      ),
    ).toBeGreaterThan(0);
    expect(
      compareByOperatorOperationalStatus(
        op('in_use', 'A'),
        op('available', 'C'),
      ),
    ).toBeLessThan(0);
  });

  it('sorts by name within the same status', () => {
    expect(
      compareByOperatorOperationalStatus(
        op('available', 'Zeta'),
        op('available', 'Alfa'),
      ),
    ).toBeGreaterThan(0);
  });
});
