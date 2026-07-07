import type { Operator } from '@shared/models/logistics.models';
import { buildOperatorPatchPayload } from './operator-api-payload';

function baseOperator(overrides: Partial<Operator> = {}): Operator {
  return {
    id: '3',
    name: 'Juan Pérez',
    status: 'in_use',
    isActive: true,
    ...overrides,
  } as Operator;
}

describe('operator-api-payload (A6)', () => {
  it('never sends operational status in patch payload', () => {
    const payload = buildOperatorPatchPayload(baseOperator());
    expect('status' in (payload as object)).toBe(false);
  });

  it('includes isActive for user-controlled visibility', () => {
    const payload = buildOperatorPatchPayload(baseOperator({ isActive: false }));
    expect(payload.isActive).toBe(false);
  });
});
